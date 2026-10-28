import { Hono } from "hono";
import { z } from "zod";
import { isAdmin, requireAdmin, type AuthVars } from "../lib/auth.js";
import { logAction } from "../lib/audit.js";
import { db, type Prisma } from "../lib/db.js";
import { badRequest, conflict, notFound, optionalText, parseBody, parseQuery, uuid } from "../lib/http.js";
import { isSafeStoragePath } from "../lib/storage.js";
import {
  ALL_VEHICLE_PHOTO_COLUMNS,
  checkinVehicle,
  createVehicleCheckout,
  lastKnownKm,
  setVehicleCharging,
} from "../services/vehicleCheckouts.js";
import { dateRange, listLimit, profileSelect } from "./shared.js";

const vehicleBody = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100),
  plate: z
    .string()
    .trim()
    .min(1, "Placa é obrigatória")
    .max(20)
    .transform((v) => v.toUpperCase()),
  brand: optionalText(60),
  model: optionalText(60),
  year: z.coerce.number().int().min(1950).max(2100).nullish(),
  color: optionalText(40),
  vehicle_type: z.enum(["vehicle", "platform"]).default("vehicle"),
  status: z.enum(["available", "in_use", "maintenance"]).optional(),
});

export const vehicleRoutes = new Hono<{ Variables: AuthVars }>()
  .get("/", async (c) => {
    const q = parseQuery(
      c,
      z.object({
        status: z.enum(["available", "in_use", "maintenance"]).optional(),
        q: z.string().max(100).optional(),
        with_last_km: z.enum(["true"]).optional(),
        limit: z.coerce.number().int().min(1).max(1000).optional(),
      }),
    );
    const where: Prisma.vehiclesWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.q) where.OR = ["name", "plate", "brand", "model"].map((f) => ({ [f]: { contains: q.q, mode: "insensitive" } }));
    const rows = await db.vehicles.findMany({ where, orderBy: { name: "asc" }, take: q.limit });
    if (!q.with_last_km) return c.json(rows);

    // Último KM considerando todo o histórico (antes a RLS escondia o histórico de outros usuários).
    const kms = await db.$queryRaw<{ vehicle_id: string; km: number | null }[]>`
      SELECT vehicle_id, GREATEST(MAX(km_checkin), MAX(km_checkout))::int AS km
        FROM vehicle_checkouts GROUP BY vehicle_id`;
    const byId = new Map(kms.map((k) => [k.vehicle_id, k.km ?? 0]));
    return c.json(rows.map((v) => ({ ...v, last_km: byId.get(v.id) ?? 0 })));
  })

  .get("/charging-sessions", requireAdmin, async (c) => {
    const rows = await db.vehicle_charging_sessions.findMany({ orderBy: { started_at: "desc" }, take: 2000 });
    return c.json(rows);
  })

  .get("/:id", async (c) => {
    const id = uuid.parse(c.req.param("id"));
    const vehicle = await db.vehicles.findUnique({ where: { id } });
    if (!vehicle) throw notFound("Veículo não encontrado");
    return c.json({ ...vehicle, last_km: await lastKnownKm(id) });
  })

  .get("/:id/checkouts", async (c) => {
    const user = c.get("user");
    const id = uuid.parse(c.req.param("id"));
    const rows = await db.vehicle_checkouts.findMany({
      where: { vehicle_id: id },
      orderBy: { checkout_date: "desc" },
      take: 500,
      include: { user: { select: { id: true, full_name: true } } },
    });
    return c.json(
      rows.map(({ user: p, ...co }) => {
        const own = isAdmin(user) || co.user_id === user.id;
        return {
          id: co.id,
          checkout_date: co.checkout_date,
          checkin_date: co.checkin_date,
          status: co.status,
          destination: co.destination,
          km_checkout: co.km_checkout,
          km_checkin: co.km_checkin,
          notes: own ? co.notes : null,
          user_id: co.user_id,
          user_profile: { full_name: p.full_name, email: "" },
        };
      }),
    );
  })

  .get("/:id/charging-sessions", async (c) => {
    const id = uuid.parse(c.req.param("id"));
    const rows = await db.vehicle_charging_sessions.findMany({
      where: { vehicle_id: id },
      orderBy: { started_at: "desc" },
      take: 50,
    });
    return c.json(rows);
  })

  .post("/:id/charging", async (c) => {
    const body = await parseBody(c, z.object({ is_charging: z.boolean() }));
    await setVehicleCharging(c.get("user"), uuid.parse(c.req.param("id")), body.is_charging);
    return c.json({ success: true });
  })

  .post("/", requireAdmin, async (c) => {
    const admin = c.get("user");
    const body = await parseBody(c, vehicleBody);
    const exists = await db.vehicles.findUnique({ where: { plate: body.plate } });
    if (exists) throw conflict("Já existe um veículo com esta placa");
    const created = await db.vehicles.create({ data: { ...body, status: body.status ?? "available", created_by: admin.id } });
    await logAction({
      action: "create",
      entity_type: "vehicle",
      entity_id: created.id,
      user_id: admin.id,
      user_name: admin.full_name,
      details: { vehicle_name: created.name, plate: created.plate },
    });
    return c.json(created, 201);
  })

  .patch("/:id", requireAdmin, async (c) => {
    const id = uuid.parse(c.req.param("id"));
    const body = await parseBody(c, vehicleBody);
    const clash = await db.vehicles.findFirst({ where: { plate: body.plate, NOT: { id } } });
    if (clash) throw conflict("Já existe um veículo com esta placa");
    const current = await db.vehicles.findUnique({ where: { id } });
    if (!current) throw notFound("Veículo não encontrado");
    // Status "em uso" é controlado pelas retiradas, não pelo cadastro.
    const status = body.status && body.status !== "in_use" && current.status !== "in_use" ? body.status : undefined;
    const updated = await db.vehicles.update({ where: { id }, data: { ...body, status } });
    return c.json(updated);
  })

  .delete("/:id", requireAdmin, async (c) => {
    const admin = c.get("user");
    const id = uuid.parse(c.req.param("id"));
    const reason = c.req.query("reason")?.trim();
    if (!reason || reason.length < 3) throw badRequest("Informe o motivo da exclusão");
    const vehicle = await db.vehicles.findUnique({ where: { id } });
    if (!vehicle) throw notFound("Veículo não encontrado");
    if (await db.vehicle_checkouts.count({ where: { vehicle_id: id, status: "checked_out" } })) {
      throw conflict("Não é possível excluir um veículo em uso");
    }
    await db.vehicles.delete({ where: { id } });
    await logAction({
      action: "delete",
      entity_type: "vehicle",
      entity_id: id,
      user_id: admin.id,
      user_name: admin.full_name,
      details: { vehicle_name: vehicle.name, plate: vehicle.plate, brand: vehicle.brand, reason },
    });
    return c.json({ success: true });
  });

const vehicleCheckoutInclude = {
  vehicle: { select: { id: true, name: true, plate: true, brand: true, model: true, vehicle_type: true } },
  user: { select: profileSelect },
  checked_out_by_user: { select: { id: true, full_name: true } },
  checked_in_by_user: { select: { id: true, full_name: true } },
} satisfies Prisma.vehicle_checkoutsInclude;

type VehicleCheckoutWithRelations = Prisma.vehicle_checkoutsGetPayload<{ include: typeof vehicleCheckoutInclude }>;

function serializeVehicleCheckout(row: VehicleCheckoutWithRelations) {
  const { vehicle, user, checked_out_by_user, checked_in_by_user, ...rest } = row;
  return {
    ...rest,
    vehicles: vehicle,
    profiles: user,
    checked_out_by_profile: checked_out_by_user,
    checked_in_by_profile: checked_in_by_user,
  };
}

const photoFields = Object.fromEntries(
  ALL_VEHICLE_PHOTO_COLUMNS.map((col) => [
    col,
    z
      .string()
      .nullish()
      .refine((v) => v == null || v === "" || isSafeStoragePath(v), "Caminho de foto inválido"),
  ]),
);

export const vehicleCheckoutRoutes = new Hono<{ Variables: AuthVars }>()
  .get("/", async (c) => {
    const user = c.get("user");
    const q = parseQuery(
      c,
      z.object({
        status: z.enum(["checked_out", "checked_in"]).optional(),
        user_id: z.string().optional(),
        vehicle_id: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        destination: z.string().max(200).optional(),
        exclude_platforms: z.enum(["true"]).optional(),
        dir: z.enum(["asc", "desc"]).optional(),
        limit: z.coerce.number().int().min(1).max(10000).optional(),
        count: z.enum(["true"]).optional(),
        scope: z.enum(["mine", "all"]).optional(),
      }),
    );
    const where: Prisma.vehicle_checkoutsWhereInput = {};
    if (!isAdmin(user) || q.scope === "mine") where.user_id = user.id;
    else if (q.user_id) where.user_id = q.user_id;
    if (q.status) where.status = q.status;
    if (q.vehicle_id) where.vehicle_id = q.vehicle_id;
    if (q.destination) where.destination = { contains: q.destination, mode: "insensitive" };
    if (q.exclude_platforms) where.vehicle = { vehicle_type: { not: "platform" } };
    const range = dateRange(q.from, q.to);
    if (range) where.checkout_date = range;

    if (q.count) return c.json({ count: await db.vehicle_checkouts.count({ where }) });

    const rows = await db.vehicle_checkouts.findMany({
      where,
      include: vehicleCheckoutInclude,
      orderBy: { checkout_date: q.dir ?? "desc" },
      take: listLimit(q.limit),
    });
    return c.json(rows.map(serializeVehicleCheckout));
  })

  .post("/", async (c) => {
    const body = await parseBody(
      c,
      z
        .object({
          vehicle_id: uuid,
          user_id: uuid.nullish(),
          destination: z.string().max(200).nullish(),
          destination_address: z.string().max(500).nullish(),
          purpose: z.string().max(500).nullish(),
          notes: z.string().max(2000).nullish(),
          estimated_return_date: z.string().nullish(),
          estimated_return_time: z.string().max(10).nullish(),
          checkout_date: z.string().nullish(),
          km_checkout: z.number().nullish(),
          is_outside_city: z.boolean().nullish(),
          origin_address: z.string().max(500).nullish(),
          origin_latitude: z.number().nullish(),
          origin_longitude: z.number().nullish(),
          estimated_distance_km: z.number().nullish(),
          estimated_duration_minutes: z.number().nullish(),
          client_op_id: z.string().max(100).nullish(),
          ...photoFields,
        })
        .passthrough(),
    );
    const created = await createVehicleCheckout(c.get("user"), body);
    return c.json(created, 201);
  })

  .post("/:id/checkin", async (c) => {
    const body = await parseBody(
      c,
      z
        .object({
          checkin_date: z.string().nullish(),
          notes: z.string().max(2000).nullish(),
          km_checkin: z.number().nullish(),
          km_checkout: z.number().nullish(),
          km_checkin_automatic: z.boolean().nullish(),
          charges_during_use: z.number().nullish(),
          refueled: z.boolean().nullish(),
          ...photoFields,
        })
        .passthrough(),
    );
    const updated = await checkinVehicle(c.get("user"), uuid.parse(c.req.param("id")), body);
    return c.json(updated);
  })

  /** Correção administrativa (KM, observações, abastecimento). */
  .patch("/:id", requireAdmin, async (c) => {
    const admin = c.get("user");
    const id = uuid.parse(c.req.param("id"));
    const body = await parseBody(
      c,
      z
        .object({
          km_checkout: z.number().int().min(0).optional(),
          km_checkin: z.number().int().min(0).nullable().optional(),
          km_checkin_automatic: z.boolean().optional(),
          notes: z.string().max(4000).nullable().optional(),
          refueled: z.boolean().nullable().optional(),
          destination: z.string().max(200).optional(),
        })
        .strict(),
    );
    const current = await db.vehicle_checkouts.findUnique({ where: { id }, include: vehicleCheckoutInclude });
    if (!current) throw notFound("Registro não encontrado");
    const kmOut = body.km_checkout ?? current.km_checkout;
    const kmIn = body.km_checkin === undefined ? current.km_checkin : body.km_checkin;
    if (kmIn != null && kmIn < kmOut) throw badRequest("KM de chegada não pode ser menor que o de saída");

    const updated = await db.vehicle_checkouts.update({ where: { id }, data: body, include: vehicleCheckoutInclude });
    if (body.km_checkout !== undefined || body.km_checkin !== undefined) {
      await logAction({
        action: "km_correction",
        entity_type: "vehicle_checkout",
        entity_id: id,
        user_id: admin.id,
        user_name: admin.full_name,
        details: {
          vehicle_name: current.vehicle.name,
          plate: current.vehicle.plate,
          user_name: current.user.full_name,
          previous: { km_checkout: current.km_checkout, km_checkin: current.km_checkin },
          corrected: { km_checkout: kmOut, km_checkin: kmIn },
        },
      });
    }
    return c.json(serializeVehicleCheckout(updated));
  })

  .delete("/:id", requireAdmin, async (c) => {
    const admin = c.get("user");
    const id = uuid.parse(c.req.param("id"));
    const reason = c.req.query("reason")?.trim();
    if (!reason || reason.length < 3) throw badRequest("Informe o motivo da exclusão");
    await db.$transaction(async (tx) => {
      const current = await tx.vehicle_checkouts.findUnique({ where: { id }, include: vehicleCheckoutInclude });
      if (!current) throw notFound("Registro não encontrado");
      await tx.vehicle_checkouts.delete({ where: { id } });
      if (current.status === "checked_out") {
        const open = await tx.vehicle_checkouts.count({ where: { vehicle_id: current.vehicle_id, status: "checked_out" } });
        if (open === 0) await tx.vehicles.update({ where: { id: current.vehicle_id }, data: { status: "available" } });
      }
      await logAction(
        {
          action: "delete_history",
          entity_type: "vehicle_checkout",
          entity_id: id,
          user_id: admin.id,
          user_name: admin.full_name,
          details: {
            vehicle_name: current.vehicle.name,
            plate: current.vehicle.plate,
            user_name: current.user.full_name,
            reason,
          },
        },
        tx,
      );
    });
    return c.json({ success: true });
  });
