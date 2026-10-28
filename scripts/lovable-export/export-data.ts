// Edge Function temporária: exporta os dados para a migração (Vercel + Prisma).
// Protegida pelo segredo EXPORT_SECRET. REMOVA após a migração.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const TABLES: Record<string, string> = {
  profiles: "id",
  tools: "id",
  vehicles: "id",
  construction_sites: "id",
  tool_checkouts: "id",
  vehicle_checkouts: "id",
  vehicle_charging_sessions: "id",
  push_subscriptions: "id",
  notifications: "id",
  system_logs: "id",
  sync_state: "key",
  data_retention_settings: "id",
};
const PAGE = 1000;
const FILE_PAGE = 200;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const secret = Deno.env.get("EXPORT_SECRET");
  if (!secret || secret.length < 20 || req.headers.get("x-export-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const page = Math.max(0, Number(url.searchParams.get("page") || 0));

  try {
    if (kind === "table") {
      const name = url.searchParams.get("name") || "";
      const orderBy = TABLES[name];
      if (!orderBy) return json({ error: "tabela inválida" }, 400);
      const { data, error } = await sb
        .from(name)
        .select("*")
        .order(orderBy, { ascending: true })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      return json({ rows: data ?? [] });
    }

    if (kind === "credentials") {
      const { data, error } = await sb.rpc("export_auth_credentials");
      if (error) throw error;
      return json({ rows: data ?? [] });
    }

    if (kind === "files") {
      const { data, error } = await sb.rpc("export_storage_objects", { _offset: page * FILE_PAGE, _limit: FILE_PAGE });
      if (error) throw error;
      const rows = (data ?? []) as { name: string; owner: string | null; mimetype: string | null; created_at: string }[];
      if (rows.length === 0) return json({ rows: [] });
      const { data: signed, error: signError } = await sb.storage
        .from("imagens")
        .createSignedUrls(rows.map((r) => r.name), 60 * 60 * 6);
      if (signError) throw signError;
      const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      return json({ rows: rows.map((r) => ({ ...r, signed_url: byPath.get(r.name) ?? null })) });
    }

    return json({ error: "kind inválido (use table, credentials ou files)" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
