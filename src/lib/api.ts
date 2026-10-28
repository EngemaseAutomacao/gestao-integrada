/**
 * Cliente HTTP da API própria (/api), que substitui o cliente do Supabase.
 * A sessão é um cookie httpOnly, então não há token para guardar no navegador.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query) {
  const url = `/api${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = { "X-Requested-With": "engemase" };
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : null) || `Erro ${res.status}`;
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("engemase:unauthorized"));
    }
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export const api = {
  get: <T = unknown>(path: string, query?: Query) => request<T>("GET", path, undefined, query),
  post: <T = unknown>(path: string, body?: unknown, query?: Query) => request<T>("POST", path, body ?? {}, query),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  put: <T = unknown>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  delete: <T = unknown>(path: string, query?: Query) => request<T>("DELETE", path, undefined, query),
};

/** URL para exibir uma imagem guardada (path relativo, ex.: "veiculos/saidas/...jpg"). */
export function fileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const clean = path.replace(/^\/+/, "");
  return `/api/files/${clean.split("/").map(encodeURIComponent).join("/")}`;
}
