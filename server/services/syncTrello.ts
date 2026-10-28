import { db } from "../lib/db.js";

/**
 * Sincroniza as obras (construction_sites) com o Trello.
 *
 * Fonte da verdade: união das listas configuradas em TRELLO_LIST_IDS
 * (padrão: "A Fazer", "Fazendo – Curto Prazo" e "Fazendo – Longo Prazo").
 * Se qualquer consulta ao Trello falhar, nada é alterado.
 * Somente obras criadas pela sincronização (source = "trello") são removidas.
 */

const DEFAULT_LIST_IDS = ["620c56ba85aa9536c3cbc86d", "620c56bd53d96f7e9ac3c1a6", "68ee51cadc1f85da721361b7"];

export async function syncTrello() {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) throw new Error("TRELLO_API_KEY/TRELLO_TOKEN não configurados");

  const listIds = (process.env.TRELLO_LIST_IDS || DEFAULT_LIST_IDS.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const names = new Map<string, string>(); // lower -> nome original
  for (const listId of listIds) {
    const url = `https://api.trello.com/1/lists/${encodeURIComponent(listId)}/cards?fields=name&key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Erro na API do Trello (lista ${listId}) [${res.status}]: ${(await res.text()).slice(0, 200)}`);
    }
    const cards = (await res.json()) as { name: string }[];
    for (const c of cards) {
      const n = c.name?.trim();
      if (n && !names.has(n.toLowerCase())) names.set(n.toLowerCase(), n);
    }
  }

  // Proteção: resposta vazia de todas as listas provavelmente é erro de configuração.
  if (names.size === 0) throw new Error("Nenhuma obra retornada pelo Trello — sincronização abortada por segurança");

  const existing = await db.construction_sites.findMany();
  const byName = new Map(existing.map((s) => [s.name.toLowerCase(), s]));

  let added = 0;
  let reactivated = 0;
  let removed = 0;

  for (const [lower, name] of names) {
    const site = byName.get(lower);
    if (!site) {
      await db.construction_sites.create({ data: { name, active: true, source: "trello" } });
      added++;
    } else if (!site.active) {
      await db.construction_sites.update({ where: { id: site.id }, data: { active: true } });
      reactivated++;
    }
  }

  for (const site of existing) {
    if (site.source === "trello" && !names.has(site.name.toLowerCase())) {
      await db.construction_sites.delete({ where: { id: site.id } });
      removed++;
    }
  }

  const summary = { total_trello_cards: names.size, added, reactivated, deactivated: removed, deleted: removed };
  await db.sync_state.upsert({
    where: { key: "sync-trello" },
    create: { key: "sync-trello", summary },
    update: { last_run_at: new Date(), summary },
  });
  return summary;
}
