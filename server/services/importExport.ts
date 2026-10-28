import { db } from "../lib/db.js";

/**
 * Importa o arquivo `engemase-export.json` (gerado a partir do backup do
 * Lovable Cloud) direto no banco de produção. Usado pela página /importar,
 * que só fica ativa enquanto a variável IMPORT_SECRET existir.
 *
 * Mesma lógica do script `scripts/migrate-from-supabase.ts` (modo IMPORT_FILE):
 * é idempotente e mantém as senhas atuais dos usuários.
 */

type Row = Record<string, unknown>;

export interface ExportFile {
  format: string;
  tables: Record<string, Row[]>;
  credentials: { id: string; encrypted_password: string | null; last_sign_in_at: string | null }[];
}

const ORDER = [
  "profiles",
  "tools",
  "vehicles",
  "construction_sites",
  "tool_checkouts",
  "vehicle_checkouts",
  "vehicle_charging_sessions",
  "push_subscriptions",
  "notifications",
  "system_logs",
  "sync_state",
] as const;

async function targetColumns(table: string) {
  const rows = await db.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    table,
  );
  return new Set(rows.map((r) => r.column_name));
}

async function columnTypes(table: string) {
  const rows = await db.$queryRawUnsafe<{ column_name: string; udt_name: string }[]>(
    `SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    table,
  );
  return new Map(rows.map((r) => [r.column_name, r.udt_name]));
}

async function insertRows(table: string, rows: Row[]): Promise<number> {
  if (rows.length === 0) return 0;
  const cols = await targetColumns(table);
  const types = await columnTypes(table);
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => cols.has(c));
  let inserted = 0;
  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const values: unknown[] = [];
    const tuples = part.map((row, r) => {
      const ph = columns.map((c, k) => {
        const v = row[c] ?? null;
        values.push(v !== null && typeof v === "object" ? JSON.stringify(v) : v === null ? null : String(v));
        // Cast explícito: os valores chegam como texto do backup.
        const t = types.get(c)!;
        return `$${r * columns.length + k + 1}::text::"${t}"`;
      });
      return `(${ph.join(",")})`;
    });
    inserted += await db.$executeRawUnsafe(
      `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(",")}) VALUES ${tuples.join(",")} ON CONFLICT DO NOTHING`,
      ...values,
    );
  }
  return inserted;
}

export async function importExportFile(data: ExportFile) {
  if (data?.format !== "engemase-export-v1" || !data.tables) {
    throw new Error("Arquivo inválido: use o engemase-export.json");
  }
  const result: Record<string, string> = {};
  const creds = new Map((data.credentials ?? []).map((c) => [c.id, c]));
  const profileIds = new Set((data.tables.profiles ?? []).map((p) => p.id as string));

  for (const table of ORDER) {
    let rows = data.tables[table] ?? [];
    if (table === "profiles") {
      rows = rows.map((p) => {
        const c = creds.get(p.id as string);
        return {
          ...p,
          password_hash: c?.encrypted_password || "",
          last_sign_in_at: c?.last_sign_in_at ?? null,
          onboarding_completed: true,
          token_version: 0,
        };
      });
    }
    if (table === "construction_sites") rows = rows.map((r) => ({ ...r, source: "trello" }));
    if (table === "notifications") rows = rows.filter((n) => profileIds.has(n.user_id as string));
    const inserted = await insertRows(table, rows);
    result[table] = `${inserted}/${rows.length}`;
  }

  for (const r of data.tables.data_retention_settings ?? []) {
    await db.$executeRawUnsafe(
      `UPDATE data_retention_settings SET retention_days = $2::int, enabled = $3::boolean WHERE setting_key = $1`,
      r.setting_key,
      String(r.retention_days),
      String(r.enabled),
    );
  }

  await db.$executeRawUnsafe(`
    UPDATE tools t SET quantity_available = GREATEST(0, t.quantity_total - (
      SELECT count(*) FROM tool_checkouts c WHERE c.tool_id = t.id AND c.status = 'checked_out'))`);
  await db.$executeRawUnsafe(`
    UPDATE vehicles v SET status = CASE WHEN EXISTS (
      SELECT 1 FROM vehicle_checkouts c WHERE c.vehicle_id = v.id AND c.status = 'checked_out') THEN 'in_use'
      WHEN v.status = 'in_use' THEN 'available' ELSE v.status END`);

  return result;
}
