/**
 * Migra os dados do projeto antigo (Supabase/Lovable) para o novo banco (Prisma Postgres).
 *
 * Duas formas de ler o projeto antigo:
 *
 * A) Lovable Cloud (sem acesso direto ao Supabase) — via função de exportação
 *    temporária criada no projeto antigo (ver scripts/lovable-export/LEIA-ME.md):
 *      EXPORT_URL="https://<projeto>.supabase.co/functions/v1/export-data" \
 *      EXPORT_SECRET="<segredo>" \
 *      DATABASE_URL="<url do Prisma Postgres>" \
 *      npm run migrate:supabase -- [--with-files]
 *
 * B) Acesso direto ao banco do Supabase:
 *      SOURCE_DATABASE_URL="postgresql://..." DATABASE_URL="..." npm run migrate:supabase
 *    (para fotos: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY + --with-files)
 *
 * Em ambos os casos, para copiar as fotos para o Vercel Blob defina BLOB_READ_WRITE_TOKEN.
 *
 * - Os usuários mantêm as senhas atuais (o hash bcrypt do Supabase Auth é copiado).
 * - É idempotente: pode ser executado de novo (registros existentes são ignorados).
 * - As tabelas do banco novo precisam existir (o deploy na Vercel já as cria).
 */
import pg from "pg";
import { putFile } from "../server/lib/storage.js";

type Row = Record<string, unknown>;

interface SourceFile {
  path: string;
  owner: string | null;
  mimetype: string | null;
  created_at: string | Date | null;
  download: () => Promise<ArrayBuffer>;
}

interface Source {
  tableRows(table: string): Promise<Row[]>;
  credentials(): Promise<{ id: string; encrypted_password: string | null; last_sign_in_at: string | null }[]>;
  files(): AsyncGenerator<SourceFile>;
  close(): Promise<void>;
}

const TARGET = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const WITH_FILES = process.argv.includes("--with-files");

/** Origem A: função de exportação no Lovable Cloud. */
function exportSource(baseUrl: string, secret: string): Source {
  const call = async <T>(params: Record<string, string | number>): Promise<T> => {
    const url = new URL(baseUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url, { headers: { "x-export-secret": secret } });
      if (res.ok) return (await res.json()) as T;
      const body = (await res.text()).slice(0, 300);
      if (res.status === 401) throw new Error("EXPORT_SECRET incorreto (401). Confira o segredo cadastrado no Lovable.");
      if (attempt >= 3 || res.status < 500) throw new Error(`Falha na exportação (${res.status}): ${body}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  };
  return {
    async tableRows(table) {
      const all: Row[] = [];
      for (let page = 0; ; page++) {
        const { rows } = await call<{ rows: Row[] }>({ kind: "table", name: table, page });
        all.push(...rows);
        if (rows.length < 1000) return all;
      }
    },
    async credentials() {
      const { rows } = await call<{ rows: { id: string; encrypted_password: string | null; last_sign_in_at: string | null }[] }>({
        kind: "credentials",
      });
      return rows;
    },
    async *files() {
      for (let page = 0; ; page++) {
        const { rows } = await call<{
          rows: { name: string; owner: string | null; mimetype: string | null; created_at: string; signed_url: string | null }[];
        }>({ kind: "files", page });
        for (const f of rows) {
          yield {
            path: f.name,
            owner: f.owner,
            mimetype: f.mimetype,
            created_at: f.created_at,
            download: async () => {
              if (!f.signed_url) throw new Error("sem URL assinada");
              const res = await fetch(f.signed_url);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.arrayBuffer();
            },
          };
        }
        if (rows.length < 200) return;
      }
    },
    async close() {},
  };
}

/** Origem B: conexão direta ao Postgres do Supabase. */
async function pgSource(connectionString: string): Promise<Source> {
  const src = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await src.connect();
  return {
    async tableRows(table) {
      return (await src.query(`SELECT * FROM public."${table}"`)).rows;
    },
    async credentials() {
      return (await src.query(`SELECT id, encrypted_password, last_sign_in_at FROM auth.users`)).rows;
    },
    async *files() {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("--with-files exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
      const { rows } = await src.query(
        `SELECT name, owner, metadata->>'mimetype' AS mimetype, created_at FROM storage.objects
          WHERE bucket_id = 'imagens' AND name NOT LIKE '%.emptyFolderPlaceholder' ORDER BY created_at`,
      );
      for (const o of rows) {
        yield {
          path: o.name,
          owner: o.owner,
          mimetype: o.mimetype,
          created_at: o.created_at,
          download: async () => {
            const res = await fetch(`${url}/storage/v1/object/imagens/${String(o.name).split("/").map(encodeURIComponent).join("/")}`, {
              headers: { Authorization: `Bearer ${key}`, apikey: key },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.arrayBuffer();
          },
        };
      }
    },
    close: () => src.end(),
  };
}

const dst = new pg.Client({ connectionString: TARGET });
const targetColumnsCache = new Map<string, Set<string>>();

async function targetColumns(table: string) {
  if (!targetColumnsCache.has(table)) {
    const { rows } = await dst.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    targetColumnsCache.set(table, new Set(rows.map((r) => r.column_name as string)));
  }
  return targetColumnsCache.get(table)!;
}

/** Insere as linhas usando só as colunas que existem no banco novo. */
async function insertRows(table: string, rows: Row[], extra: Row = {}) {
  if (rows.length === 0) {
    console.log(`  ${table}: 0 registros`);
    return;
  }
  const cols = await targetColumns(table);
  const all = rows.map((r) => ({ ...r, ...extra }));
  const columns = [...new Set(all.flatMap((r) => Object.keys(r)))].filter((c) => cols.has(c));
  let inserted = 0;
  const chunk = 200;
  for (let i = 0; i < all.length; i += chunk) {
    const part = all.slice(i, i + chunk);
    const values: unknown[] = [];
    const tuples = part.map((row, r) => {
      const ph = columns.map((c, k) => {
        const v = row[c] ?? null;
        values.push(v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);
        return `$${r * columns.length + k + 1}`;
      });
      return `(${ph.join(",")})`;
    });
    const res = await dst.query(
      `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(",")}) VALUES ${tuples.join(",")} ON CONFLICT DO NOTHING`,
      values,
    );
    inserted += res.rowCount ?? 0;
  }
  console.log(`  ${table}: ${inserted}/${rows.length} inseridos`);
}

async function migrateFiles(source: Source) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) console.warn("  BLOB_READ_WRITE_TOKEN ausente: arquivos irão para .data/uploads (local)");
  const done = new Set((await dst.query(`SELECT path FROM uploaded_files`)).rows.map((r) => r.path as string));
  let copied = 0;
  let skipped = 0;
  let failed = 0;
  for await (const f of source.files()) {
    if (done.has(f.path)) {
      skipped++;
      continue;
    }
    try {
      const body = await f.download();
      const contentType = f.mimetype || "image/jpeg";
      await putFile(f.path, body, contentType);
      await dst.query(
        `INSERT INTO uploaded_files (path, owner_id, content_type, size, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [f.path, f.owner ?? null, contentType, body.byteLength, f.created_at ?? new Date()],
      );
      copied++;
      if (copied % 50 === 0) console.log(`  ${copied} arquivos copiados...`);
    } catch (err) {
      failed++;
      console.warn(`  falha em ${f.path}: ${String(err)}`);
    }
  }
  console.log(`  arquivos: ${copied} copiados, ${skipped} já existentes, ${failed} falhas`);
}

async function main() {
  if (!TARGET) throw new Error("Defina DATABASE_URL (banco novo, Prisma Postgres).");
  let source: Source;
  if (process.env.EXPORT_URL) {
    if (!process.env.EXPORT_SECRET) throw new Error("Defina EXPORT_SECRET (o mesmo cadastrado no Lovable).");
    source = exportSource(process.env.EXPORT_URL, process.env.EXPORT_SECRET);
    console.log("Origem: função de exportação do Lovable Cloud");
  } else if (process.env.SOURCE_DATABASE_URL) {
    source = await pgSource(process.env.SOURCE_DATABASE_URL);
    console.log("Origem: conexão direta ao Supabase");
  } else {
    throw new Error("Defina EXPORT_URL + EXPORT_SECRET (Lovable Cloud) ou SOURCE_DATABASE_URL (Supabase).");
  }
  await dst.connect();

  try {
    console.log("Migrando dados...");

    // Perfis + credenciais do Supabase Auth (hash bcrypt e último login).
    const [profiles, creds] = await Promise.all([source.tableRows("profiles"), source.credentials()]);
    const credById = new Map(creds.map((c) => [c.id, c]));
    await insertRows(
      "profiles",
      profiles.map((p) => {
        const c = credById.get(p.id as string);
        return {
          ...p,
          password_hash: c?.encrypted_password || "",
          last_sign_in_at: c?.last_sign_in_at ?? null,
          // Usuários existentes já conhecem o sistema; o tour fica para os novos.
          onboarding_completed: true,
          token_version: 0,
        };
      }),
    );
    const semSenha = profiles.filter((p) => !credById.get(p.id as string)?.encrypted_password).length;
    if (semSenha) console.warn(`  atenção: ${semSenha} perfil(is) sem senha no Auth — use "redefinir senha" no admin`);

    const profileIds = new Set(profiles.map((p) => p.id as string));
    for (const t of ["tools", "vehicles"]) await insertRows(t, await source.tableRows(t));
    // Obras vieram do Trello: marca a origem para a sincronização poder gerenciá-las.
    await insertRows("construction_sites", await source.tableRows("construction_sites"), { source: "trello" });
    for (const t of ["tool_checkouts", "vehicle_checkouts", "vehicle_charging_sessions", "push_subscriptions"]) {
      await insertRows(t, await source.tableRows(t));
    }
    await insertRows(
      "notifications",
      (await source.tableRows("notifications")).filter((n) => profileIds.has(n.user_id as string)),
    );
    for (const t of ["system_logs", "sync_state"]) await insertRows(t, await source.tableRows(t));

    // Configurações de retenção: mantém os valores escolhidos no sistema antigo.
    const retention = await source.tableRows("data_retention_settings");
    for (const r of retention) {
      await dst.query(`UPDATE data_retention_settings SET retention_days=$2, enabled=$3 WHERE setting_key=$1`, [
        r.setting_key,
        r.retention_days,
        r.enabled,
      ]);
    }
    console.log(`  data_retention_settings: ${retention.length} atualizados`);

    // Corrige a disponibilidade a partir das retiradas em aberto.
    await dst.query(`
      UPDATE tools t SET quantity_available = GREATEST(0, t.quantity_total - (
        SELECT count(*) FROM tool_checkouts c WHERE c.tool_id = t.id AND c.status = 'checked_out'))`);
    await dst.query(`
      UPDATE vehicles v SET status = CASE WHEN EXISTS (
        SELECT 1 FROM vehicle_checkouts c WHERE c.vehicle_id = v.id AND c.status = 'checked_out') THEN 'in_use'
        WHEN v.status = 'in_use' THEN 'available' ELSE v.status END`);
    console.log("  estoque de ferramentas e status de veículos recalculados");

    if (WITH_FILES) {
      console.log("Copiando fotos do bucket 'imagens'...");
      await migrateFiles(source);
    } else {
      console.log("  (fotos não copiadas — use --with-files para copiar para o Vercel Blob)");
    }
    console.log("Concluído.");
  } finally {
    await source.close().catch(() => {});
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => dst.end().catch(() => {}));
