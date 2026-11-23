---
description: "Task list for 006-presupuesto"
---

# Tasks: Presupuesto mensual por categorías

**Input**: Design documents from `/specs/006-presupuesto/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/budgets.openapi.json](contracts/budgets.openapi.json),
[quickstart.md](quickstart.md)

**Tests**: Incluidas (regla de dominio 10, alertas una sola vez con concurrencia, correo y cálculo
exacto).

## Format: `[ID] [P?] [Story?] [Capa] Description`

| Etiqueta | Rama |
| :--- | :--- |
| `[SH]` | `006-presupuesto` |
| `[BE]` | `006-presupuesto-be` |
| `[FE]` | `006-presupuesto-fe` |
| `[E2E]` | `006-presupuesto-fe` |

---

## Phase 1: Foundational (Blocking Prerequisites)

### [SH] Contrato en código — rama de definición

- [ ] T001 [P] [SH] Crear `shared/src/budgets.ts`:
  - `BUDGET_CATEGORIES` y `BudgetCategorySchema` (en el orden del contrato), `merchantToBudgetCategory`;
  - `BUDGET_LIMIT_MIN = 1000`, `BUDGET_LIMIT_MAX = 50_000_000` y `BUDGET_HISTORY_MONTHS = 6`;
  - `bogotaMonth(now)`, `addMonths(month, n)` e `isValidMonth`;
  - `budgetStatus(spent, limit)` → `{ percent, status }` (research R7).

  Pruebas en `shared/src/budgets.test.ts`: cambio de mes a las 00:00 de Bogotá; `addMonths` entre años; estados `none`, `ok`, `warning` (incluido exactamente el tope) y `exceeded`; porcentaje mayor que 100.
- [ ] T002 [SH] Crear `shared/src/budgets.schemas.ts`, cada esquema igual a [contracts/budgets.openapi.json](contracts/budgets.openapi.json):
  - `BudgetStatusSchema`, `BudgetCategorySummarySchema`, `BudgetMonthSchema`;
  - `BudgetMonthQuerySchema` (`month` opcional);
  - `SetBudgetLimitRequestSchema` (estricto);
  - `BudgetTransferSchema`, `BudgetTransfersPageSchema`, `BudgetTransfersQuerySchema`;
  - `SetTransferCategoryRequestSchema`;
  - `BudgetAlertSchema`, `BudgetAlertListSchema`.

  Reexportar ambos archivos en `shared/src/index.ts`.
- [ ] T003 [P] [SH] Pruebas:
  - en `shared/src/budgets.schemas.test.ts`: tope fuera de rango, categoría inválida, mes `2026-13`, campos extra;
  - en `shared/src/contract.test.ts`: `BUDGET_CATEGORIES` igual a `BudgetCategory` del contrato y sus 5 primeras iguales a las categorías de comercio de la 004, y los ejemplos del contrato válidos.
- [ ] T004 [P] [SH] Agregar las 7 operaciones de la 006 a `PENDING_BACKEND` en `backend/tests/contract/openapi.contract.test.ts`.

**Checkpoint de definición**: PR → `main`.

### [BE] Base

- [ ] T005 [BE] Agregar a `db/prisma/schema.prisma`:
  - los modelos `BudgetLimit` (data-model.md `BudgetLimit.user_id`, `BudgetLimit.category`, `BudgetLimit.effective_month`, `BudgetLimit.monthly_limit`, `BudgetLimit.updated_at`), `TransferCategory` (`TransferCategory.transaction_id`, `TransferCategory.user_id`, `TransferCategory.category`, `TransferCategory.updated_at`) y `BudgetAlert` (`BudgetAlert.id`, `BudgetAlert.user_id`, `BudgetAlert.month`, `BudgetAlert.category`, `BudgetAlert.threshold`, `BudgetAlert.spent`, `BudgetAlert.monthly_limit`, `BudgetAlert.created_at`, `BudgetAlert.seen_at`);
  - el enum `budget_category` y el valor `budget_alert` en `email_template`.
- [ ] T006 [BE] Generar la migración y agregar a mano los `CHECK` de data-model.md `BudgetLimit.effective_month`, `BudgetLimit.monthly_limit`, `BudgetAlert.month` y `BudgetAlert.threshold`. Aplicarla a `nova` y `nova_e2e`.
- [ ] T007 [P] [BE] Crear `backend/src/lib/events.ts` (bus en proceso con `spending.recorded`; `emit` espera a los suscriptores y registra sus errores sin lanzarlos, research R2) con pruebas en `backend/tests/unit/events.test.ts`.
- [ ] T008 [P] [BE] Agregar la plantilla `budget_alert` en `backend/src/lib/mail/templates/index.ts` (research R6), con su prueba en `backend/tests/unit/` junto a las de las otras plantillas.
- [ ] T009 [BE] Agregar consultas públicas para `budgets` (research R1, R3):
  - `ledger.completedTransactions(db, accountId, type, desde, hasta)` y su versión paginada por cursor, en `backend/src/modules/ledger/`;
  - `payments.spendingByCategory(db, userId, desde, hasta)` en `backend/src/modules/cards/` (SQL con `GROUP BY`).
- [ ] T010 [BE] Emitir `spending.recorded` tras confirmar una transferencia nueva (`backend/src/modules/transfers/transfers.service.ts`) y un pago aprobado nuevo (`backend/src/modules/cards/payments.service.ts`); no en repeticiones idempotentes. Crear el bus en `backend/src/modules/banking.module.ts`.
- [ ] T011 [BE] Crear `backend/src/modules/budgets/budgets.repository.ts`:
  - topes vigentes por mes (research R4) y *upsert* del mes actual;
  - clasificaciones de transferencias;
  - insertar alertas con `ON CONFLICT DO NOTHING RETURNING id`, listar y marcar vistas.

---

## Phase 2: User Story 1 — Poner topes y ver cuánto llevo (Priority: P1) 🎯 MVP

**Independent Test**: con un tope de $20.000 en Comida y pagos por $5.000 en la Cafetería Central, el
resumen muestra Comida con $5.000 de $20.000 (25 %).

### [BE]

- [ ] T012 [P] [US1] [BE] Crear `backend/tests/integration/budgets.test.ts`. Debe comprobar:
  - resumen vacío: 7 categorías, `none`, total 0;
  - pagos con tarjeta en comercios de varias categorías y transferencias enviadas suman donde corresponde; las recibidas, recargas, metas y pagos rechazados no cuentan;
  - el total coincide al peso con la suma de pagos y transferencias del mes (SC-003);
  - poner, cambiar y quitar topes; tope fuera de rango → 400; categoría inválida → 400;
  - un gasto que supera el tope se realiza igual (FR-008);
  - mes inválido o fuera de los 6 anteriores → 400;
  - cada estudiante ve solo lo suyo.
- [ ] T013 [US1] [BE] Crear `backend/src/modules/budgets/budgets.service.ts` con `monthSummary`, `setLimit` y `removeLimit` (research R3, R4, R7).
- [ ] T014 [US1] [BE] Crear `backend/src/modules/budgets/budgets.controller.ts` y `budgets.routes.ts` para `GET /budgets`, `PUT /budgets/limits/{category}` y `DELETE /budgets/limits/{category}`. Montar en `backend/src/app.ts` y registrar las operaciones en `backend/src/openapi/registry.ts`, quitándolas de `PENDING_BACKEND`.

### [FE]

- [ ] T015 [P] [US1] [FE] Crear `frontend/tests/BudgetPage.test.tsx`: resumen vacío, poner tope con validación, porcentajes y estados con texto.
- [ ] T016 [US1] [FE] Crear `frontend/src/features/budgets/` (api, hooks, `BudgetPage.tsx`, `BudgetCategoryRow.tsx`, `BudgetLimitDialog.tsx`) y la ruta `/presupuesto` con acceso desde `HomePage`.

---

## Phase 3: User Story 2 — Recibir alertas (Priority: P2)

### [BE]

- [ ] T017 [P] [US2] [BE] Agregar a `backend/tests/integration/budgets.test.ts`:
  - un pago al 80 % crea la alerta 80 y un correo; al pasar el 100 %, la alerta 100 y otro correo; un tercer pago no crea más;
  - un salto del 50 % al 120 % crea las dos;
  - exactamente el tope crea solo la del 80 %;
  - bajar un tope por debajo de lo gastado genera las alertas; subirlo no las repite;
  - una transferencia también genera alertas en «Transferencias»;
  - **concurrencia**: pagos simultáneos que cruzan el mismo umbral crean una sola alerta y un solo correo;
  - el correo llega al correo de la estudiante con el asunto correcto (`deliverEmails` y la bandeja en memoria);
  - **regla de dominio 10**: si la evaluación falla, el pago responde 201 igual y el saldo cambia;
  - listar alertas del mes y marcarlas vistas; una alerta ajena → 404.
- [ ] T018 [US2] [BE] Agregar `evaluateCurrentMonth` (research R5; suscrito a `spending.recorded` en `banking.module.ts` y llamado desde `setLimit`), `listAlerts` y `markSeen` al servicio, y `GET /budgets/alerts` y `POST /budgets/alerts/{alertId}/seen` al controlador y las rutas. Registrar ambas y quitarlas de `PENDING_BACKEND`.

### [FE]

- [ ] T019 [P] [US2] [FE] Crear `frontend/tests/BudgetAlerts.test.tsx`: el aviso del inicio y el mensaje tras un gasto que marca la alerta como vista.
- [ ] T020 [US2] [FE] Crear `BudgetAlertBanner.tsx` (inicio) y `BudgetAlertToast.tsx`, mostrado tras pagar (`/tienda`) y transferir (`/enviar`).

### [E2E]

- [ ] T021 [US2] [E2E] Crear `e2e/budgets.spec.ts`: poner un tope, pagar hasta pasar el 80 % y comprobar el mensaje, el aviso del inicio y el correo en Mailpit.

---

## Phase 4: User Story 3 — Reclasificar transferencias y ver meses anteriores (Priority: P3)

### [BE]

- [ ] T022 [P] [US3] [BE] Agregar a `backend/tests/integration/budgets.test.ts`:
  - listar las transferencias enviadas del mes (paginadas) con su categoría;
  - reclasificar mueve el monto entre categorías y puede generar alertas del mes actual;
  - una transferencia recibida o ajena → 404;
  - historial: el mes anterior muestra sus gastos y el tope que tenía, aunque después cambió (topes versionados).
- [ ] T023 [US3] [BE] Agregar `listTransfers` y `setTransferCategory` al servicio, y `GET /budgets/transfers` y `PUT /budgets/transfers/{transactionId}/category` al controlador y las rutas. Registrarlas y dejar `PENDING_BACKEND` vacío.

### [FE]

- [ ] T024 [US3] [FE] Agregar a `BudgetPage` el selector de mes (solo lectura en meses pasados) y la lista de transferencias con su selector de categoría, con pruebas en `frontend/tests/BudgetPage.test.tsx`.

---

## Phase 5: Polish

- [ ] T025 [P] [FE] Revisar la accesibilidad y el diseño adaptable de `/presupuesto` y del aviso del inicio (SC-005). Registrar el resultado en `specs/006-presupuesto/checklists/accessibility.md`.
- [ ] T026 [E2E] Ejecutar la validación de [quickstart.md](quickstart.md) con todo integrado, antes de `/speckit-converge`.

---

## Dependencies & Execution Order

| Tareas | Dependen de |
| :--- | :--- |
| `[SH]` T001–T004 | Nada; cierran la definición |
| `[BE]`/`[FE]` | Definición integrada |
| US2 | US1 (topes) |
| US3 | US1 |
| `[E2E]` | El workspace `e2e/` de la spec 001 |

## Implementation Strategy

Definición → base `[BE]` (T005–T011) → US1 → US2 → US3 → pulido. El backend puede ir en un solo PR.
