import { db } from "../lib/db.js";

/**
 * Sincroniza o catálogo de ferramentas com a planilha Google (somente leitura
 * da planilha → banco).
 *
 * Colunas B..H: Nome | Descrição | TAG | Marca | Estado | Quantidade | Apenas Funcionários
 *
 * Correções em relação à versão anterior:
 * - Ferramentas que saem da planilha mas têm histórico são ARQUIVADAS (active=false),
 *   não apagadas — o delete antigo apagava em cascata todo o histórico de retiradas.
 * - A disponibilidade nunca fica negativa nem acima do total.
 */

const CONDITION_MAP: Record<string, string> = {
  excelente: "excellent",
  bom: "good",
  regular: "fair",
  ruim: "poor",
  manutenção: "needs_maintenance",
  manutencao: "needs_maintenance",
  excellent: "excellent",
  good: "good",
  fair: "fair",
  poor: "poor",
  needs_maintenance: "needs_maintenance",
};

interface SheetTool {
  name: string;
  description: string | null;
  tag: string | null;
  brand: string | null;
  condition: string | null;
  quantity_total: number | null;
  employee_only: boolean;
}

function parseRows(rows: string[][]): SheetTool[] {
  const seen = new Set<string>();
  const out: SheetTool[] = [];
  for (const row of rows) {
    const name = (row[0] || "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const rawCondition = (row[4] || "").trim().toLowerCase();
    const rawQty = (row[5] || "").trim();
    const qty = parseInt(rawQty, 10);
    out.push({
      name,
      description: (row[1] || "").trim() || null,
      tag: (row[2] || "").trim() || null,
      brand: (row[3] || "").trim() || null,
      condition: rawCondition ? CONDITION_MAP[rawCondition] ?? null : null,
      quantity_total: rawQty === "" || Number.isNaN(qty) ? null : Math.max(0, qty),
      employee_only: ["sim", "yes", "true", "1", "x"].includes((row[6] || "").trim().toLowerCase()),
    });
  }
  return out;
}

export async function syncGoogleSheets() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!apiKey || !sheetId) throw new Error("GOOGLE_SHEETS_API_KEY/GOOGLE_SHEET_ID não configurados");

  const range = process.env.GOOGLE_SHEET_RANGE || "B2:H";
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?key=${encodeURIComponent(apiKey)}`,
  );
  if (!res.ok) throw new Error(`Erro na API do Google Sheets [${res.status}]: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { values?: string[][] };
  const sheetTools = parseRows(json.values ?? []);
  if (sheetTools.length === 0) throw new Error("Planilha vazia — sincronização abortada por segurança");

  const existing = await db.tools.findMany({ orderBy: { created_at: "asc" } });
  const byName = new Map<string, typeof existing>();
  for (const t of existing) {
    const k = t.name.toLowerCase();
    byName.set(k, [...(byName.get(k) ?? []), t]);
  }

  let added = 0;
  let updated = 0;
  let deleted = 0;
  let archived = 0;
  const errors: string[] = [];

  const hasHistory = async (toolId: string) => (await db.tool_checkouts.count({ where: { tool_id: toolId } })) > 0;
  const hasActive = async (toolId: string) =>
    (await db.tool_checkouts.count({ where: { tool_id: toolId, status: "checked_out" } })) > 0;

  /** Remove (sem histórico) ou arquiva (com histórico) uma ferramenta. */
  const retire = async (tool: (typeof existing)[number], label: string) => {
    if (await hasActive(tool.id)) {
      errors.push(`${label} "${tool.name}": possui retiradas ativas, mantida`);
      return;
    }
    if (await hasHistory(tool.id)) {
      if (tool.active) {
        await db.tools.update({ where: { id: tool.id }, data: { active: false } });
        archived++;
      }
    } else {
      await db.tools.delete({ where: { id: tool.id } });
      deleted++;
    }
  };

  for (const st of sheetTools) {
    const group = byName.get(st.name.toLowerCase()) ?? [];
    const current = group[0];
    for (const dup of group.slice(1)) {
      try {
        await retire(dup, "duplicada");
      } catch (e) {
        errors.push(`duplicada "${dup.name}": ${String(e)}`);
      }
    }

    try {
      if (!current) {
        const qty = st.quantity_total ?? 1;
        await db.tools.create({
          data: {
            name: st.name,
            description: st.description,
            tag: st.tag,
            brand: st.brand,
            condition: st.condition ?? "good",
            quantity_total: qty,
            quantity_available: qty,
            employee_only: st.employee_only,
          },
        });
        added++;
        continue;
      }

      const condition = st.condition ?? current.condition;
      const total = st.quantity_total ?? current.quantity_total;
      const inUse = await db.tool_checkouts.count({ where: { tool_id: current.id, status: "checked_out" } });
      const available = Math.max(total - inUse, 0);

      const changed =
        current.description !== st.description ||
        current.tag !== st.tag ||
        current.brand !== st.brand ||
        current.condition !== condition ||
        current.quantity_total !== total ||
        current.quantity_available !== available ||
        current.employee_only !== st.employee_only ||
        !current.active;

      if (changed) {
        await db.tools.update({
          where: { id: current.id },
          data: {
            description: st.description,
            tag: st.tag,
            brand: st.brand,
            condition,
            quantity_total: total,
            quantity_available: available,
            employee_only: st.employee_only,
            active: true,
          },
        });
        updated++;
      }
    } catch (e) {
      errors.push(`"${st.name}": ${String(e)}`);
    }
  }

  const sheetNames = new Set(sheetTools.map((t) => t.name.toLowerCase()));
  for (const tool of existing) {
    if (sheetNames.has(tool.name.toLowerCase())) continue;
    try {
      await retire(tool, "removida da planilha");
    } catch (e) {
      errors.push(`"${tool.name}": ${String(e)}`);
    }
  }

  const summary = { total_sheet_rows: sheetTools.length, added, updated, deleted, archived, errors };
  await db.sync_state.upsert({
    where: { key: "sync-google-sheets" },
    create: { key: "sync-google-sheets", summary },
    update: { last_run_at: new Date(), summary },
  });
  return summary;
}
