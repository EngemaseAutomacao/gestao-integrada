/**
 * Build da Vercel: gera o Prisma Client, aplica as migrations (se houver banco
 * configurado) e gera o frontend.
 */
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

run("npx prisma generate");
if (dbUrl) {
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = dbUrl;
  run("npx prisma migrate deploy");
} else {
  console.warn(
    "\n⚠️  DATABASE_URL não configurada: migrations NÃO aplicadas.\n" +
      "   Conecte um Prisma Postgres ao projeto (Storage) e faça um novo deploy.\n",
  );
}
run("npx vite build");
