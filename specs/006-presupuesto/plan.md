# Implementation Plan: Presupuesto mensual por categorías

**Branch**: `006-presupuesto` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-presupuesto/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Cada estudiante pone topes mensuales a 7 categorías y ve cuánto lleva gastado en cada una. Los pagos
con tarjeta se clasifican solos por la categoría del comercio y las transferencias enviadas caen en
«Transferencias», reclasificables. Al llegar al 80 % y al pasar el 100 % de un tope, Nova crea una
alerta (una vez por umbral, categoría y mes), la muestra en la app y la envía por correo. Los topes se
repiten cada mes y el historial muestra los 6 meses anteriores. El presupuesto nunca bloquea un gasto.

**Enfoque técnico** (detalle en [research.md](research.md)):

| Tema | Decisión |
| :--- | :--- |
| Módulo | `budgets` nuevo, dueño de 3 tablas; pide los gastos a `cards` y `ledger` (R1, R3) |
| Detección de gastos | Evento en proceso `spending.recorded`, emitido tras confirmar la operación; los errores del suscriptor solo se registran (R2) |
| Topes que se repiten | Versiones por `effective_month` (R4) |
| Alertas | Índice único por umbral, categoría y mes; correo encolado solo para las nuevas (R5, R6) |
| Contratos existentes | Sin cambios: ni `Movement` ni los resultados de la 003 y la 004 |

## Technical Context

**Language/Version**: igual que las specs 001–005 (TypeScript 6.0, Node.js 24, React 19).

**Primary Dependencies**: **ninguna nueva.**

**Storage**: PostgreSQL 17. Tres tablas nuevas, un enum nuevo y un valor nuevo en `email_template`.
Ver [data-model.md](data-model.md).

**Testing**: igual que la 005, más pruebas de: alertas una sola vez con gastos simultáneos, correo
entregado por el worker con la bandeja en memoria, un suscriptor que falla sin afectar el pago,
historial con topes versionados y cálculo exacto contra la suma de pagos y transferencias.

**Performance Goals**: poner un tope y ver lo gastado en menos de 30 s (SC-001).

**Constraints**: regla de dominio 10 (informativo, nunca bloquea); meses en hora de Bogotá.

**Scale/Scope**: 7 operaciones nuevas, 1 pantalla con historial y reclasificación, 3 tablas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / regla | Verificación | Estado |
| :--- | :--- | :--- |
| I. Dinero exacto | El presupuesto no mueve dinero; montos enteros en pesos (R3) | ✅ |
| II. SDD | Sin categorías personalizadas, presupuesto total ni push (fuera de la spec) | ✅ |
| III. Mínimo privilegio | Transferencias y alertas ajenas → 404 (FR-013) | ✅ |
| III. Datos personales y logs | El correo de alerta solo lleva categoría y montos; sin secretos en el payload (R6) | ✅ |
| VI. Monolito modular | `budgets` no lee tablas ajenas; `cards` y `ledger` exponen consultas públicas (R1) | ✅ |
| VI. Contratos primero | [contracts/budgets.openapi.json](contracts/budgets.openapi.json); los contratos existentes no cambian | ✅ |
| Regla de dominio 10 | Alertas al 80 % y al pasar el 100 %; el evento se emite tras confirmar y sus errores no afectan la respuesta (R2, R5) | ✅ |
| Supuesto operativo: zona horaria | Meses en `America/Bogota` (R3, R8) | ✅ |

**Estado del gate**: ✅ aprobado, sin violaciones ni enmiendas.

## Project Structure

```text
specs/006-presupuesto/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md · tasks.md
├── contracts/budgets.openapi.json
└── checklists/requirements.md

shared/src/
├── budgets.ts               # [SH] BUDGET_CATEGORIES, BudgetCategorySchema, BUDGET_LIMIT_MIN/MAX,
│                            #      BUDGET_HISTORY_MONTHS, bogotaMonth, addMonths, budgetStatus
└── budgets.schemas.ts       # [SH] BudgetMonth, BudgetCategorySummary, SetBudgetLimitRequest,
                             #      BudgetMonthQuery, BudgetTransfer(sPage/Query), SetTransferCategoryRequest,
                             #      BudgetAlert, BudgetAlertList

db/prisma/                   # [BE] BudgetLimit, TransferCategory, BudgetAlert; enums; migración

backend/src/
├── lib/events.ts                    # [BE] bus en proceso: spending.recorded
├── lib/mail/templates/index.ts      # [BE] plantilla budget_alert
├── modules/cards/payments.service.ts   # [BE] + spendingByCategory; emite spending.recorded
├── modules/transfers/transfers.service.ts # [BE] emite spending.recorded
├── modules/ledger/                  # [BE] + completedTransactions (lista y página)
└── modules/budgets/                 # [BE] repository, service, controller, routes

frontend/src/                        # [FE]
├── features/budgets/pages/BudgetPage.tsx    # resumen del mes, topes, selector de mes, transferencias
├── features/budgets/components/BudgetCategoryRow.tsx · BudgetLimitDialog.tsx · BudgetAlertToast.tsx
└── features/home/components/BudgetAlertBanner.tsx   # aviso en el inicio

e2e/budgets.spec.ts                  # [E2E]
```

## Diseño del backend

### Endpoints

Todos con `require-auth`. Detalle en [contracts/budgets.openapi.json](contracts/budgets.openapi.json).

| Método y ruta | Historia | Requisitos |
| :--- | :--- | :--- |
| `GET /budgets?month=` | US1, US3 | FR-001–FR-007 |
| `PUT /budgets/limits/{category}` | US1 | FR-005, FR-012 |
| `DELETE /budgets/limits/{category}` | US1 | FR-005 |
| `GET /budgets/alerts` | US2 | FR-011 |
| `POST /budgets/alerts/{alertId}/seen` | US2 | FR-011 |
| `GET /budgets/transfers?month=` | US3 | FR-013 |
| `PUT /budgets/transfers/{transactionId}/category` | US3 | FR-003, FR-012, FR-013 |

Una categoría inválida en la ruta responde 400; una transferencia o alerta que no es UUID, no existe o
es de otra persona responde 404.

### Evento `spending.recorded`

| Emisor | Cuándo |
| :--- | :--- |
| `transfers.create` (spec 003) | Tras confirmar una transferencia nueva (no en repeticiones idempotentes), para quien envía |
| `payments.pay` (spec 004) | Tras confirmar un pago aprobado nuevo |

Suscriptor: `budgets.evaluateCurrentMonth(userId)`. El bus atrapa y registra cualquier error.

## Diseño del frontend

| Ruta | Pantalla | Estados |
| :--- | :--- | :--- |
| `/presupuesto` | `BudgetPage`: total del mes; `BudgetCategoryRow` por categoría (gastado / tope, barra con porcentaje en texto, estado con texto e icono, no solo color); «Poner tope» (`BudgetLimitDialog`); selector del mes actual y los 6 anteriores (solo lectura en meses pasados); lista de transferencias enviadas del mes con selector de categoría | Carga; sin gastos ni topes («Pon tu primer tope»); 400 en el diálogo |
| `/inicio` (002) | `BudgetAlertBanner`: categorías en `warning` o `exceeded` del mes, con acceso a `/presupuesto` | Oculto si no hay |
| Tras pagar o transferir (003, 004) | `BudgetAlertToast`: consulta `GET /budgets/alerts`, muestra las no vistas y las marca vistas | — |

Tras pagar o transferir, invalidar `['budget']` y `['budget-alerts']`.

## Paquete `@nova/shared`

| Exportación | Uso |
| :--- | :--- |
| `BUDGET_CATEGORIES`, `BudgetCategorySchema`, `merchantToBudgetCategory` | Categorías (FR-001, FR-002) |
| `BUDGET_LIMIT_MIN`, `BUDGET_LIMIT_MAX`, `BUDGET_HISTORY_MONTHS` | Reglas de topes y historial |
| `bogotaMonth(now)`, `addMonths(month, n)`, `isValidMonth` | Meses (R8) |
| `budgetStatus(spent, limit)` | Porcentaje y estado (R7) |
| Esquemas de `budgets.schemas.ts` | API |

## Guía para `/speckit-tasks`

Las etiquetas `[SH]`, `[BE]`, `[FE]` y `[E2E]` tienen el mismo alcance que en la 005. Orden de las
historias: US1 (topes y resumen) → US2 (alertas) → US3 (reclasificar e historial).

## Complexity Tracking

| Decisión | Por qué se necesita | Alternativa más simple descartada porque |
| :--- | :--- | :--- |
| Bus de eventos en proceso | Alertar en el momento del gasto sin que `transfers` y `cards` dependan de `budgets` (R2) | Llamar a `budgets` desde esos módulos invierte la dependencia; evaluar al consultar retrasa el correo |
| Topes versionados por mes | Historial con el tope de cada mes (FR-007, R4) | Copiar todos los topes cada mes exige un proceso programado |
