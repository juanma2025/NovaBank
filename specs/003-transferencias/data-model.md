# Data Model: Transferencias entre estudiantes

**Feature**: `003-transferencias` · **Date**: 2026-11-22 · **Plan**: [plan.md](plan.md)

Convenciones de las specs 001 y 002: `snake_case`, UUID, `timestamptz` UTC, dinero en `BIGINT` y en
pesos enteros.

| Cambio | Tabla | Módulo dueño |
| :--- | :--- | :--- |
| Nueva | `profiles` | `profile` |
| Columnas nuevas | `ledger_transactions`, `ledger_entries` | `ledger` |
| Valores de enum nuevos | `ledger_transaction_type`, `audit_event_type` | `ledger`, `lib/audit` |

---

## Profile (`profiles`) — spec: «Alias»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `user_id` | uuid | PK, FK → `users.id` |
| `alias` | varchar(20) | NULL; UNIQUE; normalizado (minúsculas, sin `@`); `CHECK (alias ~ '^[a-z0-9]([a-z0-9._]{1,18})[a-z0-9]$')` (FR-015, FR-016) |
| `updated_at` | timestamptz | NOT NULL |

**Reglas**:
- La fila se crea al asignar el primer alias. Quitar el alias deja `alias = NULL`, y el valor
  anterior queda libre (FR-017).
- Dos estudiantes que piden el mismo alias a la vez: uno lo obtiene y el otro recibe 409
  `ALIAS_TAKEN` por la violación del índice único (research R2).

## LedgerTransaction (`ledger_transactions`, spec 002) — cambios

| Campo nuevo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `counterparty_account_id` | uuid | NULL; FK → `accounts.id`; obligatorio si `type = transfer` y distinto de `account_id` |
| `note` | varchar(140) | NULL; nota opcional de la transferencia (FR-012) |

- `type`: se agrega el valor `transfer` al enum `ledger_transaction_type`.
- **CHECK**: `type <> 'transfer' OR (counterparty_account_id IS NOT NULL AND counterparty_account_id <> account_id)`.
- `account_id` sigue siendo la cuenta que origina la operación: en una transferencia, el emisor.
- El trigger de la máquina de estados (spec 002) se actualiza para que `counterparty_account_id` y
  `note` tampoco puedan cambiar.

**Índice**: el de `(account_id, type, created_at)` de la spec 002 ya sirve para el tope diario de lo
enviado.

## LedgerEntry (`ledger_entries`, spec 002) — cambio

| Campo nuevo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `description` | varchar(140) | NULL; texto desde la cuenta del asiento, ej. «Transferencia a Ana P. G.» o «Transferencia de Juan C.» (research R5) |

Los asientos siguen siendo inmutables: la descripción se escribe al crearlos.

**Transferencia de $15.000 de Juan a Ana** (ejemplo):

| account | amount | description |
| :--- | :--- | :--- |
| cuenta de Juan | `-15000` | Transferencia a Ana P. G. |
| cuenta de Ana | `+15000` | Transferencia de Juan C. |

## Movement (vista, spec 002) — cambios

| Campo de la API | Origen |
| :--- | :--- |
| `type` | ahora `topup` o `transfer` |
| `description` | `ledger_entries.description` si existe; si no, `ledger_transactions.description` |
| `note` (**nuevo**) | `ledger_transactions.note` (`null` si no hay) |

## AuditEvent (`audit_events`, spec 001) — cambios

Valores nuevos del enum `audit_event_type`:

| Valor | `metadata` |
| :--- | :--- |
| `TRANSFER_COMPLETED` | `{ amount, transactionId, counterpartyAccountId }` |
| `ALIAS_CHANGED` | `{ action: 'set' \| 'removed' }` (sin el alias, que es un dato personal) |

## LoginAttempt (`login_attempts`, spec 001) — uso nuevo, sin cambios de esquema

Los fallos de reautenticación se guardan con
`origin_key = sha256('reauth:' + userId)` y se aplica la regla por origen de la spec 001 (5 fallos en
15 minutos dan 15 minutos de bloqueo). Un acierto borra esos fallos (research R4).

Como se guardan con el correo del usuario, estos fallos **también cuentan para la regla global de la
spec 001** (20 por hora por correo). Es intencional: ante una sesión robada, el bloqueo lleva al dueño
a recuperar su contraseña, lo que borra todos los fallos y cierra todas las sesiones, incluida la del
atacante (spec 001, FR-020c). La misma regla aplica a ver los datos de la tarjeta (spec 004, research
R4), que comparte esta reautenticación.
