import { serve } from "@hono/node-server";
import { app } from "./app.js";

// Servidor da API para desenvolvimento local. O Vite (porta 8080) faz proxy de /api para cá.
const port = Number(process.env.API_PORT || 3001);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API em http://localhost:${port}/api`);
});
