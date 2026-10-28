-- Deixa leve a verificação frequente de avisos vencidos (jobs.ts → hasDueWork).
CREATE INDEX IF NOT EXISTS "notifications_checkout_id_type_created_at_idx" ON "notifications"("checkout_id", "type", "created_at");
