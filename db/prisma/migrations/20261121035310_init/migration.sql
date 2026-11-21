-- CreateEnum
CREATE TYPE "verification_purpose" AS ENUM ('registration', 'password_reset');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('awaiting_code', 'verified', 'completed', 'superseded', 'expired');

-- CreateEnum
CREATE TYPE "session_end_reason" AS ENUM ('logout', 'idle', 'absolute', 'password_reset', 'reuse_detected');

-- CreateEnum
CREATE TYPE "audit_event_type" AS ENUM ('REGISTRATION_STARTED', 'EMAIL_VERIFIED', 'ACCOUNT_CREATED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGIN_LOCKED', 'SESSION_ENDED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED');

-- CreateEnum
CREATE TYPE "email_template" AS ENUM ('verification_code', 'already_registered', 'password_reset_code', 'password_changed');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('pending', 'sent', 'failed', 'discarded');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(254) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_changed_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "policy_version" VARCHAR(20) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_flows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "purpose" "verification_purpose" NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "flow_token_hash" CHAR(64) NOT NULL,
    "status" "verification_status" NOT NULL,
    "code_hash" CHAR(64),
    "code_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "code_attempts" SMALLINT NOT NULL DEFAULT 0,
    "last_code_sent_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "complete_by" TIMESTAMPTZ(6),
    "consent_policy_version" VARCHAR(20),
    "consent_accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verification_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_sends" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(254) NOT NULL,
    "purpose" "verification_purpose" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" CHAR(64) NOT NULL,
    "previous_refresh_token_hash" CHAR(64),
    "rotated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" "session_end_reason",

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(254) NOT NULL,
    "origin_key" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "audit_event_type" NOT NULL,
    "user_id" UUID,
    "email_hash" CHAR(64),
    "request_id" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "to_email" VARCHAR(254) NOT NULL,
    "template" "email_template" NOT NULL,
    "verification_flow_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "outbox_status" NOT NULL,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL,
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_hits" (
    "key" VARCHAR(200) NOT NULL,
    "hits" INTEGER NOT NULL,
    "reset_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "data_consents_user_id_key" ON "data_consents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_flows_flow_token_hash_key" ON "verification_flows"("flow_token_hash");

-- CreateIndex
CREATE INDEX "verification_flows_email_purpose_status_idx" ON "verification_flows"("email", "purpose", "status");

-- CreateIndex
CREATE INDEX "verification_flows_expires_at_idx" ON "verification_flows"("expires_at");

-- CreateIndex
CREATE INDEX "code_sends_email_created_at_idx" ON "code_sends"("email", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_previous_refresh_token_hash_idx" ON "sessions"("previous_refresh_token_hash");

-- CreateIndex
CREATE INDEX "login_attempts_email_origin_key_created_at_idx" ON "login_attempts"("email", "origin_key", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_email_created_at_idx" ON "login_attempts"("email", "created_at");

-- CreateIndex
CREATE INDEX "email_outbox_status_next_attempt_at_idx" ON "email_outbox"("status", "next_attempt_at");

-- AddForeignKey
ALTER TABLE "data_consents" ADD CONSTRAINT "data_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- SQL agregado a mano (tasks.md T019; data-model.md). Prisma no genera estos objetos.
-- =============================================================================

-- AuditEvent: registro inmutable (UPDATE/DELETE por fila y TRUNCATE por sentencia).
CREATE FUNCTION audit_events_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events es inmutable: % no está permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION audit_events_immutable();

CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON "audit_events"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_immutable();

-- Session: sesiones activas por usuario (revocar todas al recuperar la contraseña).
CREATE INDEX "sessions_user_id_active_idx" ON "sessions" ("user_id") WHERE "revoked_at" IS NULL;

-- EmailOutbox: correos de código pendientes por flujo (descartarlos al pedir uno nuevo).
CREATE INDEX "email_outbox_flow_pending_idx" ON "email_outbox" ("verification_flow_id")
  WHERE "status" = 'pending';

-- Rangos: VerificationFlow.code_attempts y EmailOutbox.attempts (0–5).
ALTER TABLE "verification_flows"
  ADD CONSTRAINT "verification_flows_code_attempts_range" CHECK ("code_attempts" BETWEEN 0 AND 5);
ALTER TABLE "email_outbox"
  ADD CONSTRAINT "email_outbox_attempts_range" CHECK ("attempts" BETWEEN 0 AND 5);

-- Consentimiento obligatorio en flujos de registro (FR-002).
ALTER TABLE "verification_flows"
  ADD CONSTRAINT "verification_flows_registration_consent" CHECK (
    "purpose" <> 'registration'
    OR ("consent_policy_version" IS NOT NULL AND "consent_accepted_at" IS NOT NULL)
  );
