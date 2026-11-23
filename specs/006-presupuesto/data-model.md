# Data Model: Presupuesto mensual por categorías

**Feature**: `006-presupuesto` · **Date**: 2026-11-23 · **Plan**: [plan.md](plan.md)

Convenciones de las specs 001–005: `snake_case`, UUID, `timestamptz` UTC, dinero en `BIGINT` y en
pesos enteros. Los meses se guardan como texto `AAAA-MM` (mes calendario de Bogotá).

| Cambio | Tabla | Módulo dueño |
| :--- | :--- | :--- |
| Nueva | `budget_limits` | `budgets` |
| Nueva | `transfer_categories` | `budgets` |
| Nueva | `budget_alerts` | `budgets` |
| Enum nuevo | `budget_category` | `budgets` |
| Valor de enum nuevo | `email_template` (`budget_alert`) | `lib/mail` |

`budget_category`: `food`, `books`, `transport`, `stationery`, `entertainment`, `transfers`, `other`
(FR-001).

---

## BudgetLimit (`budget_limits`) — spec: «Tope de categoría»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `user_id` | uuid | PK (1/3); FK → `users.id` |
| `category` | `budget_category` | PK (2/3) |
| `effective_month` | char(7) | PK (3/3); `CHECK (effective_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')` |
| `monthly_limit` | bigint | NULL = sin tope desde ese mes; si no, `CHECK (monthly_limit BETWEEN 1000 AND 50000000)` |
| `updated_at` | timestamptz | NOT NULL |

**Regla**: el tope de una categoría en el mes `M` es la fila con el mayor `effective_month ≤ M`
(research R4).

## TransferCategory (`transfer_categories`) — spec: «Clasificación de transferencia»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `transaction_id` | uuid | PK; FK → `ledger_transactions.id` |
| `user_id` | uuid | NOT NULL; FK → `users.id`; índice |
| `category` | `budget_category` | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

**Regla**: solo para transferencias **enviadas** por `user_id` (lo verifica el servicio con
`ledger`). Sin fila, la transferencia cuenta en `transfers`.

## BudgetAlert (`budget_alerts`) — spec: «Alerta»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL; FK → `users.id` |
| `month` | char(7) | NOT NULL; mismo formato que `BudgetLimit.effective_month` |
| `category` | `budget_category` | NOT NULL |
| `threshold` | smallint | NOT NULL; `CHECK (threshold IN (80, 100))` |
| `spent` | bigint | NOT NULL; lo gastado al crear la alerta |
| `monthly_limit` | bigint | NOT NULL; el tope al crear la alerta |
| `created_at` | timestamptz | NOT NULL |
| `seen_at` | timestamptz | NULL hasta que la estudiante la ve |

**Reglas**: `UNIQUE (user_id, month, category, threshold)`: una alerta por umbral, categoría y mes
(research R5). **Índice**: `(user_id, month, created_at)`.

## EmailOutbox (`email_outbox`, spec 001) — cambio

`email_template` agrega `budget_alert`. Payload: `{ categoryName, percent, spent, limit, kind }`, todo
ya formateado (research R6).
