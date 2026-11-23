-- Spec 003 · transferencias y alias (data-model.md).

-- AlterEnum
ALTER TYPE "audit_event_type" ADD VALUE 'TRANSFER_COMPLETED';
ALTER TYPE "audit_event_type" ADD VALUE 'ALIAS_CHANGED';

-- AlterEnum
ALTER TYPE "ledger_transaction_type" ADD VALUE 'transfer';

-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "description" VARCHAR(140);

-- AlterTable
ALTER TABLE "ledger_transactions" ADD COLUMN     "counterparty_account_id" UUID,
ADD COLUMN     "note" VARCHAR(140);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "alias" VARCHAR(20),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_alias_key" ON "profiles"("alias");

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_counterparty_account_id_fkey" FOREIGN KEY ("counterparty_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Reglas que Prisma no expresa (data-model.md)
-- ---------------------------------------------------------------------------

-- Profile.alias: formato normalizado (FR-015). Igual a ALIAS_PATTERN de @nova/shared.
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_alias_format"
  CHECK ("alias" IS NULL OR "alias" ~ '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$');

-- LedgerTransaction.counterparty_account_id: obligatoria y distinta del emisor en una transferencia.
-- Se compara como texto porque PostgreSQL no permite usar un valor de enum en la misma transacción
-- que lo agrega.
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_transfer_counterparty"
  CHECK ("type"::text <> 'transfer'
         OR ("counterparty_account_id" IS NOT NULL AND "counterparty_account_id" <> "account_id"));

-- Máquina de estados (spec 002): counterparty_account_id y note tampoco pueden cambiar.
CREATE OR REPLACE FUNCTION ledger_transactions_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'ledger_transactions: % no está permitido', TG_OP;
  END IF;
  IF OLD.status <> 'pending' OR NEW.status NOT IN ('completed', 'failed', 'reversed') THEN
    RAISE EXCEPTION 'transición de estado no permitida: % -> %', OLD.status, NEW.status;
  END IF;
  IF (NEW.id, NEW.type, NEW.account_id, NEW.amount, NEW.description, NEW.reversal_of, NEW.request_id,
      NEW.created_at, NEW.counterparty_account_id, NEW.note)
     IS DISTINCT FROM
     (OLD.id, OLD.type, OLD.account_id, OLD.amount, OLD.description, OLD.reversal_of, OLD.request_id,
      OLD.created_at, OLD.counterparty_account_id, OLD.note) THEN
    RAISE EXCEPTION 'ledger_transactions: solo status y completed_at pueden cambiar';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
