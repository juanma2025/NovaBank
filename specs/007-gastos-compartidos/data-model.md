# Data Model: Gastos compartidos

**Feature**: `007-gastos-compartidos` · **Date**: 2026-11-23 · **Plan**: [plan.md](plan.md)

Convenciones de las specs 001–006: `snake_case`, UUID, `timestamptz` UTC, dinero en `BIGINT` y en
pesos enteros.

| Cambio | Tabla | Módulo dueño |
| :--- | :--- | :--- |
| Nueva | `splits` | `splits` |
| Nueva | `split_shares` | `splits` |
| Enums nuevos | `split_status`, `split_share_status` | `splits` |
| Valores de enum nuevos | `email_template` (`split_invitation`, `split_reminder`, `split_paid`) | `lib/mail` |

---

## Split (`splits`) — spec: «División»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `creator_user_id` | uuid | NOT NULL; FK → `users.id`; índice |
| `title` | varchar(60) | NOT NULL; 1–60 caracteres tras recortar espacios |
| `total_amount` | bigint | NOT NULL; `CHECK (total_amount BETWEEN 2000 AND 5000000)` |
| `creator_share` | bigint | NOT NULL; `CHECK (creator_share >= 0)` |
| `status` | `split_status` | NOT NULL; `open` \| `completed` \| `canceled` |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |
| `closed_at` | timestamptz | NULL; `CHECK ((status = 'open') = (closed_at IS NULL))` |

**Reglas**: `creator_share + Σ split_shares.amount = total_amount` (lo valida el servicio al crear,
research R4). Una división `completed` o `canceled` no vuelve a `open` (trigger).

## SplitShare (`split_shares`) — spec: «Parte»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `split_id` | uuid | NOT NULL; FK → `splits.id` |
| `user_id` | uuid | NOT NULL; FK → `users.id`; índice `(user_id, status)` |
| `amount` | bigint | NOT NULL; `CHECK (amount > 0)` (el rango de transferencias lo valida el servicio) |
| `status` | `split_share_status` | NOT NULL; `pending` \| `paid` \| `paid_outside` \| `declined` \| `canceled` |
| `transfer_transaction_id` | uuid | NULL; UNIQUE; FK → `ledger_transactions.id`; `CHECK ((status = 'paid') = (transfer_transaction_id IS NOT NULL))` |
| `resolved_at` | timestamptz | NULL; `CHECK ((status = 'pending') = (resolved_at IS NULL))` |
| `last_reminded_at` | timestamptz | NULL |
| `created_at` | timestamptz | NOT NULL |

**Reglas**:
- `UNIQUE (split_id, user_id)`: una parte por participante.
- Solo se sale de `pending` y nunca se vuelve (research R5): un trigger rechaza cualquier cambio de
  `status` cuyo `OLD.status` no sea `pending`, y cualquier `DELETE`.

## EmailOutbox (`email_outbox`, spec 001) — cambio

`email_template` agrega `split_invitation`, `split_reminder` y `split_paid` (research R6).
