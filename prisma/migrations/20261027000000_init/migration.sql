-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_category" AS ENUM ('engemase_employee', 'third_party', 'socios');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'employee', 'third_party');

-- CreateEnum
CREATE TYPE "checkout_status" AS ENUM ('checked_out', 'checked_in');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "full_name" TEXT NOT NULL,
    "company" TEXT,
    "avatar_url" TEXT,
    "category" "user_category" NOT NULL DEFAULT 'engemase_employee',
    "role" "user_role" NOT NULL DEFAULT 'employee',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "first_login" BOOLEAN NOT NULL DEFAULT true,
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT NOT NULL,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "last_sign_in_at" TIMESTAMPTZ(6),
    "last_access_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tools" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "tag" TEXT,
    "qr_code" TEXT,
    "condition" TEXT DEFAULT 'good',
    "quantity_total" INTEGER NOT NULL DEFAULT 0,
    "quantity_available" INTEGER NOT NULL DEFAULT 0,
    "employee_only" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_checkouts" (
    "id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "checkout_status" NOT NULL DEFAULT 'checked_out',
    "checkout_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkin_date" TIMESTAMPTZ(6),
    "estimated_return_date" TIMESTAMPTZ(6),
    "checked_out_by" UUID NOT NULL,
    "checked_in_by" UUID,
    "construction_site" TEXT,
    "selected_tag" TEXT,
    "notes" TEXT,
    "checkout_photo_url" TEXT,
    "checkin_photo_url" TEXT,
    "checkout_signature_url" TEXT,
    "checkin_signature_url" TEXT,
    "client_op_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tool_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "color" TEXT,
    "image_url" TEXT,
    "status" TEXT DEFAULT 'available',
    "vehicle_type" TEXT NOT NULL DEFAULT 'vehicle',
    "is_charging" BOOLEAN NOT NULL DEFAULT false,
    "charging_started_at" TIMESTAMPTZ(6),
    "charging_started_by" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_checkouts" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT DEFAULT 'checked_out',
    "checkout_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkin_date" TIMESTAMPTZ(6),
    "estimated_return_date" TIMESTAMPTZ(6),
    "estimated_return_time" TEXT,
    "checked_out_by" UUID NOT NULL,
    "checked_in_by" UUID,
    "km_checkout" INTEGER NOT NULL,
    "km_checkin" INTEGER,
    "km_checkin_automatic" BOOLEAN DEFAULT false,
    "charges_during_use" INTEGER,
    "refueled" BOOLEAN,
    "destination" TEXT,
    "destination_address" TEXT,
    "purpose" TEXT,
    "notes" TEXT,
    "is_outside_city" BOOLEAN DEFAULT false,
    "origin_address" TEXT,
    "origin_latitude" DOUBLE PRECISION,
    "origin_longitude" DOUBLE PRECISION,
    "estimated_distance_km" DOUBLE PRECISION,
    "estimated_duration_minutes" INTEGER,
    "photo_front_checkout" TEXT,
    "photo_back_checkout" TEXT,
    "photo_left_checkout" TEXT,
    "photo_right_checkout" TEXT,
    "photo_dashboard_checkout" TEXT,
    "photo_control_checkout" TEXT,
    "photo_interior_front_checkout" TEXT,
    "photo_interior_back_checkout" TEXT,
    "photo_wheel_fl_checkout" TEXT,
    "photo_wheel_fr_checkout" TEXT,
    "photo_wheel_rl_checkout" TEXT,
    "photo_wheel_rr_checkout" TEXT,
    "photo_front_checkin" TEXT,
    "photo_back_checkin" TEXT,
    "photo_left_checkin" TEXT,
    "photo_right_checkin" TEXT,
    "photo_dashboard_checkin" TEXT,
    "photo_control_checkin" TEXT,
    "photo_interior_front_checkin" TEXT,
    "photo_interior_back_checkin" TEXT,
    "photo_wheel_fl_checkin" TEXT,
    "photo_wheel_fr_checkin" TEXT,
    "photo_wheel_rl_checkin" TEXT,
    "photo_wheel_rr_checkin" TEXT,
    "client_op_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vehicle_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_charging_sessions" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_by" UUID,
    "ended_at" TIMESTAMPTZ(6),
    "ended_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_charging_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construction_sites" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "construction_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "push_sent" BOOLEAN DEFAULT false,
    "tool_id" UUID,
    "checkout_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "user_id" UUID,
    "user_name" TEXT,
    "details" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_retention_settings" (
    "id" UUID NOT NULL,
    "setting_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "retention_days" INTEGER NOT NULL DEFAULT 90,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_retention_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_state" (
    "key" TEXT NOT NULL,
    "last_run_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" JSONB,

    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "path" TEXT NOT NULL,
    "owner_id" UUID,
    "content_type" TEXT,
    "size" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("path")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" UUID NOT NULL,
    "bucket_key" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");

-- CreateIndex
CREATE UNIQUE INDEX "tools_qr_code_key" ON "tools"("qr_code");

-- CreateIndex
CREATE INDEX "tools_name_idx" ON "tools"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tool_checkouts_client_op_id_key" ON "tool_checkouts"("client_op_id");

-- CreateIndex
CREATE INDEX "tool_checkouts_tool_id_status_idx" ON "tool_checkouts"("tool_id", "status");

-- CreateIndex
CREATE INDEX "tool_checkouts_user_id_status_idx" ON "tool_checkouts"("user_id", "status");

-- CreateIndex
CREATE INDEX "tool_checkouts_checkout_date_idx" ON "tool_checkouts"("checkout_date" DESC);

-- CreateIndex
CREATE INDEX "tool_checkouts_status_estimated_return_date_idx" ON "tool_checkouts"("status", "estimated_return_date");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_key" ON "vehicles"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_checkouts_client_op_id_key" ON "vehicle_checkouts"("client_op_id");

-- CreateIndex
CREATE INDEX "vehicle_checkouts_vehicle_id_status_idx" ON "vehicle_checkouts"("vehicle_id", "status");

-- CreateIndex
CREATE INDEX "vehicle_checkouts_user_id_status_idx" ON "vehicle_checkouts"("user_id", "status");

-- CreateIndex
CREATE INDEX "vehicle_checkouts_checkout_date_idx" ON "vehicle_checkouts"("checkout_date" DESC);

-- CreateIndex
CREATE INDEX "vehicle_charging_sessions_vehicle_id_started_at_idx" ON "vehicle_charging_sessions"("vehicle_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "construction_sites_name_idx" ON "construction_sites"("name");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "notifications_push_sent_idx" ON "notifications"("push_sent");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_user_id_endpoint_key" ON "push_subscriptions"("user_id", "endpoint");

-- CreateIndex
CREATE INDEX "system_logs_created_at_idx" ON "system_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "system_logs_entity_type_entity_id_idx" ON "system_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_retention_settings_setting_key_key" ON "data_retention_settings"("setting_key");

-- CreateIndex
CREATE INDEX "uploaded_files_owner_id_idx" ON "uploaded_files"("owner_id");

-- CreateIndex
CREATE INDEX "uploaded_files_created_at_idx" ON "uploaded_files"("created_at" DESC);

-- CreateIndex
CREATE INDEX "rate_limits_window_start_idx" ON "rate_limits"("window_start");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_bucket_key_window_start_key" ON "rate_limits"("bucket_key", "window_start");

-- AddForeignKey
ALTER TABLE "tool_checkouts" ADD CONSTRAINT "tool_checkouts_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_checkouts" ADD CONSTRAINT "tool_checkouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_checkouts" ADD CONSTRAINT "tool_checkouts_checked_out_by_fkey" FOREIGN KEY ("checked_out_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_checkouts" ADD CONSTRAINT "tool_checkouts_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_checkouts" ADD CONSTRAINT "vehicle_checkouts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_checkouts" ADD CONSTRAINT "vehicle_checkouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_checkouts" ADD CONSTRAINT "vehicle_checkouts_checked_out_by_fkey" FOREIGN KEY ("checked_out_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_checkouts" ADD CONSTRAINT "vehicle_checkouts_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_charging_sessions" ADD CONSTRAINT "vehicle_charging_sessions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Configurações padrão de retenção de dados
INSERT INTO "data_retention_settings" ("id", "setting_key", "label", "description", "retention_days", "enabled", "updated_at") VALUES
  (gen_random_uuid(), 'tool_checkout_photos', 'Fotos de Ferramentas', 'Fotos e assinaturas de retirada e devolução de ferramentas', 180, false, now()),
  (gen_random_uuid(), 'vehicle_checkout_photos', 'Fotos de Veículos', 'Fotos de retirada e devolução de veículos (todos os ângulos)', 180, false, now()),
  (gen_random_uuid(), 'tool_checkout_history', 'Histórico de Ferramentas', 'Registros de retirada/devolução de ferramentas já devolvidas', 365, false, now()),
  (gen_random_uuid(), 'vehicle_checkout_history', 'Histórico de Veículos', 'Registros de retirada/devolução de veículos já devolvidos', 365, false, now()),
  (gen_random_uuid(), 'notifications', 'Notificações', 'Notificações lidas pelos usuários', 30, true, now()),
  (gen_random_uuid(), 'system_logs', 'Logs do Sistema', 'Registros de auditoria e logs de ações', 365, false, now())
ON CONFLICT ("setting_key") DO NOTHING;
