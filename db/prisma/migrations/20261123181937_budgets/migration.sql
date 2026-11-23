-- Spec 006 · presupuesto mensual por categorías (data-model.md).

-- CreateEnum
CREATE TYPE "budget_category" AS ENUM ('food', 'books', 'transport', 'stationery', 'entertainment', 'transfers', 'other');

-- AlterEnum
ALTER TYPE "email_template" ADD VALUE 'budget_alert';

-- CreateTable
CREATE TABLE "budget_limits" (
    "user_id" UUID NOT NULL,
    "category" "budget_category" NOT NULL,
    "effective_month" CHAR(7) NOT NULL,
    "monthly_limit" BIGINT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "budget_limits_pkey" PRIMARY KEY ("user_id","category","effective_month")
);

-- CreateTable
CREATE TABLE "transfer_categories" (
    "transaction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" "budget_category" NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transfer_categories_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "budget_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "month" CHAR(7) NOT NULL,
    "category" "budget_category" NOT NULL,
    "threshold" SMALLINT NOT NULL,
    "spent" BIGINT NOT NULL,
    "monthly_limit" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "seen_at" TIMESTAMPTZ(6),

    CONSTRAINT "budget_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transfer_categories_user_id_idx" ON "transfer_categories"("user_id");

-- CreateIndex
CREATE INDEX "budget_alerts_user_id_month_created_at_idx" ON "budget_alerts"("user_id", "month", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "budget_alerts_user_id_month_category_threshold_key" ON "budget_alerts"("user_id", "month", "category", "threshold");

-- AddForeignKey
ALTER TABLE "budget_limits" ADD CONSTRAINT "budget_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_categories" ADD CONSTRAINT "transfer_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_categories" ADD CONSTRAINT "transfer_categories_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_alerts" ADD CONSTRAINT "budget_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- SQL agregado a mano (spec 006, tasks.md T006; data-model.md).
-- =============================================================================

ALTER TABLE "budget_limits"
  ADD CONSTRAINT "budget_limits_effective_month_format"
    CHECK ("effective_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "budget_limits_monthly_limit_range"
    CHECK ("monthly_limit" IS NULL OR "monthly_limit" BETWEEN 1000 AND 50000000);

ALTER TABLE "budget_alerts"
  ADD CONSTRAINT "budget_alerts_month_format" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ADD CONSTRAINT "budget_alerts_threshold" CHECK ("threshold" IN (80, 100));
