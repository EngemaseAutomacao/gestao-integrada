import { app } from "../server/app.js";

/**
 * Função serverless única da Vercel para toda a API. O vercel.json reescreve
 * /api/* para cá; o caminho original segue em `?__path=` como garantia.
 */
function handle(request: Request) {
  const url = new URL(request.url);
  const original = url.searchParams.get("__path");
  if (original !== null && !url.pathname.startsWith("/api/")) {
    url.searchParams.delete("__path");
    url.pathname = `/api/${original}`;
    request = new Request(url, request);
  } else if (original !== null) {
    url.searchParams.delete("__path");
    request = new Request(url, request);
  }
  return app.fetch(request);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
