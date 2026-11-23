-- Spec 004 · tarjeta virtual y tienda demo (data-model.md).

-- CreateEnum
CREATE TYPE "card_status" AS ENUM ('active', 'frozen', 'canceled');

-- CreateEnum
CREATE TYPE "merchant_category" AS ENUM ('food', 'books', 'transport', 'stationery', 'entertainment');

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "nickname" VARCHAR(30) NOT NULL,
    "last4" CHAR(4) NOT NULL,
    "pan_encrypted" BYTEA NOT NULL,
    "pan_hash" CHAR(64) NOT NULL,
    "exp_month" SMALLINT NOT NULL,
    "exp_year" SMALLINT NOT NULL,
    "status" "card_status" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "canceled_at" TIMESTAMPTZ(6),

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "card_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "merchant_id" VARCHAR(40) NOT NULL,
    "merchant_name" VARCHAR(60) NOT NULL,
    "category" "merchant_category" NOT NULL,
    "amount" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "card_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_payment_declines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "card_payment_declines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cards_pan_hash_key" ON "cards"("pan_hash");

-- CreateIndex
CREATE INDEX "cards_user_id_created_at_idx" ON "cards"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "card_payments_transaction_id_key" ON "card_payments"("transaction_id");

-- CreateIndex
CREATE INDEX "card_payments_card_id_created_at_id_idx" ON "card_payments"("card_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "card_payment_declines_user_id_created_at_idx" ON "card_payment_declines"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payments" ADD CONSTRAINT "card_payments_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payments" ADD CONSTRAINT "card_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payment_declines" ADD CONSTRAINT "card_payment_declines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- SQL agregado a mano (spec 004, tasks.md T008; data-model.md; research R3, R5 y R8).
-- =============================================================================

-- Card: últimos 4 solo dígitos, mes válido y canceled_at presente solo si está cancelada.
ALTER TABLE "cards"
  ADD CONSTRAINT "cards_last4_digits" CHECK ("last4" ~ '^[0-9]{4}$'),
  ADD CONSTRAINT "cards_exp_month_range" CHECK ("exp_month" BETWEEN 1 AND 12),
  ADD CONSTRAINT "cards_canceled_at_matches_status"
    CHECK (("status" = 'canceled') = ("canceled_at" IS NOT NULL));

-- Card: una tarjeta cancelada no cambia más; sus datos de emisión nunca cambian; no se borran.
CREATE FUNCTION cards_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'cards: % no está permitido', TG_OP;
  END IF;
  IF OLD.status = 'canceled' THEN
    RAISE EXCEPTION 'cards: una tarjeta cancelada no puede cambiar';
  END IF;
  IF (NEW.id, NEW.user_id, NEW.last4, NEW.pan_encrypted, NEW.pan_hash, NEW.exp_month, NEW.exp_year, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.user_id, OLD.last4, OLD.pan_encrypted, OLD.pan_hash, OLD.exp_month, OLD.exp_year, OLD.created_at) THEN
    RAISE EXCEPTION 'cards: los datos de emisión no pueden cambiar';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cards_guard_update_delete
  BEFORE UPDATE OR DELETE ON "cards"
  FOR EACH ROW EXECUTE FUNCTION cards_guard();

-- CardPayment: monto positivo e inmutable, como el libro contable.
ALTER TABLE "card_payments" ADD CONSTRAINT "card_payments_amount_positive" CHECK ("amount" > 0);

CREATE FUNCTION card_payments_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'card_payments es inmutable: % no está permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER card_payments_no_update_delete
  BEFORE UPDATE OR DELETE ON "card_payments"
  FOR EACH ROW EXECUTE FUNCTION card_payments_immutable();

CREATE TRIGGER card_payments_no_truncate
  BEFORE TRUNCATE ON "card_payments"
  FOR EACH STATEMENT EXECUTE FUNCTION card_payments_immutable();

-- Exactamente una cuenta técnica para los comercios simulados (research R5).
CREATE UNIQUE INDEX "accounts_single_system_merchants" ON "accounts" ("kind") WHERE "kind" = 'system_merchants';
INSERT INTO "accounts" ("kind", "currency", "balance", "status", "created_at")
VALUES ('system_merchants', 'COP', 0, 'active', now());
