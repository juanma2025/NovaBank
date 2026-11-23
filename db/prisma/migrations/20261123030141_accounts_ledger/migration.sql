-- CreateEnum
CREATE TYPE "account_kind" AS ENUM ('student', 'system_topups');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('active');

-- CreateEnum
CREATE TYPE "ledger_transaction_type" AS ENUM ('topup');

-- CreateEnum
CREATE TYPE "ledger_transaction_status" AS ENUM ('pending', 'completed', 'failed', 'reversed');

-- AlterEnum
ALTER TYPE "audit_event_type" ADD VALUE 'TOPUP_COMPLETED';

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" "account_kind" NOT NULL,
    "user_id" UUID,
    "currency" CHAR(3) NOT NULL DEFAULT 'COP',
    "balance" BIGINT NOT NULL DEFAULT 0,
    "status" "account_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ledger_transaction_type" NOT NULL,
    "status" "ledger_transaction_status" NOT NULL,
    "account_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "description" VARCHAR(140) NOT NULL,
    "reversal_of" UUID,
    "request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "scope" VARCHAR(40) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response_status" SMALLINT,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_key" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_account_id_type_created_at_idx" ON "ledger_transactions"("account_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_created_at_id_idx" ON "ledger_entries"("account_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_scope_key_key" ON "idempotency_keys"("user_id", "scope", "key");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_reversal_of_fkey" FOREIGN KEY ("reversal_of") REFERENCES "ledger_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- SQL agregado a mano (spec 002, tasks.md T009; data-model.md; research R2 y R3).
-- =============================================================================

-- Account: moneda, dueño obligatorio para estudiantes y saldo nunca negativo (solo estudiantes).
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_currency_cop" CHECK ("currency" = 'COP'),
  ADD CONSTRAINT "accounts_student_has_user" CHECK ("kind" <> 'student' OR "user_id" IS NOT NULL),
  ADD CONSTRAINT "accounts_student_balance_non_negative" CHECK ("kind" <> 'student' OR "balance" >= 0);

-- Exactamente una cuenta del sistema para las recargas simuladas.
CREATE UNIQUE INDEX "accounts_single_system_topups" ON "accounts" ("kind") WHERE "kind" = 'system_topups';
INSERT INTO "accounts" ("kind", "currency", "balance", "status", "created_at")
VALUES ('system_topups', 'COP', 0, 'active', now());

-- LedgerTransaction.amount > 0 y LedgerEntry.amount <> 0.
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_amount_non_zero" CHECK ("amount" <> 0);

-- Doble entrada: al CONFIRMAR, cada operación tiene al menos 2 asientos y suman cero (FR-005).
CREATE FUNCTION ledger_check_balanced() RETURNS trigger AS $$
DECLARE
  tx_id uuid;
  n integer;
  total bigint;
BEGIN
  IF TG_TABLE_NAME = 'ledger_transactions' THEN
    tx_id := NEW.id;
  ELSE
    tx_id := NEW.transaction_id;
  END IF;
  SELECT count(*), COALESCE(sum(amount), 0) INTO n, total FROM ledger_entries WHERE transaction_id = tx_id;
  IF n < 2 OR total <> 0 THEN
    RAISE EXCEPTION 'libro contable desbalanceado en la operación % (asientos: %, suma: %)', tx_id, n, total;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entries_balanced
  AFTER INSERT ON "ledger_entries" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_check_balanced();

CREATE CONSTRAINT TRIGGER ledger_transactions_balanced
  AFTER INSERT ON "ledger_transactions" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_check_balanced();

-- Asientos inmutables (FR-006).
CREATE FUNCTION ledger_entries_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries es inmutable: % no está permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_no_update_delete
  BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();

CREATE TRIGGER ledger_entries_no_truncate
  BEFORE TRUNCATE ON "ledger_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION ledger_entries_immutable();

-- Operaciones: solo cambian status/completed_at y solo desde pending (FR-007, regla de dominio 7).
CREATE FUNCTION ledger_transactions_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'ledger_transactions: % no está permitido', TG_OP;
  END IF;
  IF OLD.status <> 'pending' OR NEW.status NOT IN ('completed', 'failed', 'reversed') THEN
    RAISE EXCEPTION 'transición de estado no permitida: % -> %', OLD.status, NEW.status;
  END IF;
  IF (NEW.id, NEW.type, NEW.account_id, NEW.amount, NEW.description, NEW.reversal_of, NEW.request_id, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.type, OLD.account_id, OLD.amount, OLD.description, OLD.reversal_of, OLD.request_id, OLD.created_at) THEN
    RAISE EXCEPTION 'ledger_transactions: solo status y completed_at pueden cambiar';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_transactions_guard_update_delete
  BEFORE UPDATE OR DELETE ON "ledger_transactions"
  FOR EACH ROW EXECUTE FUNCTION ledger_transactions_guard();

CREATE TRIGGER ledger_transactions_no_truncate
  BEFORE TRUNCATE ON "ledger_transactions"
  FOR EACH STATEMENT EXECUTE FUNCTION ledger_entries_immutable();
