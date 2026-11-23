# Research: Metas de ahorro

**Feature**: `005-metas-ahorro` · **Date**: 2026-11-23 · **Plan**: [plan.md](plan.md)

Se reutiliza lo de las specs 001–004: sesión, auditoría, formato de error, límites de tasa,
`accounts` (`lockManyForUpdate`), `ledger` (descripción por asiento), idempotencia, cursor de
paginación y `startOfBogotaDay`.

---

## R1. Módulo `savings` y fronteras (Principio VI)

| Módulo | Dueño de | Lo que expone |
| :--- | :--- | :--- |
| `savings` (nuevo) | `savings_goals` | Endpoints de `/savings` |
| `accounts` (002) | `accounts` | **Nuevo**: `createSavingsAccount(tx)`; `applyBalanceDelta` también actualiza subcuentas de metas |
| `ledger` (002) | sin cambios de propiedad | Tipos nuevos `savings_deposit` y `savings_withdrawal` |

`savings` no toca `accounts` ni `ledger_*`: crea la subcuenta con `accounts` y mueve el dinero con
`ledger.post`.

## R2. La meta como subcuenta del libro (regla de dominio 9)

**Decision**:
- `account_kind` agrega `savings_goal`. Cada meta tiene **su propia fila en `accounts`**, sin
  `user_id` (la columna es única por estudiante para la cuenta principal), enlazada desde
  `savings_goals.account_id` (único).
- El saldo de la subcuenta se **materializa** como el de la cuenta principal y se actualiza en la
  misma transacción que los asientos (constitución, «El saldo es derivado»). El `CHECK` de saldo no
  negativo de la spec 002 se amplía a `savings_goal`.
- `accounts.applyBalanceDelta` actualiza `student` y `savings_goal`; las cuentas del sistema siguen
  sin saldo materializado.

**Por qué el dinero de la meta no se puede gastar (FR-008)**: transferencias, pagos con tarjeta y
aportes operan sobre la cuenta principal (`ensureForUser`); la subcuenta de la meta es otra fila. No
hace falta cambiar las specs 003 y 004.

**Alternatives considered**: guardar el saldo de la meta en `savings_goals` sin subcuenta (incumple la
regla de dominio 9 y la doble entrada); quitar la unicidad de `accounts.user_id` (rompe
`ensureForUser` y el supuesto de una cuenta principal por estudiante).

## R3. Asientos

| Operación | Tipo | `account_id` de la operación | Asientos |
| :--- | :--- | :--- | :--- |
| Aporte | `savings_deposit` | cuenta principal | −monto principal «Aporte a {meta}» · +monto meta «Aporte desde tu cuenta» |
| Retiro | `savings_withdrawal` | cuenta principal | −monto meta «Retiro a tu cuenta» · +monto principal «Retiro de {meta}» |
| Devolución al cerrar | `savings_withdrawal` | cuenta principal | igual que un retiro, por todo el saldo, con «Cierre de {meta}» en la cuenta principal |

`account_id` es siempre la cuenta principal: así el tope diario usa el índice
`(account_id, type, created_at)` de la spec 002, y el historial de la meta lista los asientos de su
subcuenta (`ledger.listMovements(goal.accountId)`). La descripción del asiento (spec 003 R5) da el
texto correcto en cada historial.

## R4. Bloqueos y concurrencia (regla de dominio 3)

**Decision**: aporte, retiro y cierre ejecutan, en una transacción:
1. `SELECT … FOR UPDATE` de la fila de `savings_goals` (propia; si no, 404). Serializa con cerrar y
   editar.
2. Meta cerrada → 409 `GOAL_CLOSED`.
3. `accounts.lockManyForUpdate([principal, subcuenta])` en orden de `id` (spec 003 R6).

Orden global: fila de la meta → cuentas. Ninguna otra operación bloquea cuentas y después la fila de
una meta, así que no hay ciclos. Crear una meta bloquea solo la cuenta principal (para contar las
activas, como las tarjetas de la spec 004).

Si se cierra la meta mientras un aporte está en curso, uno espera al otro: el aporte entra antes y
vuelve con la devolución, o encuentra la meta cerrada y responde 409.

## R5. Flujo de aporte y retiro

1. Validar el cuerpo y `Idempotency-Key`.
2. Rango → `SAVINGS_AMOUNT_OUT_OF_RANGE` (no depende de datos guardados).
3. **Transacción**: bloqueos de R4 → `idempotency.begin` (scope `savings.deposit` o
   `savings.withdrawal`; el hash cubre `{ goalId, amount }`) → tope diario (aportes + retiros desde el
   inicio del día en Bogotá) → `SAVINGS_DAILY_LIMIT` → saldo de origen → `INSUFFICIENT_FUNDS` con
   `availableBalance` (el disponible en un aporte, el de la meta en un retiro) → `ledger.post` →
   auditoría → `idempotency.complete`.
4. Respuesta: la meta actualizada, el movimiento visto desde la cuenta principal y el saldo
   disponible.

## R6. Cierre

`POST /savings/goals/{goalId}/close` exige `Idempotency-Key` porque mueve dinero (regla de dominio 4;
scope `savings.close`, hash `{ goalId }`). Con los bloqueos de R4:
1. si el saldo es mayor que 0, un `savings_withdrawal` por todo el saldo (R3);
2. `status = closed`, `closed_at` y `closing_transaction_id` (R7);
3. auditoría `GOAL_CLOSED` con el monto devuelto.

La devolución **no** pasa por el rango ni por el tope diario (spec, supuestos) y tampoco consume el
tope de ese día (R7).

## R7. Exención de la devolución en el tope diario

**Decision**: la tabla `savings_goals` guarda `closing_transaction_id` (la operación de la
devolución, si hubo saldo). El tope diario del módulo `savings` se calcula como
`ledger.sumCompletedSince(principal, 'savings_deposit')` + `ledger.sumCompletedSince(principal,
'savings_withdrawal')` − la suma de las devoluciones del día, que `savings` conoce por sus propias
filas (`closing_transaction_id` con `closed_at` desde el inicio del día). Así `ledger` no cambia y la
regla vive en el módulo dueño.

**Alternatives considered**: un tipo de operación aparte (`savings_closing`) — también válido, pero
agrega un tercer valor al contrato de `Movement` sin diferencia para el usuario; marcar la nota
(mezcla datos visibles con reglas).

## R8. Validaciones de la meta

- `name`: 1–40 caracteres tras recortar espacios.
- `targetAmount`: entero entre 1.000 y 100.000.000 (`SAVINGS_TARGET_MIN` / `SAVINGS_TARGET_MAX` en
  `@nova/shared`).
- `targetDate`: `AAAA-MM-DD`, opcional y anulable; al crear o cambiar debe ser ≥ hoy en Bogotá y
  ≤ hoy + 10 años. El esquema compartido valida el formato; la regla «≥ hoy» la valida el backend con
  el reloj del servidor (400 `VALIDATION_ERROR` con `fields.targetDate`).
- Datos derivados que devuelve la API: `completed` (`balance ≥ targetAmount`). El porcentaje, lo que
  falta y el ahorro sugerido por mes los calcula `@nova/shared` (`goalProgress`) para que el frontend
  y las pruebas usen la misma regla.

## R9. Cambio en el contrato de `Movement`

`Movement.type` agrega `savings_deposit` y `savings_withdrawal` en los contratos de la 002, la 003 y la
004 (cambio aprobado en el PR de definición de la 005, como en la 003 R8 y la 004 R9).

## R10. Límites configurables

`SAVINGS_MIN_AMOUNT=1000`, `SAVINGS_MAX_AMOUNT=2000000` y `SAVINGS_DAILY_LIMIT=5000000`, validados con
Zod (`min ≤ max ≤ tope`). `GET /savings/limits` devuelve los tres y `remainingToday`. Límite de tasa
`savingsMovements` (60 cada 15 min) para aportes, retiros y cierres.
