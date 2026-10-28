import type { PublicProfile } from "../lib/auth.js";
import { logAction } from "../lib/audit.js";
import { db, type Tx } from "../lib/db.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/http.js";
import { adminIds, createNotifications, dispatchPushInBackground } from "../lib/notify.js";

/**
 * Regras de retirada/devolução de ferramentas.
 *
 * No sistema antigo estas regras estavam espalhadas em triggers do Postgres
 * (disponibilidade, notificações, logs, validação de justificativa) e em RLS.
 * Aqui ficam centralizadas e rodam dentro de uma transação.
 */

export const splitTags = (tag: string | null | undefined) =>
  (tag || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

export interface ToolCheckoutInput {
  tool_id: string;
  user_id?: string | null;
  construction_site?: string | null;
  estimated_return_date?: string | null;
  notes?: string | null;
  selected_tag?: string | null;
  checkout_date?: string | null;
  checkout_photo_url?: string | null;
  checkout_signature_url?: string | null;
  client_op_id?: string | null;
}

export interface ToolCheckinInput {
  checkin_date?: string | null;
  notes?: string | null;
  checkin_photo_url?: string | null;
  checkin_signature_url?: string | null;
}

const MIN_JUSTIFICATION = 5;

function parseDate(value: string | null | undefined, field: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest(`Data inválida em "${field}"`);
  return d;
}

async function loadNames(tx: Tx, userIds: string[]) {
  const rows = await tx.profiles.findMany({
    where: { id: { in: [...new Set(userIds)] } },
    select: { id: true, full_name: true },
  });
  return new Map(rows.map((r) => [r.id, r.full_name]));
}

export async function createToolCheckouts(actor: PublicProfile, items: ToolCheckoutInput[]) {
  if (items.length === 0) throw badRequest("Nenhuma ferramenta informada");
  if (items.length > 100) throw badRequest("Máximo de 100 ferramentas por operação");
  const isAdmin = actor.role === "admin";

  const created = await db.$transaction(async (tx) => {
    const results: { id: string; tool_id: string; duplicated?: boolean }[] = [];
    const tagsTakenInBatch = new Map<string, Set<string>>();

    for (const item of items) {
      // Reenvio de operação offline já processada: devolve o registro existente.
      if (item.client_op_id) {
        const existing = await tx.tool_checkouts.findUnique({ where: { client_op_id: item.client_op_id } });
        if (existing) {
          results.push({ id: existing.id, tool_id: existing.tool_id, duplicated: true });
          continue;
        }
      }

      const tool = await tx.tools.findUnique({ where: { id: item.tool_id } });
      if (!tool) throw notFound("Ferramenta não encontrada");

      const userId = item.user_id || actor.id;
      const actingForOther = userId !== actor.id;
      if (actingForOther && !isAdmin) throw forbidden("Você só pode retirar ferramentas em seu próprio nome");

      const responsible = actingForOther
        ? await tx.profiles.findUnique({ where: { id: userId } })
        : actor;
      if (!responsible || !responsible.approved) throw badRequest("Usuário responsável inválido ou não aprovado");

      if (tool.employee_only && responsible.category === "third_party") {
        throw forbidden(`A ferramenta "${tool.name}" é de uso exclusivo de funcionários`);
      }

      const notes = item.notes?.trim() || null;
      if (actingForOther && (!notes || notes.length < MIN_JUSTIFICATION)) {
        throw badRequest("Justificativa obrigatória (mín. 5 caracteres) ao retirar em nome de outro usuário.");
      }

      const site = item.construction_site?.trim() || null;
      if (!site) throw badRequest("Informe a obra de destino");

      const estimated = parseDate(item.estimated_return_date, "estimated_return_date");
      const manualDate = parseDate(item.checkout_date, "checkout_date");
      if (manualDate && !isAdmin) throw forbidden("Somente administradores podem informar data manual");

      // TAG: obrigatória quando a ferramenta tem mais de uma unidade identificada.
      const tags = splitTags(tool.tag);
      let selectedTag = item.selected_tag?.trim() || null;
      if (tags.length > 1) {
        if (!selectedTag) throw badRequest(`Selecione a TAG da ferramenta "${tool.name}"`);
        if (!tags.includes(selectedTag)) throw badRequest(`TAG ${selectedTag} não pertence à ferramenta "${tool.name}"`);
        const inUse = await tx.tool_checkouts.findFirst({
          where: { tool_id: tool.id, status: "checked_out", selected_tag: selectedTag },
          select: { id: true },
        });
        const batchSet = tagsTakenInBatch.get(tool.id) ?? new Set<string>();
        if (inUse || batchSet.has(selectedTag)) {
          throw conflict(`A TAG ${selectedTag} de "${tool.name}" já está em uso`);
        }
        batchSet.add(selectedTag);
        tagsTakenInBatch.set(tool.id, batchSet);
      } else if (tags.length === 1) {
        selectedTag = tags[0];
      } else {
        selectedTag = null;
      }

      // Baixa de estoque atômica: falha se não houver unidade disponível.
      // (O trigger antigo simplesmente ignorava e deixava a retirada passar.)
      const { count } = await tx.tools.updateMany({
        where: { id: tool.id, quantity_available: { gt: 0 } },
        data: { quantity_available: { decrement: 1 } },
      });
      if (count === 0) throw conflict(`A ferramenta "${tool.name}" não está disponível no momento`);

      const checkout = await tx.tool_checkouts.create({
        data: {
          tool_id: tool.id,
          user_id: userId,
          checked_out_by: actor.id,
          status: "checked_out",
          construction_site: site,
          estimated_return_date: estimated,
          notes,
          selected_tag: selectedTag,
          checkout_photo_url: item.checkout_photo_url || null,
          checkout_signature_url: item.checkout_signature_url || null,
          client_op_id: item.client_op_id || null,
          ...(manualDate ? { checkout_date: manualDate } : {}),
        },
      });

      await logAction(
        {
          action: actingForOther ? "manual_checkout_by_admin" : "checkout",
          entity_type: "tool",
          entity_id: tool.id,
          user_id: actor.id,
          user_name: actor.full_name,
          details: {
            tool_name: tool.name,
            construction_site: site,
            selected_tag: selectedTag,
            checkout_id: checkout.id,
            responsible_user_id: userId,
            responsible_user_name: responsible.full_name,
            performed_by_admin: actingForOther,
            admin_name: actingForOther ? actor.full_name : null,
          },
        },
        tx,
      );

      const toolName = tool.name;
      const userName = responsible.full_name;
      const admins = await adminIds(tx, [actor.id]);
      await createNotifications(
        [
          ...admins.map((id) => ({
            user_id: id,
            type: "checkout",
            title: actingForOther ? "Retirada Manual por Admin" : "Ferramenta Retirada",
            message:
              `A ferramenta "${toolName}" foi retirada por ${userName}` +
              (actingForOther ? ` (registrada pelo admin ${actor.full_name}).` : "."),
            tool_id: tool.id,
            checkout_id: checkout.id,
          })),
          {
            user_id: userId,
            type: "checkout",
            title: actingForOther ? "Ferramenta atribuída a você" : "Retirada Registrada",
            message: actingForOther
              ? `O admin ${actor.full_name} retirou a ferramenta "${toolName}" em seu nome. Ela agora está sob sua responsabilidade.`
              : `Sua retirada da ferramenta "${toolName}" foi registrada com sucesso.`,
            tool_id: tool.id,
            checkout_id: checkout.id,
          },
        ],
        tx,
      );

      results.push({ id: checkout.id, tool_id: tool.id });
    }
    return results;
  });

  dispatchPushInBackground();
  return created;
}

export async function checkinToolCheckouts(actor: PublicProfile, ids: string[], input: ToolCheckinInput) {
  if (ids.length === 0) throw badRequest("Nenhuma retirada informada");
  if (ids.length > 100) throw badRequest("Máximo de 100 devoluções por operação");
  const isAdmin = actor.role === "admin";

  const manualDate = parseDate(input.checkin_date, "checkin_date");
  if (manualDate && !isAdmin) {
    // Usuários comuns sempre devolvem com a data/hora do servidor.
    input = { ...input, checkin_date: null };
  }
  const checkinDate = (isAdmin && manualDate) || new Date();
  const notes = input.notes?.trim() || null;

  const result = await db.$transaction(async (tx) => {
    const checkouts = await tx.tool_checkouts.findMany({
      where: { id: { in: ids } },
      include: { tool: { select: { id: true, name: true, quantity_total: true } } },
    });
    if (checkouts.length !== new Set(ids).size) throw notFound("Retirada não encontrada");

    const names = await loadNames(tx, checkouts.map((c) => c.user_id));
    let returned = 0;

    for (const co of checkouts) {
      // Reenvio (ex.: fila offline) de algo já devolvido: ignora sem erro.
      if (co.status === "checked_in") continue;

      const actingForOther = co.user_id !== actor.id;
      if (actingForOther && !isAdmin) throw forbidden("Você só pode devolver ferramentas retiradas por você");
      if (actingForOther && (!notes || notes.length < MIN_JUSTIFICATION)) {
        throw badRequest("Justificativa obrigatória (mín. 5 caracteres) ao devolver em nome de outro usuário.");
      }
      if (checkinDate < co.checkout_date) {
        throw badRequest("A data de devolução não pode ser anterior à retirada");
      }

      // Atualização condicional evita devolução dupla em requisições concorrentes.
      const { count } = await tx.tool_checkouts.updateMany({
        where: { id: co.id, status: "checked_out" },
        data: {
          status: "checked_in",
          checkin_date: checkinDate,
          checked_in_by: actor.id,
          ...(notes ? { notes: co.notes ? `${co.notes} | Devolução: ${notes}` : notes } : {}),
          ...(input.checkin_photo_url ? { checkin_photo_url: input.checkin_photo_url } : {}),
          ...(input.checkin_signature_url ? { checkin_signature_url: input.checkin_signature_url } : {}),
        },
      });
      if (count === 0) continue;

      // Repõe estoque sem ultrapassar o total cadastrado.
      await tx.$executeRaw`
        UPDATE tools
           SET quantity_available = LEAST(quantity_total, quantity_available + 1),
               updated_at = now()
         WHERE id = ${co.tool_id}::uuid`;

      const userName = names.get(co.user_id) ?? "usuário";
      await logAction(
        {
          action: actingForOther ? "manual_checkin_by_admin" : "checkin",
          entity_type: "tool",
          entity_id: co.tool_id,
          user_id: actor.id,
          user_name: actor.full_name,
          details: {
            tool_name: co.tool.name,
            checkout_id: co.id,
            responsible_user_id: co.user_id,
            responsible_user_name: userName,
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
            type: "checkin",
            title: actingForOther ? "Devolução Manual por Admin" : "Ferramenta Devolvida",
            message:
              `A ferramenta "${co.tool.name}" (responsável: ${userName}) foi devolvida` +
              (actingForOther ? ` pelo admin ${actor.full_name}.` : "."),
            tool_id: co.tool_id,
            checkout_id: co.id,
          })),
          {
            user_id: co.user_id,
            type: "checkin",
            title: actingForOther ? "Devolução registrada por Admin" : "Devolução Registrada",
            message: actingForOther
              ? `O admin ${actor.full_name} registrou a devolução da ferramenta "${co.tool.name}" em seu nome.`
              : `Sua devolução da ferramenta "${co.tool.name}" foi registrada com sucesso.`,
            tool_id: co.tool_id,
            checkout_id: co.id,
          },
        ],
        tx,
      );
      returned++;
    }
    return { returned };
  });

  dispatchPushInBackground();
  return result;
}

export async function extendToolReturn(actor: PublicProfile, id: string, newDate: string) {
  const date = parseDate(newDate, "estimated_return_date");
  if (!date) throw badRequest("Informe a nova data de devolução");
  if (date.getTime() < Date.now() - 60_000) throw badRequest("A nova data deve ser no futuro");

  await db.$transaction(async (tx) => {
    const co = await tx.tool_checkouts.findUnique({
      where: { id },
      include: { tool: { select: { name: true } } },
    });
    if (!co) throw notFound("Retirada não encontrada");
    if (co.user_id !== actor.id && actor.role !== "admin") throw forbidden();
    if (co.status !== "checked_out") throw conflict("Esta ferramenta já foi devolvida");

    await tx.tool_checkouts.update({ where: { id }, data: { estimated_return_date: date } });

    const formatted = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const admins = await adminIds(tx, [actor.id]);
    await createNotifications(
      admins.map((adminId) => ({
        user_id: adminId,
        type: "return_extended",
        title: "Devolução Prorrogada",
        message: `O usuário "${actor.full_name}" prorrogou a devolução da ferramenta "${co.tool.name}" para ${formatted}.`,
        tool_id: co.tool_id,
        checkout_id: co.id,
      })),
      tx,
    );
    await logAction(
      {
        action: "return_extended",
        entity_type: "tool",
        entity_id: co.tool_id,
        user_id: actor.id,
        user_name: actor.full_name,
        details: { tool_name: co.tool.name, checkout_id: co.id, new_date: date.toISOString() },
      },
      tx,
    );
  });
  dispatchPushInBackground();
}
