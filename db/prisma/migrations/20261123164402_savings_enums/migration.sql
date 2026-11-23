-- Spec 005 · valores de enum nuevos. Van en una migración aparte porque PostgreSQL no permite
-- usar un valor de enum en la misma transacción que lo agrega (la migración `savings` lo usa en
-- el CHECK de saldo de `accounts`).

ALTER TYPE "account_kind" ADD VALUE 'savings_goal';
ALTER TYPE "audit_event_type" ADD VALUE 'GOAL_CREATED';
ALTER TYPE "audit_event_type" ADD VALUE 'GOAL_CLOSED';
ALTER TYPE "audit_event_type" ADD VALUE 'SAVINGS_DEPOSIT';
ALTER TYPE "audit_event_type" ADD VALUE 'SAVINGS_WITHDRAWAL';
ALTER TYPE "ledger_transaction_type" ADD VALUE 'savings_deposit';
ALTER TYPE "ledger_transaction_type" ADD VALUE 'savings_withdrawal';
