import { defineConfig } from "prisma/config";

// Variáveis de ambiente: na Vercel já vêm definidas; localmente use `.env`
// (os scripts npm carregam com `--env-file-if-exists=.env`).
try {
  process.loadEnvFile?.(".env");
} catch {
  // .env é opcional
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
