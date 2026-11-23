# Data Model: Tarjeta virtual

**Feature**: `004-tarjeta-virtual` · **Date**: 2026-11-22 · **Plan**: [plan.md](plan.md)

Convenciones de las specs 001–003: `snake_case`, UUID, `timestamptz` UTC, dinero en `BIGINT` y en
pesos enteros.

| Cambio | Tabla | Módulo dueño |
| :--- | :--- | :--- |
| Nueva | `cards` | `cards` |
| Nueva | `card_payments` | `cards` |
| Nueva | `card_payment_declines` | `cards` |
| Valores de enum nuevos | `account_kind`, `ledger_transaction_type`, `audit_event_type` | `accounts`, `ledger`, `lib/audit` |
| Fila nueva | `accounts` (`system_merchants`) | `accounts` |

---

## Card (`cards`) — spec: «Tarjeta virtual»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL; FK → `users.id`; índice |
| `nickname` | varchar(30) | NOT NULL; 1–30 caracteres tras recortar espacios (FR-001) |
| `last4` | char(4) | NOT NULL; solo dígitos |
| `pan_encrypted` | bytea | NOT NULL; `iv(12) ‖ tag(16) ‖ AES-256-GCM(número)` (research R3) |
| `pan_hash` | char(64) | NOT NULL; UNIQUE; HMAC-SHA256 del número (research R3) |
| `exp_month` | smallint | NOT NULL; `CHECK (exp_month BETWEEN 1 AND 12)` |
| `exp_year` | smallint | NOT NULL; año con 4 dígitos |
| `status` | `card_status` | NOT NULL; `active` \| `frozen` \| `canceled`; transiciones de research R8 |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |
| `canceled_at` | timestamptz | NULL; `CHECK ((status = 'canceled') = (canceled_at IS NOT NULL))` |

**Reglas**:
- El CVV no se guarda: se deriva (research R2).
- Máximo 3 tarjetas con `status <> 'canceled'` por `user_id`. Se verifica dentro de una transacción
  que bloquea la cuenta del estudiante (research R7).
- Una tarjeta cancelada no vuelve a otro estado. Un trigger rechaza cualquier `UPDATE` cuyo `OLD.status`
  sea `canceled` y cualquier `DELETE` (las tarjetas se conservan por sus pagos).
- **Índice**: `(user_id, created_at)` para listar.

## CardPayment (`card_payments`) — spec: «Pago con tarjeta»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `card_id` | uuid | NOT NULL; FK → `cards.id` |
| `transaction_id` | uuid | NOT NULL; UNIQUE; FK → `ledger_transactions.id` |
| `merchant_id` | varchar(40) | NOT NULL; id de `DEMO_MERCHANTS` |
| `merchant_name` | varchar(60) | NOT NULL; nombre al momento del pago |
| `category` | `merchant_category` | NOT NULL; `food` \| `books` \| `transport` \| `stationery` \| `entertainment` (spec 006) |
| `amount` | bigint | NOT NULL; `CHECK (amount > 0)` |
| `created_at` | timestamptz | NOT NULL |

**Reglas**: inmutable (trigger que rechaza `UPDATE` y `DELETE`), como el libro contable. Solo se
crea para pagos aprobados, en la misma transacción que la operación del libro.
**Índice**: `(card_id, created_at DESC, id DESC)` para la lista por tarjeta (FR-020).

## CardPaymentDecline (`card_payment_declines`) — rechazos por datos equivocados

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL; FK → `users.id` |
| `created_at` | timestamptz | NOT NULL |

**Reglas**: 5 filas del mismo usuario en 15 minutos bloquean los pagos 15 minutos (FR-014, research
R5). Se borran las de más de 24 h con el scheduler de mantenimiento.
**Índice**: `(user_id, created_at)`.

## Account (`accounts`, spec 002) — cambios

- `account_kind` agrega `system_merchants`. La migración inserta **una** fila de ese tipo (sin
  `user_id`), igual que `system_topups`. No tiene saldo materializado.

## LedgerTransaction (`ledger_transactions`, spec 002) — cambios

- `ledger_transaction_type` agrega `card_payment`. `account_id` es la cuenta del estudiante;
  `description` es «Compra en {comercio} · •••• {last4}». Sin contraparte ni nota.
- **Índice**: el de `(account_id, type, created_at)` de la spec 002 sirve para el tope diario.

**Pago de $12.000 en Cafetería Central con la tarjeta •••• 1234** (ejemplo):

| account | amount | description |
| :--- | :--- | :--- |
| cuenta del estudiante | `-12000` | Compra en Cafetería Central · •••• 1234 |
| `system_merchants` | `+12000` | Compra en Cafetería Central · •••• 1234 |

## Movement (vista, spec 002) — cambio

| Campo de la API | Origen |
| :--- | :--- |
| `type` | ahora `topup`, `transfer` o `card_payment` |

## AuditEvent (`audit_events`, spec 001) — cambios

Valores nuevos del enum `audit_event_type`:

| Valor | `metadata` |
| :--- | :--- |
| `CARD_ISSUED` | `{ cardId, last4 }` |
| `CARD_FROZEN` | `{ cardId, last4 }` |
| `CARD_UNFROZEN` | `{ cardId, last4 }` |
| `CARD_CANCELED` | `{ cardId, last4 }` |
| `CARD_REVEALED` | `{ cardId, last4 }` |
| `CARD_PAYMENT_APPROVED` | `{ amount, transactionId, cardId, merchantId }` |

Nunca el número completo, el vencimiento ni el CVV (FR-021).
