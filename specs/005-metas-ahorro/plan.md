# Implementation Plan: Metas de ahorro

**Branch**: `005-metas-ahorro` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-metas-ahorro/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Cada estudiante puede tener hasta 5 metas activas con nombre, monto objetivo y fecha opcional. Les
aporta desde su saldo disponible y retira cuando lo necesita; al cerrar una meta, su saldo vuelve a la
cuenta principal en la misma operación. Cada meta es una subcuenta del libro contable de la spec 002,
así que su dinero no se puede gastar hasta retirarlo.

**Enfoque técnico** (detalle en [research.md](research.md)):

| Tema | Decisión |
| :--- | :--- |
| Módulo | `savings` nuevo, dueño de `savings_goals`; usa `accounts`, `ledger` e idempotencia (R1) |
| Subcuenta | Una fila `accounts` de tipo `savings_goal` por meta, con saldo materializado y no negativo (R2) |
| Asientos | `savings_deposit` / `savings_withdrawal` con descripción por asiento; la operación pertenece a la cuenta principal (R3) |
| Concurrencia | Fila de la meta bloqueada y luego las dos cuentas en orden de `id` (R4) |
| Cierre | Devuelve todo el saldo; exento del rango y del tope diario (R6, R7) |
| Contrato congelado | `Movement.type` suma `savings_deposit` y `savings_withdrawal` (R9) |

## Technical Context

**Language/Version**: igual que las specs 001–004 (TypeScript 6.0, Node.js 24, React 19).

**Primary Dependencies**: **ninguna nueva.**

**Storage**: PostgreSQL 17. Una tabla nueva (`savings_goals`), valores nuevos en enums y el `CHECK` de
saldo de `accounts` ampliado. Ver [data-model.md](data-model.md).

**Testing**: igual que la 004, más pruebas de: aportes y retiros simultáneos, cerrar con aportes en
curso, creación simultánea (máximo 5), exención de la devolución en el tope y la invariante «saldo
disponible + metas no cambia».

**Performance Goals**: crear una meta y aportar en menos de 45 s (SC-001).

**Constraints**: los de la 002 (dinero exacto, atomicidad, idempotencia, saldo nunca negativo) y la
regla de dominio 9 (subcuenta; el dinero de la meta no está disponible hasta retirarlo).

**Scale/Scope**: 8 operaciones nuevas, 2 pantallas (metas y detalle de meta), 1 tabla.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / regla | Verificación | Estado |
| :--- | :--- | :--- |
| I. Dinero exacto, doble entrada, atomicidad | 2 asientos (cuenta principal / subcuenta) en una transacción (R3, R5) | ✅ |
| I. Saldo derivado y materializado | Saldo de la subcuenta actualizado en la misma transacción; `CHECK` no negativo ampliado (R2) | ✅ |
| I. Saldo nunca negativo + bloqueo | Fila de la meta y cuentas con `FOR UPDATE` en orden fijo (R4) | ✅ |
| I. Idempotencia | `Idempotency-Key` en aportes, retiros y cierre (R5, R6) | ✅ |
| II. SDD | Sin aportes automáticos, metas compartidas ni intereses (fuera de la spec) | ✅ |
| III. Mínimo privilegio | Metas ajenas → 404 (FR-015) | ✅ |
| V. Simulación segura | Sin rendimientos ni dinero real (spec, supuestos) | ✅ |
| VI. Monolito modular | `savings` no toca tablas ajenas (R1) | ✅ |
| VI. Contratos primero | [contracts/savings.openapi.json](contracts/savings.openapi.json). `Movement` cambia en los contratos de la 002, la 003 y la 004, y lo aprueban ambos en este PR (R9) | ✅ |
| Regla de dominio 6: límites | Rango y tope diario en aportes y retiros (R10). La devolución al cerrar está exenta, justificado en la spec (supuestos) y en R7: es dinero propio que no sale de Nova, y sin la exención una meta con más del máximo por movimiento no se podría cerrar | ✅ |
| Regla de dominio 9 | Subcuenta por meta; aportes y retiros entre cuenta principal y meta; saldo de la meta nunca negativo; dinero no disponible hasta retirarlo (R2, R3) | ✅ |
| Seguridad: límites de tasa | `savingsMovements` (R10) | ✅ |
| Seguridad: auditoría | Crear, cerrar, aportar, retirar (data-model.md) | ✅ |

**Estado del gate**: ✅ aprobado, sin violaciones ni enmiendas.

## Project Structure

```text
specs/005-metas-ahorro/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md · tasks.md
├── contracts/savings.openapi.json
└── checklists/requirements.md
specs/00{2,3,4}-*/contracts/*.openapi.json   # Movement.type + savings_deposit, savings_withdrawal (R9)

shared/src/
├── accounts.schemas.ts      # [SH] MovementType + 'savings_deposit', 'savings_withdrawal'
├── savings.ts               # [SH] MAX_ACTIVE_GOALS, SAVINGS_TARGET_MIN/MAX, goalProgress
├── savings.schemas.ts       # [SH] Goal, GoalList, CreateGoalRequest, UpdateGoalRequest, SavingsAmountRequest,
│                            #      SavingsMovementResult, CloseGoalResult, SavingsLimits, GoalMovementsQuery
└── errors.ts                # [SH] + 4 códigos

db/prisma/                   # [BE] SavingsGoal; enums; migraciones (enums aparte, CHECK de accounts, trigger)

backend/src/
├── modules/accounts/        # [BE] + createSavingsAccount; applyBalanceDelta también en savings_goal
└── modules/savings/         # [BE] repository, service, controller, routes

frontend/src/                        # [FE]
├── features/savings/pages/GoalsPage.tsx       # total ahorrado, metas con progreso, crear
├── features/savings/pages/GoalDetailPage.tsx  # progreso, aportar, retirar, editar, cerrar, historial
├── features/savings/components/GoalCard.tsx · GoalFormDialog.tsx · SavingsAmountDialog.tsx
└── features/home/components/MovementItem.tsx  # + tipos savings_deposit y savings_withdrawal (spec 002)

e2e/savings.spec.ts                  # [E2E]
```

## Diseño del backend

### Endpoints

Todos con `require-auth`. Detalle en [contracts/savings.openapi.json](contracts/savings.openapi.json).

| Método y ruta | Historia | Requisitos |
| :--- | :--- | :--- |
| `GET /savings/goals` | US1, US3 | FR-002–FR-004, FR-006 |
| `POST /savings/goals` | US1 | FR-001, FR-002 |
| `PATCH /savings/goals/{goalId}` | US3 | FR-005, FR-013 |
| `POST /savings/goals/{goalId}/deposits` | US1 | FR-007–FR-011 |
| `POST /savings/goals/{goalId}/withdrawals` | US2 | FR-007, FR-009–FR-011 |
| `POST /savings/goals/{goalId}/close` | US3 | FR-011–FR-013 |
| `GET /savings/goals/{goalId}/movements` | US1–US3 | FR-014 |
| `GET /savings/limits` | US1, US2 | FR-010 |

Un `goalId` que no es UUID, que no existe o que es de otro estudiante responde 404 `NOT_FOUND`.

**Flujos**: aporte y retiro en research R5; cierre en R6.

### Variables de entorno nuevas

| Variable | Valor por defecto | Regla |
| :--- | :--- | :--- |
| `SAVINGS_MIN_AMOUNT` | `1000` | `min ≤ max ≤ tope` |
| `SAVINGS_MAX_AMOUNT` | `2000000` | |
| `SAVINGS_DAILY_LIMIT` | `5000000` | |

**Límite de tasa nuevo**: `savingsMovements` (60 cada 15 min) en aportes, retiros y cierres.

## Diseño del frontend

| Ruta | Pantalla | Estados |
| :--- | :--- | :--- |
| `/metas` | `GoalsPage`: total ahorrado; `GoalCard` por meta (nombre, saldo/objetivo, barra de progreso con porcentaje en texto, «Cumplida», «Fecha vencida»); «Nueva meta» (`GoalFormDialog`) | Carga; vacío («Crea tu primera meta»); `GOAL_LIMIT_REACHED`; cerradas al final, atenuadas |
| `/metas/:id` | `GoalDetailPage`: progreso, lo que falta, ahorro sugerido por mes (`goalProgress`), «Aportar» y «Retirar» (`SavingsAmountDialog` con límites y lo que queda hoy), editar, cerrar (muestra el monto que vuelve y pide confirmar), historial de la meta | `INSUFFICIENT_FUNDS` con el saldo correspondiente; `SAVINGS_DAILY_LIMIT`; `GOAL_CLOSED`; 404 → «No encontramos esta meta»; reintento con la **misma** `Idempotency-Key` |
| `/inicio`, `/movimientos` (002) | `MovementItem` reconoce `savings_deposit` y `savings_withdrawal` | — |

`HomePage` (002) agrega el acceso «Metas». Tras aportar, retirar o cerrar, invalidar `['account']`,
`['movements']` y `['goals']`.

## Paquete `@nova/shared`

| Exportación | Uso |
| :--- | :--- |
| `MAX_ACTIVE_GOALS`, `SAVINGS_TARGET_MIN`, `SAVINGS_TARGET_MAX`, `GOAL_NAME_MAX_LENGTH` | Reglas de la meta (FR-001, FR-002) |
| `goalProgress(goal, today)` | Porcentaje (0–100 para la barra), lo que falta, cumplida, fecha vencida y ahorro sugerido por mes (FR-003, FR-004) |
| `GoalSchema`, `GoalListSchema`, `GoalStatusSchema` | Metas |
| `CreateGoalRequestSchema`, `UpdateGoalRequestSchema` | Crear y editar |
| `SavingsAmountRequestSchema`, `SavingsMovementResultSchema`, `CloseGoalResultSchema` | Aportar, retirar y cerrar |
| `SavingsLimitsSchema`, `GoalMovementsQuerySchema` | Límites e historial |
| `MovementTypeSchema` + `savings_deposit`, `savings_withdrawal` | Cambio en la 002 (R9) |
| `ERROR_CODES` + `GOAL_LIMIT_REACHED`, `GOAL_CLOSED`, `SAVINGS_AMOUNT_OUT_OF_RANGE`, `SAVINGS_DAILY_LIMIT` | Errores |

## Guía para `/speckit-tasks`

Las etiquetas `[SH]`, `[BE]`, `[FE]` y `[E2E]` tienen el mismo alcance que en la 004. Orden de las
historias: US1 (crear y aportar) → US2 (retirar) → US3 (administrar y cerrar).

## Complexity Tracking

| Decisión | Por qué se necesita | Alternativa más simple descartada porque |
| :--- | :--- | :--- |
| Subcuenta en `accounts` por meta | Regla de dominio 9 y doble entrada (R2) | Un saldo en `savings_goals` sin subcuenta no es un asiento del libro |
| `closing_transaction_id` para la exención | Que la devolución no consuma el tope sin que `ledger` conozca reglas de metas (R7) | Un tipo de operación más agrega otro valor al contrato de `Movement` sin diferencia visible |
