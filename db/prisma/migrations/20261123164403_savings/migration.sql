-- Spec 005 · metas de ahorro (data-model.md).

-- CreateEnum
CREATE TYPE "savings_goal_status" AS ENUM ('active', 'closed');

-- CreateTable
CREATE TABLE "savings_goals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "target_amount" BIGINT NOT NULL,
    "target_date" DATE,
    "status" "savings_goal_status" NOT NULL,
    "closing_transaction_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "savings_goals_account_id_key" ON "savings_goals"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "savings_goals_closing_transaction_id_key" ON "savings_goals"("closing_transaction_id");

-- CreateIndex
CREATE INDEX "savings_goals_user_id_status_created_at_idx" ON "savings_goals"("user_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_closing_transaction_id_fkey" FOREIGN KEY ("closing_transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- SQL agregado a mano (spec 005, tasks.md T008; data-model.md; research R2).
-- =============================================================================

-- SavingsGoal: objetivo en rango y closed_at presente solo si está cerrada.
ALTER TABLE "savings_goals"
  ADD CONSTRAINT "savings_goals_target_amount_range" CHECK ("target_amount" BETWEEN 1000 AND 100000000),
  ADD CONSTRAINT "savings_goals_closed_at_matches_status"
    CHECK (("status" = 'closed') = ("closed_at" IS NOT NULL));

-- SavingsGoal: una meta cerrada no cambia más; su identidad nunca cambia; no se borran.
CREATE FUNCTION savings_goals_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'savings_goals: % no está permitido', TG_OP;
  END IF;
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'savings_goals: una meta cerrada no puede cambiar';
  END IF;
  IF (NEW.id, NEW.user_id, NEW.account_id, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.user_id, OLD.account_id, OLD.created_at) THEN
    RAISE EXCEPTION 'savings_goals: la identidad de la meta no puede cambiar';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER savings_goals_guard_update_delete
  BEFORE UPDATE OR DELETE ON "savings_goals"
  FOR EACH ROW EXECUTE FUNCTION savings_goals_guard();

-- Account: el saldo materializado de las subcuentas de metas tampoco puede ser negativo (R2).
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_student_balance_non_negative";
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_balance_non_negative"
  CHECK ("kind" NOT IN ('student', 'savings_goal') OR "balance" >= 0);
