import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

// Reaproveita a instância entre invocações quentes da função (e entre
// recarregamentos do `tsx watch` em desenvolvimento).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("DATABASE_URL não configurada");
  }
  // O driver pg já trata sslmode=require/prefer/verify-ca como verify-full e avisa
  // isso a cada conexão; deixar explícito mantém o comportamento e limpa o log.
  const connectionString = url.replace(/([?&]sslmode=)(require|prefer|verify-ca)\b/, "$1verify-full");
  const adapter = new PrismaPg({ connectionString, max: 5 });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();
globalForPrisma.prisma = db;

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
export { Prisma } from "../generated/prisma/client.js";
