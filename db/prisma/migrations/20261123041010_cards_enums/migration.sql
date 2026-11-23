-- Spec 004 · valores de enum nuevos. Van en una migración aparte porque PostgreSQL no permite
-- usar un valor de enum en la misma transacción que lo agrega (la migración `cards` inserta
-- la cuenta `system_merchants`).

ALTER TYPE "account_kind" ADD VALUE 'system_merchants';
ALTER TYPE "audit_event_type" ADD VALUE 'CARD_ISSUED';
ALTER TYPE "audit_event_type" ADD VALUE 'CARD_FROZEN';
ALTER TYPE "audit_event_type" ADD VALUE 'CARD_UNFROZEN';
ALTER TYPE "audit_event_type" ADD VALUE 'CARD_CANCELED';
ALTER TYPE "audit_event_type" ADD VALUE 'CARD_REVEALED';
ALTER TYPE "audit_event_type" ADD VALUE 'CARD_PAYMENT_APPROVED';
ALTER TYPE "ledger_transaction_type" ADD VALUE 'card_payment';
