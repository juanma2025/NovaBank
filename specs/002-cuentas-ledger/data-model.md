# Data Model: Cuenta en COP, libro contable y recarga simulada

**Feature**: `002-cuentas-ledger` · **Date**: 2026-11-22 · **Plan**: [plan.md](plan.md)

## Convenciones generales

Las mismas de la spec 001:
- `snake_case`;
- PK UUID con `gen_random_uuid()`;
- fechas `timestamptz` en UTC.

Para el dinero:
- se guarda en `BIGINT`, en **pesos enteros**;
- los repositorios lo convierten a `number` verificando `Number.isSafeInteger` (Principio I).

| Tabla | Módulo dueño |
| :--- | :--- |
| `accounts` | `accounts` |
| `ledger_transactions`, `ledger_entries` | `ledger` |
| `idempotency_keys` | `lib/idempotency` |

```text
users (001) 1 ──── 0..1 accounts (kind = student)
accounts    1 ──── *    ledger_entries
ledger_transactions 1 ── 2..* ledger_entries   (suman 0)
idempotency_keys * ──── 1 users (001)
```

---

## Account (`accounts`) — spec: «Cuenta» y «Cuenta del sistema»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `kind` | enum `account_kind` (`student`, `system_topups`) | NOT NULL |
| `user_id` | uuid | UNIQUE; FK → `users.id`; NOT NULL si `kind = student`, NULL si es del sistema |
| `currency` | char(3) | NOT NULL, default `'COP'`; `CHECK (currency = 'COP')` en el MVP |
| `balance` | bigint | NOT NULL, default 0. Materializado **solo** para `student`, con `CHECK (kind <> 'student' OR balance >= 0)`. En `system_topups` queda en 0 y no se usa: su saldo es la suma de sus asientos (research R3) |
| `status` | enum `account_status` (`active`) | NOT NULL, default `active` |
| `created_at` | timestamptz | NOT NULL |

**Reglas**:
- Una cuenta `student` por usuario (FR-001): `UNIQUE (user_id)`, creada con `INSERT … ON CONFLICT DO
  NOTHING` (research R6).
- Exactamente una cuenta `system_topups`: índice único parcial `(kind) WHERE kind = 'system_topups'`,
  creada por la migración.
- **Invariante** (FR-003, SC-003): `balance` de una cuenta `student` = suma de sus
  `ledger_entries.amount`. Se actualiza en la misma transacción que los asientos.

## LedgerTransaction (`ledger_transactions`) — spec: «Operación»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `type` | enum `ledger_transaction_type` (`topup`) | NOT NULL; crece con las specs siguientes |
| `status` | enum `ledger_transaction_status` (`pending`, `completed`, `failed`, `reversed`) | NOT NULL |
| `account_id` | uuid | NOT NULL, FK → `accounts.id`; cuenta del estudiante que la originó |
| `amount` | bigint | NOT NULL, `CHECK (amount > 0)`; monto de la operación |
| `description` | varchar(140) | NOT NULL; texto que ve el estudiante, ej. «Recarga simulada» |
| `reversal_of` | uuid | NULL; FK → `ledger_transactions.id`; para reversiones futuras (no se usa en la 002) |
| `request_id` | uuid | NOT NULL; trazabilidad |
| `created_at` | timestamptz | NOT NULL |
| `completed_at` | timestamptz | NULL hasta completar |

**Índice**: `(account_id, type, created_at)`, para calcular el tope diario.

**Máquina de estados** (FR-007; constitución, regla de dominio 7), validada por un trigger:

```text
pending ──► completed
   │──────► failed
   └──────► reversed
```

En un `UPDATE` solo pueden cambiar `status` y `completed_at`, y solo desde `pending`. Cualquier otro
cambio es rechazado por el trigger.

## LedgerEntry (`ledger_entries`) — spec: «Asiento contable»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `transaction_id` | uuid | NOT NULL, FK → `ledger_transactions.id` |
| `account_id` | uuid | NOT NULL, FK → `accounts.id` |
| `amount` | bigint | NOT NULL, `CHECK (amount <> 0)`; positivo acredita, negativo debita |
| `created_at` | timestamptz | NOT NULL; igual al de su operación |

**Garantías en la base de datos** (research R2):
- *Constraint trigger* `DEFERRABLE INITIALLY DEFERRED`: al confirmar, la suma de `amount` por
  `transaction_id` debe ser 0 y haber al menos 2 asientos (FR-005).
- Inmutable: triggers rechazan `UPDATE`, `DELETE` y `TRUNCATE` (FR-006).

**Índice**: `(account_id, created_at DESC, id DESC)`, para el historial por cursor (research R8).

**Recarga de $50.000** (ejemplo):

| account | amount |
| :--- | :--- |
| cuenta del estudiante | `+50000` |
| cuenta `system_topups` | `-50000` |

## Movement — spec: «Movimiento» (vista, sin tabla)

Proyección de un `ledger_entry` de la cuenta del estudiante, unida a su operación:

| Campo de la API | Origen |
| :--- | :--- |
| `id` | `ledger_entries.id` |
| `transactionId` | `ledger_transactions.id` |
| `type` | `ledger_transactions.type` |
| `description` | `ledger_transactions.description` |
| `amount` | `ledger_entries.amount` (con signo, desde la cuenta del estudiante) |
| `status` | `ledger_transactions.status` |
| `createdAt` | `ledger_entries.created_at` |

## IdempotencyKey (`idempotency_keys`)

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL, FK → `users.id` |
| `scope` | varchar(40) | NOT NULL; ej. `topups.create` |
| `key` | varchar(100) | NOT NULL; valor de la cabecera `Idempotency-Key` (8–100 caracteres) |
| `request_hash` | char(64) | NOT NULL; SHA-256 del cuerpo canónico |
| `response_status` | smallint | NULL hasta guardar la respuesta |
| `response_body` | jsonb | NULL hasta guardar la respuesta |
| `created_at` | timestamptz | NOT NULL |
| `expires_at` | timestamptz | NOT NULL; `created_at` + 24 h |

**Restricciones**: `UNIQUE (user_id, scope, key)`. Índice `(expires_at)` para la limpieza.

**Reglas** (research R5; constitución, regla de dominio 4):
- La fila se crea **dentro** de la transacción de negocio y se confirma junto con ella.
- Misma clave y mismo hash → se devuelve la respuesta guardada.
- Misma clave y hash distinto → 409 `IDEMPOTENCY_KEY_REUSED`.

## AuditEvent (`audit_events`, spec 001) — cambio

Se agrega el valor `TOPUP_COMPLETED` al enum `audit_event_type` (FR-021). `metadata` lleva
`{ amount, transactionId }`, sin datos sensibles.
