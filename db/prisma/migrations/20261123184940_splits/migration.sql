-- Spec 007 · gastos compartidos (data-model.md).

-- CreateEnum
CREATE TYPE "split_status" AS ENUM ('open', 'completed', 'canceled');

-- CreateEnum
CREATE TYPE "split_share_status" AS ENUM ('pending', 'paid', 'paid_outside', 'declined', 'canceled');

-- AlterEnum
ALTER TYPE "email_template" ADD VALUE 'split_invitation';
ALTER TYPE "email_template" ADD VALUE 'split_reminder';
ALTER TYPE "email_template" ADD VALUE 'split_paid';

-- CreateTable
CREATE TABLE "splits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creator_user_id" UUID NOT NULL,
    "title" VARCHAR(60) NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "creator_share" BIGINT NOT NULL,
    "status" "split_status" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_shares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "split_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "split_share_status" NOT NULL,
    "transfer_transaction_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "last_reminded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "split_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "splits_creator_user_id_created_at_idx" ON "splits"("creator_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "split_shares_transfer_transaction_id_key" ON "split_shares"("transfer_transaction_id");

-- CreateIndex
CREATE INDEX "split_shares_user_id_status_idx" ON "split_shares"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "split_shares_split_id_user_id_key" ON "split_shares"("split_id", "user_id");

-- AddForeignKey
ALTER TABLE "splits" ADD CONSTRAINT "splits_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_shares" ADD CONSTRAINT "split_shares_split_id_fkey" FOREIGN KEY ("split_id") REFERENCES "splits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_shares" ADD CONSTRAINT "split_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_shares" ADD CONSTRAINT "split_shares_transfer_transaction_id_fkey" FOREIGN KEY ("transfer_transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- SQL agregado a mano (spec 007, tasks.md T007; data-model.md; research R5).
-- =============================================================================

ALTER TABLE "splits"
  ADD CONSTRAINT "splits_total_amount_range" CHECK ("total_amount" BETWEEN 2000 AND 5000000),
  ADD CONSTRAINT "splits_creator_share_non_negative" CHECK ("creator_share" >= 0),
  ADD CONSTRAINT "splits_closed_at_matches_status" CHECK (("status" = 'open') = ("closed_at" IS NULL));

ALTER TABLE "split_shares"
  ADD CONSTRAINT "split_shares_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "split_shares_paid_has_transfer"
    CHECK (("status" = 'paid') = ("transfer_transaction_id" IS NOT NULL)),
  ADD CONSTRAINT "split_shares_resolved_at_matches_status"
    CHECK (("status" = 'pending') = ("resolved_at" IS NULL));

-- Split: una división cerrada no vuelve a abrirse ni cambia; no se borran.
CREATE FUNCTION splits_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'splits: % no está permitido', TG_OP;
  END IF;
  IF OLD.status <> 'open' THEN
    RAISE EXCEPTION 'splits: una división cerrada no puede cambiar';
  END IF;
  IF (NEW.id, NEW.creator_user_id, NEW.title, NEW.total_amount, NEW.creator_share, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.creator_user_id, OLD.title, OLD.total_amount, OLD.creator_share, OLD.created_at) THEN
    RAISE EXCEPTION 'splits: los datos de la división no pueden cambiar';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER splits_guard_update_delete
  BEFORE UPDATE OR DELETE ON "splits"
  FOR EACH ROW EXECUTE FUNCTION splits_guard();

-- SplitShare: solo sale de pending y nunca vuelve; monto y participante fijos; no se borran.
-- last_reminded_at puede cambiar mientras está pendiente (recordatorios).
CREATE FUNCTION split_shares_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'split_shares: % no está permitido', TG_OP;
  END IF;
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'split_shares: una parte resuelta no puede cambiar';
  END IF;
  IF (NEW.id, NEW.split_id, NEW.user_id, NEW.amount, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.split_id, OLD.user_id, OLD.amount, OLD.created_at) THEN
    RAISE EXCEPTION 'split_shares: los datos de la parte no pueden cambiar';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER split_shares_guard_update_delete
  BEFORE UPDATE OR DELETE ON "split_shares"
  FOR EACH ROW EXECUTE FUNCTION split_shares_guard();
