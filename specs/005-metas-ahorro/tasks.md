---
description: "Task list for 005-metas-ahorro"
---

# Tasks: Metas de ahorro

**Input**: Design documents from `/specs/005-metas-ahorro/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/savings.openapi.json](contracts/savings.openapi.json),
[quickstart.md](quickstart.md)

**Tests**: Incluidas (una por regla de dominio, concurrencia e invariantes del libro contable).

## Format: `[ID] [P?] [Story?] [Capa] Description`

| Etiqueta | Rama |
| :--- | :--- |
| `[SH]` | `005-metas-ahorro` |
| `[BE]` | `005-metas-ahorro-be` |
| `[FE]` | `005-metas-ahorro-fe` |
| `[E2E]` | `005-metas-ahorro-fe` |

---

## Phase 1: Foundational (Blocking Prerequisites)

### [SH] Contrato en código — rama de definición

- [X] T001 [P] [SH] Crear `shared/src/savings.ts`:
  - `MAX_ACTIVE_GOALS = 5`, `GOAL_NAME_MAX_LENGTH = 40`, `SAVINGS_TARGET_MIN = 1000`, `SAVINGS_TARGET_MAX = 100_000_000` y `GOAL_DATE_MAX_YEARS = 10`;
  - `goalProgress({ balance, targetAmount, targetDate }, today)` → `{ percent (0–100), remaining, completed, overdue, suggestedMonthly }` (research R8; spec, edge cases «Ahorro sugerido por mes» y «Fecha límite»).

  Pruebas en `shared/src/savings.test.ts`: 0 %, 8 % redondeado hacia abajo, 100 % con saldo mayor al objetivo, sin fecha, fecha vencida y meses restantes con mínimo 1.
- [X] T002 [SH] Agregar `savings_deposit` y `savings_withdrawal` a `MovementTypeSchema` en `shared/src/accounts.schemas.ts` (research R9).
- [X] T003 [SH] Agregar a `shared/src/errors.ts` los códigos `GOAL_LIMIT_REACHED`, `GOAL_CLOSED`, `SAVINGS_AMOUNT_OUT_OF_RANGE` y `SAVINGS_DAILY_LIMIT`.

  Agregar sus mensajes y estados HTTP en `backend/src/lib/error-messages.ts` y `backend/src/lib/errors.ts`: 409 `GOAL_CLOSED`; 422 los demás.
- [X] T004 [SH] Crear `shared/src/savings.schemas.ts`, cada esquema igual a [contracts/savings.openapi.json](contracts/savings.openapi.json):
  - `GoalStatusSchema`, `GoalSchema`, `GoalListSchema`;
  - `CreateGoalRequestSchema` y `UpdateGoalRequestSchema` (estrictos; nombre recortado; fecha `AAAA-MM-DD` válida o `null`; `UpdateGoalRequestSchema` exige al menos un campo);
  - `SavingsAmountRequestSchema`, `SavingsMovementResultSchema`, `CloseGoalResultSchema`;
  - `SavingsLimitsSchema`, `GoalMovementsQuerySchema`.

  Reexportar `savings.ts` y `savings.schemas.ts` en `shared/src/index.ts`.
- [X] T005 [P] [SH] Pruebas:
  - en `shared/src/savings.schemas.test.ts`: nombre recortado y límites; objetivo fuera de rango; fecha `2026-02-30` inválida; `targetDate: null`; actualización vacía rechazada; campos extra;
  - en `shared/src/contract.test.ts`: `Movement` es igual en los contratos de la 002 a la 005, y los ejemplos del contrato de la 005 son válidos.
- [X] T006 [P] [SH] Agregar a `.env.example` `SAVINGS_MIN_AMOUNT=1000`, `SAVINGS_MAX_AMOUNT=2000000` y `SAVINGS_DAILY_LIMIT=5000000`, y las 8 operaciones de la 005 a `PENDING_BACKEND` en `backend/tests/contract/openapi.contract.test.ts`.

**Checkpoint de definición**: PR → `main`. Ambos aprueban también el cambio de `Movement`.

### [BE] Base

- [X] T007 [BE] Agregar a `db/prisma/schema.prisma`:
  - el modelo `SavingsGoal` con data-model.md `SavingsGoal.id`, `SavingsGoal.user_id`, `SavingsGoal.account_id`, `SavingsGoal.name`, `SavingsGoal.target_amount`, `SavingsGoal.target_date`, `SavingsGoal.status`, `SavingsGoal.closing_transaction_id`, `SavingsGoal.created_at`, `SavingsGoal.updated_at` y `SavingsGoal.closed_at`;
  - el enum `savings_goal_status`;
  - los valores `savings_goal` en `account_kind`, `savings_deposit` y `savings_withdrawal` en `ledger_transaction_type`, y `GOAL_CREATED`, `GOAL_CLOSED`, `SAVINGS_DEPOSIT` y `SAVINGS_WITHDRAWAL` en `audit_event_type`.
- [X] T008 [BE] Generar las migraciones (los valores de enum nuevos en una migración aparte, como en la 004) y agregar a mano:
  - el `CHECK` de data-model.md `SavingsGoal.target_amount` y el de `SavingsGoal.closed_at`;
  - el reemplazo del `CHECK` de saldo no negativo de `accounts` para incluir `savings_goal` (data-model.md, Account);
  - el trigger de data-model.md, SavingsGoal (cerradas inmutables, sin borrados).

  Aplicarlas a `nova` y `nova_e2e`.
- [X] T009 [P] [BE] Agregar a `backend/src/config/env.ts` las 3 variables `SAVINGS_*` con la regla `min ≤ max ≤ tope` (research R10), y a `backend/vitest.config.ts` los valores de prueba 1000 / 50000 / 80000. Agregarlas a `docs/despliegue.md`.
- [X] T010 [BE] En `backend/src/modules/accounts/`:
  - `createSavingsAccount(tx)` (inserta una fila `savings_goal`);
  - `applyBalanceDelta` también actualiza cuentas `savings_goal` (research R2);
  - `findById` para leer el saldo de una subcuenta.
- [X] T011 [BE] Crear `backend/src/modules/savings/savings.repository.ts`:
  - crear meta, listar por usuario y contar activas;
  - buscar propia y `lockOwned` (`FOR UPDATE`);
  - actualizar campos y cerrar;
  - sumar las devoluciones de cierre del día (research R7).

---

## Phase 2: User Story 1 — Crear una meta y aportarle (Priority: P1) 🎯 MVP

**Independent Test**: con $100.000 disponibles se crea una meta de $600.000 y se aportan $50.000: el
disponible queda en $50.000 y la meta en $50.000 (8 %).

### [BE]

- [X] T012 [P] [US1] [BE] Crear `backend/tests/integration/savings.test.ts`. Debe comprobar:
  - crear: 201, activa, saldo 0, nombre recortado; fecha pasada → 400; 5 activas y la sexta → `GOAL_LIMIT_REACHED`, también con 6 creaciones simultáneas;
  - listar: activas primero, `totalSaved`, `completed`;
  - aportar: saldos de la cuenta y la meta, movimiento «Aporte a {meta}» en la cuenta principal y «Aporte desde tu cuenta» en el historial de la meta;
  - aportar por encima del objetivo → `completed: true`;
  - `INSUFFICIENT_FUNDS` con el disponible; rango; tope diario con reinicio en el día de Bogotá;
  - idempotencia: misma respuesta; otro cuerpo → 409; doble clic simultáneo;
  - **concurrencia**: aportes simultáneos que superan el disponible;
  - FR-008: con todo el dinero en una meta, una transferencia y un pago con tarjeta se rechazan por saldo;
  - metas ajenas o ids inválidos → 404;
  - auditoría `GOAL_CREATED` y `SAVINGS_DEPOSIT` sin el nombre;
  - la suma del libro es 0 y cada saldo (principal y subcuentas) coincide con sus asientos.
- [X] T013 [US1] [BE] Crear `backend/src/modules/savings/savings.service.ts` con `list`, `create` (cuenta principal bloqueada, research R4), `deposit` (research R5), `listMovements` y `limits`.
- [X] T014 [US1] [BE] Crear `backend/src/modules/savings/savings.controller.ts` y `savings.routes.ts` para `GET /savings/goals`, `POST /savings/goals`, `POST /savings/goals/{goalId}/deposits`, `GET /savings/goals/{goalId}/movements` y `GET /savings/limits`. Agregar:
  - el limitador `savingsMovements` en `backend/src/middleware/rate-limit/limiters.ts`;
  - la composición en `backend/src/modules/banking.module.ts` y el montaje en `backend/src/app.ts`;
  - el registro de las operaciones en `backend/src/openapi/registry.ts`, quitándolas de `PENDING_BACKEND`.

### [FE]

- [X] T015 [P] [US1] [FE] Crear `frontend/tests/GoalsPage.test.tsx`: vacío, crear meta (validación de nombre, objetivo y fecha), progreso, «Cumplida», `GOAL_LIMIT_REACHED` y aportar con `INSUFFICIENT_FUNDS`.
- [X] T016 [P] [US1] [FE] Crear `frontend/src/features/savings/components/GoalCard.tsx` (barra con porcentaje en texto, no solo color), `GoalFormDialog.tsx` y `SavingsAmountDialog.tsx`.
- [X] T017 [US1] [FE] Crear:
  - `frontend/src/features/savings/api.ts` y los hooks (`useGoals`, `useCreateGoal`, `useDeposit`, `useSavingsLimits`);
  - `GoalsPage.tsx` y `GoalDetailPage.tsx` (progreso, aportar, historial);
  - las rutas `/metas` y `/metas/:id` y el acceso desde `HomePage`;
  - en `MovementItem` (spec 002), los tipos `savings_deposit` y `savings_withdrawal`.

### [E2E]

- [X] T018 [US1] [E2E] Crear `e2e/savings.spec.ts`: recargar, crear una meta, aportar y comprobar los dos saldos y el progreso.

---

## Phase 3: User Story 2 — Retirar de una meta (Priority: P2)

### [BE]

- [X] T019 [P] [US2] [BE] Agregar a `backend/tests/integration/savings.test.ts`:
  - retirar: saldos y movimientos «Retiro de {meta}» / «Retiro a tu cuenta»;
  - retiro mayor que la meta → `INSUFFICIENT_FUNDS` con el saldo de la meta;
  - los retiros cuentan para el mismo tope diario que los aportes;
  - **concurrencia**: retiros simultáneos que superan la meta, y aportes y retiros cruzados entre la cuenta y dos metas (sin deadlock; la suma disponible + metas no cambia);
  - auditoría `SAVINGS_WITHDRAWAL`.
- [X] T020 [US2] [BE] Agregar `withdraw` a `savings.service.ts` y `POST /savings/goals/{goalId}/withdrawals` al controlador y las rutas; registrar `withdrawFromGoal` y quitarla de `PENDING_BACKEND`.

### [FE]

- [X] T021 [US2] [FE] Agregar «Retirar» a `GoalDetailPage` con `SavingsAmountDialog`, y su prueba en `frontend/tests/GoalDetailPage.test.tsx`.

---

## Phase 4: User Story 3 — Administrar y cerrar metas (Priority: P3)

### [BE]

- [X] T022 [P] [US3] [BE] Agregar a `backend/tests/integration/savings.test.ts`:
  - editar nombre, objetivo y fecha (y quitarla); fecha pasada → 400; actualización vacía → 400;
  - cerrar con saldo: devuelve todo, `movement` «Cierre de {meta}», meta cerrada con saldo 0, deja de contar para el máximo;
  - cerrar sin saldo: `movement: null`;
  - una devolución mayor que `SAVINGS_MAX_AMOUNT` funciona, y no consume el tope diario;
  - una meta cerrada: aportar, retirar, editar y cerrar → 409 `GOAL_CLOSED`; sigue en la lista, al final, con su historial;
  - idempotencia del cierre;
  - **concurrencia**: cerrar con aportes en curso (ningún dinero se pierde: la suma disponible + metas no cambia);
  - la base impide modificar una meta cerrada y borrar metas;
  - auditoría `GOAL_CLOSED` con el monto devuelto.
- [X] T023 [US3] [BE] Agregar `update` y `close` (research R6, R7) a `savings.service.ts`, y `PATCH /savings/goals/{goalId}` y `POST /savings/goals/{goalId}/close` al controlador y las rutas. Registrar ambas, quitarlas de `PENDING_BACKEND` y dejar la lista vacía.

### [FE]

- [X] T024 [P] [US3] [FE] Agregar a `frontend/tests/GoalDetailPage.test.tsx`: editar, cerrar con confirmación que muestra el monto que vuelve, y una cerrada sin acciones.
- [X] T025 [US3] [FE] Agregar a `GoalDetailPage` editar (`GoalFormDialog`) y cerrar (diálogo de confirmación accesible); en `GoalsPage`, las cerradas al final y atenuadas.

### [E2E]

- [X] T026 [US3] [E2E] Ampliar `e2e/savings.spec.ts`: retirar, cerrar con saldo y comprobar que el disponible recupera todo.

---

## Phase 5: Polish

- [X] T027 [P] [FE] Revisar la accesibilidad y el diseño adaptable de `/metas` y `/metas/:id` (SC-006). Registrar el resultado en `specs/005-metas-ahorro/checklists/accessibility.md`.
- [X] T028 [E2E] Ejecutar la validación de [quickstart.md](quickstart.md) con todo integrado, antes de `/speckit-converge`.

---

## Dependencies & Execution Order

| Tareas | Dependen de |
| :--- | :--- |
| `[SH]` T001–T006 | Nada; cierran la definición |
| `[BE]`/`[FE]` | Definición integrada |
| US2, US3 | US1 (meta creada con saldo) |
| `[E2E]` | El workspace `e2e/` de la spec 001 |

## Implementation Strategy

Definición → base `[BE]` (T007–T011) → US1 → US2 → US3 → pulido. El backend puede ir en un solo PR,
como en la 004.
