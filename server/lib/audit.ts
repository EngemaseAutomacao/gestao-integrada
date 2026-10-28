import type { Prisma } from "../generated/prisma/client.js";
import { db, type Tx } from "./db.js";

export interface LogEntry {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  details?: Record<string, unknown>;
}

/** Registra uma ação em `system_logs` (equivale aos antigos triggers de auditoria). */
export async function logAction(entry: LogEntry, tx?: Tx) {
  try {
    await (tx ?? db).system_logs.create({
      data: {
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id ?? null,
        user_id: entry.user_id ?? null,
        user_name: entry.user_name ?? null,
        details: (entry.details ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Dentro de transação o erro precisa propagar; fora dela, log não pode quebrar a ação.
    if (tx) throw err;
    console.error("[audit] falha ao registrar log:", err);
  }
}
