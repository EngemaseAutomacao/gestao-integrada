import { logAction } from "../lib/audit.js";
import { db } from "../lib/db.js";
import { deleteFiles } from "../lib/storage.js";
import { ALL_VEHICLE_PHOTO_COLUMNS } from "./vehicleCheckouts.js";

/**
 * Política de retenção de dados (antiga edge function `cleanup-data`).
 *
 * Correções em relação à versão anterior:
 * - As fotos são guardadas como path (ex.: `veiculos/...jpg`), mas a função antiga
 *   procurava URLs `/storage/v1/object/...` — nenhum arquivo era apagado.
 * - A limpeza de fotos de veículos ignorava rodas, controle e interior.
 */

const TOOL_PHOTO_COLUMNS = [
  "checkout_photo_url",
  "checkin_photo_url",
  "checkout_signature_url",
  "checkin_signature_url",
] as const;

export async function runCleanup(actor?: { id: string; full_name: string }) {
  const settings = await db.data_retention_settings.findMany({ where: { enabled: true } });
  const results: Record<string, number> = {};

  for (const setting of settings) {
    const cutoff = new Date(Date.now() - setting.retention_days * 24 * 60 * 60 * 1000);
    let affected = 0;

    switch (setting.setting_key) {
      case "notifications": {
        const r = await db.notifications.deleteMany({ where: { read: true, created_at: { lt: cutoff } } });
        affected = r.count;
        break;
      }
      case "system_logs": {
        const r = await db.system_logs.deleteMany({ where: { created_at: { lt: cutoff } } });
        affected = r.count;
        break;
      }
      case "tool_checkout_history": {
        const r = await db.tool_checkouts.deleteMany({ where: { status: "checked_in", checkin_date: { lt: cutoff } } });
        affected = r.count;
        break;
      }
      case "vehicle_checkout_history": {
        const r = await db.vehicle_checkouts.deleteMany({
          where: { status: "checked_in", checkin_date: { lt: cutoff } },
        });
        affected = r.count;
        break;
      }
      case "tool_checkout_photos": {
        const rows = await db.tool_checkouts.findMany({
          where: {
            status: "checked_in",
            checkin_date: { lt: cutoff },
            OR: TOOL_PHOTO_COLUMNS.map((c) => ({ [c]: { not: null } })),
          },
          select: { id: true, checkout_photo_url: true, checkin_photo_url: true, checkout_signature_url: true, checkin_signature_url: true },
        });
        for (const row of rows) {
          const paths = TOOL_PHOTO_COLUMNS.map((c) => row[c]).filter((p): p is string => !!p);
          await deleteFiles(paths);
          await db.uploaded_files.deleteMany({ where: { path: { in: paths } } });
          await db.tool_checkouts.update({
            where: { id: row.id },
            data: Object.fromEntries(TOOL_PHOTO_COLUMNS.map((c) => [c, null])),
          });
        }
        affected = rows.length;
        break;
      }
      case "vehicle_checkout_photos": {
        const rows = await db.vehicle_checkouts.findMany({
          where: {
            status: "checked_in",
            checkin_date: { lt: cutoff },
            OR: ALL_VEHICLE_PHOTO_COLUMNS.map((c) => ({ [c]: { not: null } })),
          },
        });
        for (const row of rows) {
          const rec = row as unknown as Record<string, string | null>;
          const paths = ALL_VEHICLE_PHOTO_COLUMNS.map((c) => rec[c]).filter((p): p is string => !!p);
          await deleteFiles(paths);
          await db.uploaded_files.deleteMany({ where: { path: { in: paths } } });
          await db.vehicle_checkouts.update({
            where: { id: row.id },
            data: Object.fromEntries(ALL_VEHICLE_PHOTO_COLUMNS.map((c) => [c, null])),
          });
        }
        affected = rows.length;
        break;
      }
    }
    results[setting.setting_key] = affected;
  }

  await logAction({
    action: "data_cleanup",
    entity_type: "system",
    user_id: actor?.id ?? null,
    user_name: actor?.full_name ?? "Sistema (agendado)",
    details: { results, timestamp: new Date().toISOString() },
  });
  await db.sync_state.upsert({
    where: { key: "cleanup-data" },
    create: { key: "cleanup-data", summary: results },
    update: { last_run_at: new Date(), summary: results },
  });
  return results;
}
