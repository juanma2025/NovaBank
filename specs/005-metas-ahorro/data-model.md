# Data Model: Metas de ahorro

**Feature**: `005-metas-ahorro` · **Date**: 2026-11-23 · **Plan**: [plan.md](plan.md)

Convenciones de las specs 001–004: `snake_case`, UUID, `timestamptz` UTC, dinero en `BIGINT` y en
pesos enteros.

| Cambio | Tabla | Módulo dueño |
| :--- | :--- | :--- |
| Nueva | `savings_goals` | `savings` |
| Valores de enum nuevos | `account_kind`, `ledger_transaction_type`, `audit_event_type` | `accounts`, `ledger`, `lib/audit` |
| `CHECK` ampliado | `accounts` (saldo no negativo también en `savings_goal`) | `accounts` |

---

## SavingsGoal (`savings_goals`) — spec: «Meta de ahorro»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL; FK → `users.id`; índice |
| `account_id` | uuid | NOT NULL; UNIQUE; FK → `accounts.id` (subcuenta `savings_goal`, research R2) |
| `name` | varchar(40) | NOT NULL; 1–40 caracteres tras recortar espacios (FR-001) |
| `target_amount` | bigint | NOT NULL; `CHECK (target_amount BETWEEN 1000 AND 100000000)` |
| `target_date` | date | NULL; ≥ hoy en Bogotá al crear o cambiar (validado en el backend, research R8) |
| `status` | `savings_goal_status` | NOT NULL; `active` \| `closed` |
| `closing_transaction_id` | uuid | NULL; UNIQUE; FK → `ledger_transactions.id`; la devolución al cerrar, si hubo saldo (research R7) |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |
| `closed_at` | timestamptz | NULL; `CHECK ((status = 'closed') = (closed_at IS NOT NULL))` |

**Reglas**:
- Máximo 5 metas con `status = 'active'` por `user_id`, verificado dentro de una transacción que
  bloquea la cuenta principal del estudiante (research R4).
- Una meta cerrada no cambia más; ninguna meta se borra. Un trigger rechaza cualquier `UPDATE` cuyo
  `OLD.status` sea `closed`, cualquier cambio de `id`, `user_id`, `account_id` o `created_at`, y
  cualquier `DELETE`.
- **Índice**: `(user_id, status, created_at)` para listar y contar las activas.

## Account (`accounts`, spec 002) — cambios

- `account_kind` agrega `savings_goal`. Cada meta tiene una fila de este tipo, sin `user_id`
  (research R2). Su saldo se materializa como el de la cuenta principal.
- El `CHECK` `accounts_student_balance_non_negative` se reemplaza por
  `CHECK (kind NOT IN ('student', 'savings_goal') OR balance >= 0)`.

## LedgerTransaction (`ledger_transactions`, spec 002) — cambios

- `ledger_transaction_type` agrega `savings_deposit` y `savings_withdrawal`. `account_id` es siempre la
  cuenta principal del estudiante (research R3).

**Aporte de $50.000 a «Viaje a Santa Marta»** (ejemplo):

| account | amount | description |
| :--- | :--- | :--- |
| cuenta principal | `-50000` | Aporte a Viaje a Santa Marta |
| subcuenta de la meta | `+50000` | Aporte desde tu cuenta |

## Movement (vista, spec 002) — cambio

| Campo de la API | Origen |
| :--- | :--- |
| `type` | ahora también `savings_deposit` o `savings_withdrawal` |

## AuditEvent (`audit_events`, spec 001) — cambios

| Valor | `metadata` |
| :--- | :--- |
| `GOAL_CREATED` | `{ goalId }` |
| `GOAL_CLOSED` | `{ goalId, returnedAmount, transactionId }` (`transactionId` nulo si no había saldo) |
| `SAVINGS_DEPOSIT` | `{ goalId, amount, transactionId }` |
| `SAVINGS_WITHDRAWAL` | `{ goalId, amount, transactionId }` |

Sin el nombre de la meta (puede contener datos personales).
