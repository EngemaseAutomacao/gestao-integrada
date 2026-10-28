/**
 * Migra os dados do projeto antigo (Supabase/Lovable) para o novo banco (Prisma Postgres).
 *
 * Uso:
 *   SOURCE_DATABASE_URL="postgresql://postgres:<senha>@db.<projeto>.supabase.co:5432/postgres" \
 *   DATABASE_URL="<url do Prisma Postgres>" \
 *   npm run migrate:supabase
 *
 * Para copiar também as fotos do bucket "imagens" para o Vercel Blob:
 *   SUPABASE_URL="https://<projeto>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="..." BLOB_READ_WRITE_TOKEN="..." \
 *   npm run migrate:supabase -- --with-files
 *
 * - Os usuários mantêm as senhas atuais (o hash bcrypt do Supabase Auth é copiado).
 * - O script é idempotente: pode ser executado de novo (registros existentes são ignorados).
 * - Rode `npm run db:deploy` antes, para criar as tabelas no banco novo.
 */
import pg from "pg";
import { putFile } from "../server/lib/storage.js";

const SOURCE = process.env.SOURCE_DATABASE_URL;
const TARGET = process.env.DATABASE_URL;
const WITH_FILES = process.argv.includes("--with-files");

if (!SOURCE || !TARGET) {
  console.error("Defina SOURCE_DATABASE_URL (Supabase) e DATABASE_URL (banco novo).");
  process.exit(1);
}

const src = new pg.Client({ connectionString: SOURCE, ssl: { rejectUnauthorized: false } });
const dst = new pg.Client({ connectionString: TARGET });

/** Colunas existentes nos dois lados (o schema novo tem algumas a mais/menos). */
async function commonColumns(table: string): Promise<string[]> {
  const q = `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`;
  const [a, b] = await Promise.all([src.query(q, [table]), dst.query(q, [table])]);
  const target = new Set(b.rows.map((r) => r.column_name as string));
  return a.rows.map((r) => r.column_name as string).filter((c) => target.has(c));
}

async function copyRows(table: string, rows: Record<string, unknown>[], columns: string[], conflict = "DO NOTHING") {
  let inserted = 0;
  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const values: unknown[] = [];
    const tuples = part.map((row, r) => {
      const ph = columns.map((c, k) => {
        const v = row[c];
        values.push(v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);
        return `$${r * columns.length + k + 1}`;
      });
      return `(${ph.join(",")})`;
    });
    const cols = columns.map((c) => `"${c}"`).join(",");
    const res = await dst.query(`INSERT INTO "${table}" (${cols}) VALUES ${tuples.join(",")} ON CONFLICT ${conflict}`, values);
    inserted += res.rowCount ?? 0;
  }
  console.log(`  ${table}: ${inserted}/${rows.length} inseridos`);
}

async function copyTable(table: string, opts: { where?: string; extra?: Record<string, unknown> } = {}) {
  const columns = await commonColumns(table);
  const { rows } = await src.query(`SELECT ${columns.map((c) => `"${c}"`).join(",")} FROM public."${table}" ${opts.where ?? ""}`);
  const extraCols = Object.keys(opts.extra ?? {});
  const all = rows.map((r) => ({ ...r, ...opts.extra }));
  await copyRows(table, all, [...columns, ...extraCols]);
}

async function migrateProfiles() {
  // Junta perfil + credenciais do Supabase Auth (hash bcrypt e último login).
  const { rows } = await src.query(`
    SELECT p.*, u.encrypted_password AS password_hash, u.last_sign_in_at AS auth_last_sign_in_at
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id`);
  const targetCols = new Set(
    (await dst.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles'`)).rows.map(
      (r) => r.column_name as string,
    ),
  );
  const mapped = rows.map((r) => ({
    ...r,
    password_hash: r.password_hash || "",
    last_sign_in_at: r.auth_last_sign_in_at ?? null,
    // Usuários existentes já passaram pelo tour; só os novos verão.
    onboarding_completed: true,
    token_version: 0,
  }));
  const cols = Object.keys(mapped[0] ?? {}).filter((c) => targetCols.has(c));
  await copyRows("profiles", mapped, cols);
}

async function migrateFiles() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("--with-files exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.BLOB_READ_WRITE_TOKEN) console.warn("  BLOB_READ_WRITE_TOKEN ausente: arquivos irão para .data/uploads (local)");

  const { rows } = await src.query(
    `SELECT name, owner, metadata, created_at FROM storage.objects WHERE bucket_id = 'imagens' AND name NOT LIKE '%.emptyFolderPlaceholder' ORDER BY created_at`,
  );
  const done = new Set(
    (await dst.query(`SELECT path FROM uploaded_files`)).rows.map((r) => r.path as string),
  );
  let copied = 0;
  let failed = 0;
  for (const obj of rows) {
    const path = obj.name as string;
    if (done.has(path)) continue;
    try {
      const res = await fetch(`${url}/storage/v1/object/imagens/${path.split("/").map(encodeURIComponent).join("/")}`, {
        headers: { Authorization: `Bearer ${key}`, apikey: key },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.arrayBuffer();
      const contentType = (obj.metadata?.mimetype as string) || res.headers.get("content-type") || "image/jpeg";
      await putFile(path, body, contentType);
      await dst.query(
        `INSERT INTO uploaded_files (path, owner_id, content_type, size, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [path, obj.owner ?? null, contentType, body.byteLength, obj.created_at],
      );
      copied++;
      if (copied % 50 === 0) console.log(`  ${copied} arquivos copiados...`);
    } catch (err) {
      failed++;
      console.warn(`  falha em ${path}: ${String(err)}`);
    }
  }
  console.log(`  arquivos: ${copied} copiados, ${failed} falhas, ${rows.length - copied - failed} já existentes`);
}

async function main() {
  await src.connect();
  await dst.connect();
  console.log("Migrando dados...");

  await migrateProfiles();
  await copyTable("tools");
  await copyTable("vehicles");
  // Obras vieram do Trello: marca a origem para a sincronização poder gerenciá-las.
  await copyTable("construction_sites", { extra: { source: "trello" } });
  await copyTable("tool_checkouts");
  await copyTable("vehicle_checkouts");
  await copyTable("vehicle_charging_sessions");
  await copyTable("push_subscriptions");
  await copyTable("notifications", { where: "WHERE user_id IN (SELECT id FROM public.profiles)" });
  await copyTable("system_logs");
  await copyTable("sync_state");
  // Configurações de retenção: mantém os valores escolhidos no sistema antigo.
  const retention = await src.query(`SELECT setting_key, retention_days, enabled FROM public.data_retention_settings`);
  for (const r of retention.rows) {
    await dst.query(`UPDATE data_retention_settings SET retention_days=$2, enabled=$3 WHERE setting_key=$1`, [
      r.setting_key,
      r.retention_days,
      r.enabled,
    ]);
  }
  console.log(`  data_retention_settings: ${retention.rowCount} atualizados`);

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
    await migrateFiles();
  } else {
    console.log("  (fotos não copiadas — use --with-files para copiar para o Vercel Blob)");
  }

  console.log("Concluído.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await src.end().catch(() => {});
    await dst.end().catch(() => {});
  });
