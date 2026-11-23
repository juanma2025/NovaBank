# Research: Gastos compartidos

**Feature**: `007-gastos-compartidos` · **Date**: 2026-11-23 · **Plan**: [plan.md](plan.md)

Se reutiliza lo de las specs 001–006: sesión, formato de error, límites de tasa, cursor de
paginación, bandeja de salida de correos, directorio de `auth`, `accounts` y, sobre todo,
`transfers.create` con todas sus reglas.

---

## R1. Módulo `splits` y fronteras (Principio VI)

| Módulo | Dueño de | Lo que expone a `splits` |
| :--- | :--- | :--- |
| `splits` (nuevo) | `splits`, `split_shares` | Endpoints de `/splits` |
| `transfers` (003) | — | `create(input, { inTransaction })` (R2) |
| `accounts` (002) | `accounts` | `findStudentAccountById` (participantes), `ensureForUser` (cuenta de quien crea) |
| `auth` (001) | `users` | `directory.findById` (nombres y correos) |
| `lib/mail` | `email_outbox` | Plantillas nuevas `split_invitation`, `split_reminder` y `split_paid` |

`splits` no toca `ledger_*` ni `accounts`: el dinero solo se mueve con `transfers.create`.

## R2. Pagar una parte = transferencia normal en la misma transacción (FR-005, FR-006)

**Decision**: `transfers.create` acepta un segundo argumento opcional
`{ inTransaction?: (tx, result) => Promise<void> }` que se ejecuta **dentro** de su transacción,
después de registrar la transferencia y antes de confirmar. `splits` lo usa para:

1. bloquear la fila de la parte (`SELECT … FOR UPDATE`);
2. verificar que siga pendiente y la división abierta (si no, lanza `SHARE_NOT_PENDING` o
   `SPLIT_CLOSED` y **toda** la transacción —incluida la transferencia— se revierte);
3. marcarla `paid` con `transfer_transaction_id`.

Así la transferencia pasa por todas las reglas de la spec 003 (rango, tope diario, saldo, contraseña
fuera de la transacción, idempotencia, bloqueo de cuentas en orden de `id`, auditoría y el evento
`spending.recorded` de la 006), y nunca hay una transferencia sin su parte marcada ni al revés
(regla de dominio 11).

**Dos pagos simultáneos de la misma parte**: ambos bloquean las mismas dos cuentas en el mismo orden
(spec 003 R6), así que se serializan; el segundo encuentra la parte pagada y se revierte entero.

**Idempotencia**: se usa la `Idempotency-Key` del cliente con el *scope* de transferencias. Una
repetición devuelve la transferencia original sin volver a ejecutar `inTransaction` (la parte ya
quedó pagada en la primera).

**Orden de bloqueos**: cuentas (dentro de `transfers`) → fila de la parte. Cancelar y marcar como
pagada por fuera bloquean solo filas de `splits`/`split_shares`, nunca cuentas, así que no hay ciclos.

**Alternatives considered**: transferir y luego marcar la parte en otra transacción (si algo falla
entre ambas, el dinero se movió y la parte sigue pendiente); duplicar la lógica de transferencias en
`splits` (incumple la regla de dominio 11: «una transferencia normal»).

## R3. Participantes

`POST /splits` recibe para cada participante el `recipientId` de `GET /transfers/recipient` (id de la
cuenta, spec 003 R3). `splits` lo resuelve con `accounts.findStudentAccountById` y guarda el
`user_id`. Validaciones: entre 1 y 10, sin repetir, sin quien crea (`VALIDATION_ERROR` con
`fields.shares`); una cuenta que no existe → 404 `RECIPIENT_NOT_FOUND`.

## R4. Montos (FR-002, FR-003)

- `splitEvenly(total, participantes)` en `@nova/shared`: base = `floor(total / (participantes + 1))`;
  cada participante debe la base y quien crea `total − base × participantes`.
- El cuerpo trae `creatorShare` y el monto de cada parte; el backend exige
  `creatorShare + Σ partes = total` (`SPLIT_SHARES_MISMATCH`), `creatorShare ≥ 0` y cada parte dentro
  del rango de las transferencias configurado (`SPLIT_SHARE_OUT_OF_RANGE` con `minAmount` y
  `maxAmount`).

## R5. Estados

| Parte | Desde | Hacia | Quién |
| :--- | :--- | :--- | :--- |
| `pending` | creación | `paid` | participante, con transferencia (R2) |
| `pending` | | `paid_outside` | quien creó |
| `pending` | | `declined` | participante |
| `pending` | | `canceled` | al cancelar la división |

Cualquier acción sobre una parte que no está `pending` → 409 `SHARE_NOT_PENDING`. La división pasa a
`completed` cuando no queda ninguna parte `pending` (en la misma transacción que resolvió la última);
cancelar solo es posible en `open` (si no, 409 `SPLIT_CLOSED`).

## R6. Correos

| Plantilla | A quién | Cuándo | Payload |
| :--- | :--- | :--- | :--- |
| `split_invitation` | cada participante | al crear | `creatorName`, `title`, `amount` |
| `split_reminder` | el participante | recordatorio | `creatorName`, `title`, `amount` |
| `split_paid` | quien creó | pago en Nova | `participantName`, `title`, `amount` |

Se encolan en la misma transacción del cambio (bandeja de salida de la spec 001). Los nombres son
parciales (spec 003) y los montos van formateados.

## R7. Recordatorios (FR-011)

`split_shares.last_reminded_at`. Si no pasaron 24 h → 429 `SPLIT_REMINDER_TOO_SOON` con
`retryAfterSeconds`. Se actualiza con la fila bloqueada para que dos recordatorios simultáneos no
envíen dos correos.

## R8. Resumen para el inicio (FR-012)

`GET /splits/summary`: `toCollect` (partes `pending` de divisiones `open` que creó: cantidad y suma) y
`toPay` (sus partes `pending` de divisiones `open`: cantidad y suma).

## R9. Límites de tasa y auditoría

- `splitCreate`: 20 por hora (cada división envía correos a otras personas).
- No hay auditoría propia: crear o marcar no mueve dinero, y el pago queda auditado como
  `TRANSFER_COMPLETED` (spec 003).

## R10. Errores nuevos

`SPLIT_SHARES_MISMATCH` (422), `SPLIT_SHARE_OUT_OF_RANGE` (422), `SPLIT_CLOSED` (409),
`SHARE_NOT_PENDING` (409) y `SPLIT_REMINDER_TOO_SOON` (429). Se reutilizan `VALIDATION_ERROR`,
`NOT_FOUND`, `RECIPIENT_NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED` y todos los de las transferencias.
