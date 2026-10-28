import { db } from "../lib/db.js";
import { adminIds, createNotifications, dispatchPendingPush } from "../lib/notify.js";

/**
 * Rotinas periódicas (antes: funções SQL chamadas pelo pg_cron via edge function
 * `check-notifications`). Na Vercel são disparadas pelo Vercel Cron.
 *
 * Observação: o cron antigo enviava apenas o header Authorization com a chave
 * anon, sem `x-cron-secret`, e a função respondia 401 — por isso os avisos de
 * atraso não estavam sendo gerados automaticamente.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const daysSince = (date: Date) => Math.max(1, Math.ceil((Date.now() - date.getTime()) / DAY_MS));

/** Ids de retiradas que já receberam aviso do tipo nas últimas 24h. */
async function recentlyNotified(types: string[], checkoutIds: string[]) {
  if (checkoutIds.length === 0) return new Set<string>();
  const rows = await db.notifications.findMany({
    where: {
      type: { in: types },
      checkout_id: { in: checkoutIds },
      created_at: { gt: new Date(Date.now() - DAY_MS) },
    },
    select: { checkout_id: true },
  });
  return new Set(rows.map((r) => r.checkout_id!));
}

export async function checkOverdueTools() {
  const overdue = await db.tool_checkouts.findMany({
    where: { status: "checked_out", estimated_return_date: { lt: new Date() } },
    include: { tool: { select: { name: true } }, user: { select: { full_name: true } } },
  });
  const skip = await recentlyNotified(["overdue", "overdue_user_reminder"], overdue.map((o) => o.id));
  const admins = await adminIds();
  let count = 0;

  for (const co of overdue) {
    if (skip.has(co.id)) continue;
    const days = daysSince(co.estimated_return_date!);
    await createNotifications([
      ...admins.map((id) => ({
        user_id: id,
        type: "overdue",
        title: "Ferramenta Atrasada",
        message: `A ferramenta "${co.tool.name}" (responsável: ${co.user.full_name}) está atrasada há ${days} dia(s). Por favor, solicite a devolução.`,
        tool_id: co.tool_id,
        checkout_id: co.id,
      })),
      {
        user_id: co.user_id,
        type: "overdue_user_reminder",
        title: "Ferramenta em Atraso!",
        message: `A ferramenta "${co.tool.name}" está atrasada há ${days} dia(s). Por favor, devolva o quanto antes.`,
        tool_id: co.tool_id,
        checkout_id: co.id,
      },
    ]);
    count++;
  }
  return count;
}

export async function checkVehicleOverdueReturn() {
  const overdue = await db.vehicle_checkouts.findMany({
    where: { status: "checked_out", estimated_return_date: { lt: new Date() } },
    include: { vehicle: { select: { name: true, plate: true } }, user: { select: { full_name: true } } },
  });
  const skip = await recentlyNotified(["vehicle_overdue_return"], overdue.map((o) => o.id));
  const admins = await adminIds();
  let count = 0;

  for (const co of overdue) {
    if (skip.has(co.id)) continue;
    const days = daysSince(co.estimated_return_date!);
    const label = `${co.vehicle.name} (${co.vehicle.plate})`;
    await createNotifications([
      {
        user_id: co.user_id,
        type: "vehicle_overdue_return",
        title: "Veículo Atrasado!",
        message: `O veículo "${label}" está atrasado há ${days} dia(s). Por favor, devolva o veículo.`,
        checkout_id: co.id,
      },
      ...admins.map((id) => ({
        user_id: id,
        type: "vehicle_overdue_return",
        title: "Veículo com Retorno Atrasado",
        message: `O veículo "${label}" está atrasado há ${days} dia(s). Responsável: ${co.user.full_name}.`,
        checkout_id: co.id,
      })),
    ]);
    count++;
  }
  return count;
}

export async function checkProlongedVehicleUse() {
  const prolonged = await db.vehicle_checkouts.findMany({
    where: {
      status: "checked_out",
      checkout_date: { lt: new Date(Date.now() - DAY_MS) },
      // Quem já está atrasado recebe o aviso de atraso; não duplica.
      OR: [{ estimated_return_date: null }, { estimated_return_date: { gte: new Date() } }],
    },
    include: { vehicle: { select: { name: true, plate: true } } },
  });
  const skip = await recentlyNotified(["vehicle_prolonged_use"], prolonged.map((o) => o.id));
  let count = 0;
  for (const co of prolonged) {
    if (skip.has(co.id)) continue;
    const days = daysSince(co.checkout_date);
    await createNotifications([
      {
        user_id: co.user_id,
        type: "vehicle_prolonged_use",
        title: "Veículo em Uso Prolongado",
        message: `O veículo "${co.vehicle.name} (${co.vehicle.plate})" está em uso há ${days} dia(s). Lembre-se de devolvê-lo quando possível.`,
        checkout_id: co.id,
      },
    ]);
    count++;
  }
  return count;
}

export async function runNotificationChecks() {
  const results: Record<string, number | string> = {};
  for (const [name, fn] of [
    ["overdue_tools", checkOverdueTools],
    ["vehicle_overdue_return", checkVehicleOverdueReturn],
    ["prolonged_vehicle_use", checkProlongedVehicleUse],
  ] as const) {
    try {
      results[name] = await fn();
    } catch (err) {
      console.error(`[jobs] ${name} falhou:`, err);
      results[name] = `erro: ${String(err)}`;
    }
  }
  const push = await dispatchPendingPush(500);
  // Janelas antigas de rate limit não servem mais.
  await db.rate_limits.deleteMany({ where: { window_start: { lt: new Date(Date.now() - 60 * 60 * 1000) } } });
  await db.sync_state.upsert({
    where: { key: "check-notifications" },
    create: { key: "check-notifications", summary: { ...results, push } },
    update: { last_run_at: new Date(), summary: { ...results, push } },
  });
  return { ...results, push };
}

/**
 * Uma única consulta (= 1 operação no banco) que responde se há algo a fazer:
 * aviso de atraso/uso prolongado vencido e ainda não enviado nas últimas 24h,
 * ou push que ficou pendente. Mantém barato verificar com frequência.
 */
async function hasDueWork(): Promise<boolean> {
  const [row] = await db.$queryRaw<{ due: boolean }[]>`
    SELECT
      EXISTS (
        SELECT 1 FROM tool_checkouts c
        WHERE c.status = 'checked_out' AND c.estimated_return_date < now()
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.checkout_id = c.id AND n.type IN ('overdue', 'overdue_user_reminder')
              AND n.created_at > now() - interval '1 day'))
      OR EXISTS (
        SELECT 1 FROM vehicle_checkouts c
        WHERE c.status = 'checked_out' AND c.estimated_return_date < now()
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.checkout_id = c.id AND n.type = 'vehicle_overdue_return'
              AND n.created_at > now() - interval '1 day'))
      OR EXISTS (
        SELECT 1 FROM vehicle_checkouts c
        WHERE c.status = 'checked_out' AND c.checkout_date < now() - interval '1 day'
          AND (c.estimated_return_date IS NULL OR c.estimated_return_date >= now())
          AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.checkout_id = c.id AND n.type = 'vehicle_prolonged_use'
              AND n.created_at > now() - interval '1 day'))
      OR EXISTS (
        SELECT 1 FROM notifications
        WHERE push_sent = false AND created_at < now() - interval '2 minutes')
      AS due`;
  return !!row?.due;
}

/** Intervalo mínimo entre verificações na mesma instância (evita 1 consulta por tela aberta). */
const LOCAL_THROTTLE_MS = 60 * 1000;
let lastLocalCheck = 0;

/**
 * Roda os avisos assim que algo vence, sem gastar o plano:
 * - chamada pelo agendador externo a cada poucos minutos (/api/cron/tick) e
 *   quando alguém usa o app;
 * - quando não há nada vencido (quase sempre), custa 1 consulta;
 * - quando há, uma trava evita rodadas simultâneas.
 */
export async function runNotificationChecksIfDue() {
  if (Date.now() - lastLocalCheck < LOCAL_THROTTLE_MS) return null;
  lastLocalCheck = Date.now();
  if (!(await hasDueWork())) return null;

  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  // "Reserva" a execução de forma atômica para evitar rodadas simultâneas.
  const claimed = await db.$executeRaw`
    INSERT INTO sync_state (key, last_run_at) VALUES ('check-notifications-lock', now())
    ON CONFLICT (key) DO UPDATE SET last_run_at = now()
    WHERE sync_state.last_run_at < ${cutoff}`;
  if (claimed === 0) return null;
  return runNotificationChecks();
}
