import type { PublicProfile } from "../lib/auth.js";
import { logAction } from "../lib/audit.js";
import { db, type Tx } from "../lib/db.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/http.js";
import { adminIds, createNotifications, dispatchPushInBackground } from "../lib/notify.js";
import { isSafeStoragePath } from "../lib/storage.js";

export const PHOTO_KEYS = [
  "front",
  "back",
  "left",
  "right",
  "dashboard",
  "control",
  "interior_front",
  "interior_back",
  "wheel_fl",
  "wheel_fr",
  "wheel_rl",
  "wheel_rr",
] as const;

export const CHECKOUT_PHOTO_COLUMNS = PHOTO_KEYS.map((k) => `photo_${k}_checkout`);
export const CHECKIN_PHOTO_COLUMNS = PHOTO_KEYS.map((k) => `photo_${k}_checkin`);
export const ALL_VEHICLE_PHOTO_COLUMNS = [...CHECKOUT_PHOTO_COLUMNS, ...CHECKIN_PHOTO_COLUMNS];

const MIN_JUSTIFICATION = 5;
const KM_REVIEW_NOTE =
  "[KM pendente de conferência: leitura do hodômetro não confirmada — registrado 0 km rodado]";

function parseDate(value: string | null | undefined, field: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest(`Data inválida em "${field}"`);
  return d;
}

/** Copia apenas colunas de foto conhecidas e com path válido. */
function pickPhotos(input: Record<string, unknown>, columns: string[]) {
  const out: Record<string, string> = {};
  for (const col of columns) {
    const v = input[col];
    if (v == null || v === "") continue;
    if (!isSafeStoragePath(v)) throw badRequest(`Caminho de foto inválido (${col})`);
    out[col] = v;
  }
  return out;
}

/**
 * Último KM conhecido do veículo, considerando TODO o histórico.
 * Antes isso era calculado no navegador com os registros visíveis ao usuário
 * (RLS), então funcionários comuns viam 0 e registravam KM de saída errado.
 */
export async function lastKnownKm(vehicleId: string, tx?: Tx): Promise<number> {
  const rows = await (tx ?? db).$queryRaw<{ km: number | null }[]>`
    SELECT GREATEST(MAX(km_checkin), MAX(km_checkout))::int AS km
      FROM vehicle_checkouts
     WHERE vehicle_id = ${vehicleId}::uuid`;
  return rows[0]?.km ?? 0;
}

export interface VehicleCheckoutInput extends Record<string, unknown> {
  vehicle_id: string;
  user_id?: string | null;
  destination?: string | null;
  destination_address?: string | null;
  purpose?: string | null;
  notes?: string | null;
  estimated_return_date?: string | null;
  estimated_return_time?: string | null;
  checkout_date?: string | null;
  km_checkout?: number | null;
  is_outside_city?: boolean | null;
  origin_address?: string | null;
  origin_latitude?: number | null;
  origin_longitude?: number | null;
  estimated_distance_km?: number | null;
  estimated_duration_minutes?: number | null;
  client_op_id?: string | null;
}

export async function createVehicleCheckout(actor: PublicProfile, input: VehicleCheckoutInput) {
  const isAdmin = actor.role === "admin";

  const result = await db.$transaction(async (tx) => {
    if (input.client_op_id) {
      const existing = await tx.vehicle_checkouts.findUnique({ where: { client_op_id: input.client_op_id } });
      if (existing) return existing;
    }

    // Trava a linha do veículo para impedir duas retiradas simultâneas.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM vehicles WHERE id = ${input.vehicle_id}::uuid FOR UPDATE`;
    if (locked.length === 0) throw notFound("Veículo não encontrado");
    const vehicle = await tx.vehicles.findUniqueOrThrow({ where: { id: input.vehicle_id } });

    if (vehicle.status === "maintenance") throw conflict("Veículo em manutenção");
    const open = await tx.vehicle_checkouts.findFirst({
      where: { vehicle_id: vehicle.id, status: "checked_out" },
      select: { id: true },
    });
    if (open || vehicle.status === "in_use") throw conflict("Este veículo já está em uso");

    const userId = input.user_id || actor.id;
    const actingForOther = userId !== actor.id;
    if (actingForOther && !isAdmin) throw forbidden("Você só pode retirar veículos em seu próprio nome");
    const responsible = actingForOther ? await tx.profiles.findUnique({ where: { id: userId } }) : actor;
    if (!responsible || !responsible.approved) throw badRequest("Usuário responsável inválido ou não aprovado");

    const notes = typeof input.notes === "string" ? input.notes.trim() || null : null;
    if (actingForOther && (!notes || notes.length < MIN_JUSTIFICATION)) {
      throw badRequest("Justificativa obrigatória (mín. 5 caracteres) ao retirar veículo em nome de outro usuário.");
    }
    const destination = typeof input.destination === "string" ? input.destination.trim() : "";
    if (!destination) throw badRequest("Selecione a obra de destino");

    const manualDate = parseDate(input.checkout_date, "checkout_date");
    if (manualDate && !isAdmin) throw forbidden("Somente administradores podem informar data manual");

    const knownKm = await lastKnownKm(vehicle.id, tx);
    const informedKm = typeof input.km_checkout === "number" && input.km_checkout >= 0 ? input.km_checkout : 0;
    const kmCheckout = Math.max(knownKm, informedKm);

    const checkout = await tx.vehicle_checkouts.create({
      data: {
        vehicle_id: vehicle.id,
        user_id: userId,
        checked_out_by: actor.id,
        status: "checked_out",
        km_checkout: kmCheckout,
        destination,
        destination_address: (input.destination_address as string) || null,
        purpose: (input.purpose as string) || null,
        notes,
        estimated_return_date: parseDate(input.estimated_return_date, "estimated_return_date"),
        estimated_return_time: (input.estimated_return_time as string) || null,
        is_outside_city: !!input.is_outside_city,
        origin_address: (input.origin_address as string) || null,
        origin_latitude: typeof input.origin_latitude === "number" ? input.origin_latitude : null,
        origin_longitude: typeof input.origin_longitude === "number" ? input.origin_longitude : null,
        estimated_distance_km: typeof input.estimated_distance_km === "number" ? input.estimated_distance_km : null,
        estimated_duration_minutes:
          typeof input.estimated_duration_minutes === "number" ? Math.round(input.estimated_duration_minutes) : null,
        client_op_id: input.client_op_id || null,
        ...pickPhotos(input, CHECKOUT_PHOTO_COLUMNS),
        ...(manualDate ? { checkout_date: manualDate } : {}),
      },
    });

    // Ao sair, a plataforma deixa de estar carregando (encerra a sessão de carga aberta).
    await tx.vehicles.update({
      where: { id: vehicle.id },
      data: { status: "in_use", is_charging: false, charging_started_at: null, charging_started_by: null },
    });
    await tx.vehicle_charging_sessions.updateMany({
      where: { vehicle_id: vehicle.id, ended_at: null },
      data: { ended_at: new Date(), ended_by: actor.id },
    });

    const label = `${vehicle.name} (${vehicle.plate})`;
    await logAction(
      {
        action: actingForOther ? "manual_checkout_by_admin" : "checkout",
        entity_type: "vehicle",
        entity_id: vehicle.id,
        user_id: actor.id,
        user_name: actor.full_name,
        details: {
          vehicle_name: vehicle.name,
          plate: vehicle.plate,
          destination,
          checkout_id: checkout.id,
          responsible_user_id: userId,
          responsible_user_name: responsible.full_name,
          performed_by_admin: actingForOther,
          admin_name: actingForOther ? actor.full_name : null,
        },
      },
      tx,
    );

    const admins = await adminIds(tx, [actor.id]);
    await createNotifications(
      [
        ...admins.map((id) => ({
          user_id: id,
          type: "vehicle_checkout",
          title: actingForOther ? "Retirada Manual de Veículo" : "Veículo Retirado",
          message:
            `O veículo "${label}" foi retirado por ${responsible.full_name}` +
            (actingForOther ? ` (registrado pelo admin ${actor.full_name}).` : "."),
        })),
        {
          user_id: userId,
          type: "vehicle_checkout",
          title: actingForOther ? "Veículo atribuído a você" : "Retirada de Veículo Registrada",
          message: actingForOther
            ? `O admin ${actor.full_name} retirou o veículo "${label}" em seu nome.`
            : `Sua retirada do veículo "${label}" foi registrada.`,
        },
      ],
      tx,
    );
    return checkout;
  });

  dispatchPushInBackground();
  return result;
}

export interface VehicleCheckinInput extends Record<string, unknown> {
  checkin_date?: string | null;
  notes?: string | null;
  km_checkin?: number | null;
  km_checkout?: number | null;
  km_checkin_automatic?: boolean | null;
  charges_during_use?: number | null;
  refueled?: boolean | null;
}

export async function checkinVehicle(actor: PublicProfile, checkoutId: string, input: VehicleCheckinInput) {
  const isAdmin = actor.role === "admin";
  const manualDate = parseDate(input.checkin_date, "checkin_date");
  const checkinDate = (isAdmin && manualDate) || new Date();

  const result = await db.$transaction(async (tx) => {
    const co = await tx.vehicle_checkouts.findUnique({
      where: { id: checkoutId },
      include: { vehicle: true, user: { select: { full_name: true } } },
    });
    if (!co) throw notFound("Retirada de veículo não encontrada");
    if (co.status === "checked_in") return co; // reenvio offline: idempotente

    const actingForOther = co.user_id !== actor.id;
    if (actingForOther && !isAdmin) throw forbidden("Você só pode devolver veículos retirados por você");

    let notes = typeof input.notes === "string" ? input.notes.trim() || null : null;
    if (actingForOther && (!notes || notes.length < MIN_JUSTIFICATION)) {
      throw badRequest("Justificativa obrigatória (mín. 5 caracteres) ao devolver veículo em nome de outro usuário.");
    }
    if (checkinDate < co.checkout_date) throw badRequest("A data de chegada não pode ser anterior à saída");

    const isPlatform = co.vehicle.vehicle_type === "platform";

    // Ajuste do KM de saída quando ele foi registrado como 0 e a IA leu o painel.
    let kmCheckout = co.km_checkout;
    if (kmCheckout === 0 && typeof input.km_checkout === "number" && input.km_checkout > 0) {
      kmCheckout = Math.round(input.km_checkout);
    }

    // KM igual ao de saída é válido (0 km rodado). Ausente/menor nunca bloqueia:
    // registra o KM de saída e marca para conferência.
    let kmCheckin: number | null = null;
    let automatic = !!input.km_checkin_automatic;
    if (!isPlatform) {
      const informed = typeof input.km_checkin === "number" && Number.isFinite(input.km_checkin)
        ? Math.round(input.km_checkin)
        : null;
      if (informed === null || informed < kmCheckout) {
        kmCheckin = kmCheckout;
        automatic = false;
        if (!notes?.includes("KM pendente de conferência")) {
          notes = notes ? `${notes} ${KM_REVIEW_NOTE}` : KM_REVIEW_NOTE;
        }
      } else {
        kmCheckin = informed;
      }
    }

    // Preserva observações da saída e acrescenta as da chegada.
    const mergedNotes = notes ? (co.notes ? `${co.notes} | Chegada: ${notes}` : notes) : co.notes;

    const { count } = await tx.vehicle_checkouts.updateMany({
      where: { id: co.id, status: "checked_out" },
      data: {
        status: "checked_in",
        checkin_date: checkinDate,
        checked_in_by: actor.id,
        notes: mergedNotes,
        km_checkout: kmCheckout,
        km_checkin: kmCheckin,
        km_checkin_automatic: automatic,
        charges_during_use:
          typeof input.charges_during_use === "number" ? Math.max(0, Math.round(input.charges_during_use)) : undefined,
        refueled: typeof input.refueled === "boolean" ? input.refueled : undefined,
        ...pickPhotos(input, CHECKIN_PHOTO_COLUMNS),
      },
    });
    if (count === 0) return co;

    const stillOpen = await tx.vehicle_checkouts.count({
      where: { vehicle_id: co.vehicle_id, status: "checked_out" },
    });
    if (stillOpen === 0) {
      await tx.vehicles.update({ where: { id: co.vehicle_id }, data: { status: "available" } });
    }

    const label = `${co.vehicle.name} (${co.vehicle.plate})`;
    await logAction(
      {
        action: actingForOther ? "manual_checkin_by_admin" : "checkin",
        entity_type: "vehicle",
        entity_id: co.vehicle_id,
        user_id: actor.id,
        user_name: actor.full_name,
        details: {
          vehicle_name: co.vehicle.name,
          plate: co.vehicle.plate,
          checkout_id: co.id,
          km_checkout: kmCheckout,
          km_checkin: kmCheckin,
          responsible_user_id: co.user_id,
          responsible_user_name: co.user.full_name,
          performed_by_admin: actingForOther,
          admin_name: actingForOther ? actor.full_name : null,
        },
      },
      tx,
    );

    const admins = await adminIds(tx, [actor.id]);
    await createNotifications(
      [
        ...admins.map((id) => ({
          user_id: id,
          type: "vehicle_checkin",
          title: actingForOther ? "Devolução Manual de Veículo" : "Veículo Devolvido",
          message:
            `O veículo "${label}" (resp.: ${co.user.full_name}) foi devolvido` +
            (actingForOther ? ` pelo admin ${actor.full_name}.` : "."),
        })),
        {
          user_id: co.user_id,
          type: "vehicle_checkin",
          title: actingForOther ? "Devolução registrada por Admin" : "Devolução de Veículo Registrada",
          message: actingForOther
            ? `O admin ${actor.full_name} registrou a devolução do veículo "${label}" em seu nome.`
            : `Sua devolução do veículo "${label}" foi registrada.`,
        },
      ],
      tx,
    );
    return tx.vehicle_checkouts.findUniqueOrThrow({ where: { id: co.id } });
  });

  dispatchPushInBackground();
  return result;
}

export async function setVehicleCharging(actor: PublicProfile, vehicleId: string, charging: boolean) {
  await db.$transaction(async (tx) => {
    const vehicle = await tx.vehicles.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw notFound("Veículo não encontrado");
    if (vehicle.vehicle_type !== "platform") throw badRequest("Apenas plataformas podem ser marcadas como carregando");
    if (vehicle.status === "in_use") throw conflict("Veículo em uso não pode ser marcado como carregando");

    if (charging) {
      await tx.vehicles.update({
        where: { id: vehicleId },
        data: { is_charging: true, charging_started_at: new Date(), charging_started_by: actor.id },
      });
      const open = await tx.vehicle_charging_sessions.findFirst({ where: { vehicle_id: vehicleId, ended_at: null } });
      if (!open) {
        await tx.vehicle_charging_sessions.create({ data: { vehicle_id: vehicleId, started_by: actor.id } });
      }
    } else {
      await tx.vehicles.update({
        where: { id: vehicleId },
        data: { is_charging: false, charging_started_at: null, charging_started_by: null },
      });
      await tx.vehicle_charging_sessions.updateMany({
        where: { vehicle_id: vehicleId, ended_at: null },
        data: { ended_at: new Date(), ended_by: actor.id },
      });
    }
  });
}
