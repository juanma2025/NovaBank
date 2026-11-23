---
description: "Task list for 007-gastos-compartidos"
---

# Tasks: Gastos compartidos

**Input**: Design documents from `/specs/007-gastos-compartidos/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/splits.openapi.json](contracts/splits.openapi.json),
[quickstart.md](quickstart.md)

**Tests**: Incluidas (regla de dominio 11, concurrencia del pago y reglas de transferencias
heredadas).

## Format: `[ID] [P?] [Story?] [Capa] Description`

| Etiqueta | Rama |
| :--- | :--- |
| `[SH]` | `007-gastos-compartidos` |
| `[BE]` | `007-gastos-compartidos-be` |
| `[FE]` | `007-gastos-compartidos-fe` |
| `[E2E]` | `007-gastos-compartidos-fe` |

---

## Phase 1: Foundational (Blocking Prerequisites)

### [SH] Contrato en código — rama de definición

- [ ] T001 [P] [SH] Crear `shared/src/splits.ts` con `SPLIT_MAX_PARTICIPANTS = 10`, `SPLIT_TOTAL_MIN = 2000`, `SPLIT_TOTAL_MAX = 5_000_000`, `SPLIT_TITLE_MAX_LENGTH = 60`, `SPLIT_REMINDER_INTERVAL_HOURS = 24` y `splitEvenly(total, participants)` → `{ creatorShare, share }` (research R4). Pruebas en `shared/src/splits.test.ts`: división exacta, sobrante para quien crea ($10.000 entre 3 → 3.334 y 3.333) y 10 participantes.
- [ ] T002 [SH] Agregar a `shared/src/errors.ts` los códigos `SPLIT_SHARES_MISMATCH`, `SPLIT_SHARE_OUT_OF_RANGE`, `SPLIT_CLOSED`, `SHARE_NOT_PENDING` y `SPLIT_REMINDER_TOO_SOON`.

  Agregar sus mensajes y estados HTTP en `backend/src/lib/error-messages.ts` y `backend/src/lib/errors.ts`:
  - 422: `SPLIT_SHARES_MISMATCH` y `SPLIT_SHARE_OUT_OF_RANGE`;
  - 409: `SPLIT_CLOSED` y `SHARE_NOT_PENDING`;
  - 429: `SPLIT_REMINDER_TOO_SOON`.
- [ ] T003 [SH] Crear `shared/src/splits.schemas.ts`, cada esquema igual a [contracts/splits.openapi.json](contracts/splits.openapi.json):
  - `SplitStatusSchema`, `SplitShareStatusSchema`, `SplitRoleSchema`;
  - `SplitShareSchema`, `SplitSchema`, `SplitListItemSchema`, `SplitsPageSchema`, `SplitsQuerySchema`;
  - `PendingTotalsSchema`, `SplitsSummarySchema`;
  - `CreateSplitRequestSchema` (estricto; título recortado; 1–10 partes);
  - `PayShareRequestSchema`, `PayShareResultSchema`.

  Reexportar ambos archivos en `shared/src/index.ts`.
- [ ] T004 [P] [SH] Pruebas:
  - en `shared/src/splits.schemas.test.ts`: título vacío o largo, total fuera de rango, 0 u 11 partes, campos extra;
  - en `shared/src/contract.test.ts`: `Movement` de la 007 igual al de la 002, y ejemplos válidos.
- [ ] T005 [P] [SH] Agregar las 9 operaciones de la 007 a `PENDING_BACKEND` en `backend/tests/contract/openapi.contract.test.ts`.

**Checkpoint de definición**: PR → `main`.

### [BE] Base

- [ ] T006 [BE] Agregar a `db/prisma/schema.prisma`:
  - los modelos `Split` (data-model.md `Split.id`, `Split.creator_user_id`, `Split.title`, `Split.total_amount`, `Split.creator_share`, `Split.status`, `Split.created_at`, `Split.updated_at`, `Split.closed_at`) y `SplitShare` (`SplitShare.id`, `SplitShare.split_id`, `SplitShare.user_id`, `SplitShare.amount`, `SplitShare.status`, `SplitShare.transfer_transaction_id`, `SplitShare.resolved_at`, `SplitShare.last_reminded_at`, `SplitShare.created_at`);
  - los enums `split_status` y `split_share_status`;
  - los valores `split_invitation`, `split_reminder` y `split_paid` en `email_template`.
- [ ] T007 [BE] Generar la migración y agregar a mano:
  - los `CHECK` de data-model.md `Split.total_amount`, `Split.creator_share`, `Split.closed_at`, `SplitShare.amount`, `SplitShare.transfer_transaction_id` y `SplitShare.resolved_at`;
  - los triggers de data-model.md: una división cerrada no vuelve a `open`; una parte solo sale de `pending`; sin borrados.

  Aplicarla a `nova` y `nova_e2e`.
- [ ] T008 [P] [BE] Agregar las plantillas `split_invitation`, `split_reminder` y `split_paid` en `backend/src/lib/mail/templates/index.ts` (research R6), con pruebas en `backend/tests/unit/mail-templates.test.ts`.
- [ ] T009 [BE] Agregar a `transfers.create` el segundo argumento opcional `{ inTransaction }` (research R2) en `backend/src/modules/transfers/transfers.service.ts`. No se ejecuta en las repeticiones idempotentes. Agregar a `backend/tests/integration/transfers.test.ts` que un error dentro de `inTransaction` revierte la transferencia entera.
- [ ] T010 [BE] Crear `backend/src/modules/splits/splits.repository.ts`:
  - crear la división con sus partes;
  - buscar la división visible para un usuario (creador o participante);
  - bloquear la división y una parte (`FOR UPDATE`);
  - resolver una parte, cerrar la división y completarla si no quedan pendientes;
  - listar por cursor y calcular el resumen (research R8).

---

## Phase 2: User Story 1 — Dividir un gasto y pagar mi parte (Priority: P1) 🎯 MVP

**Independent Test**: Ana divide $90.000 con Juan y Laura; Juan paga: su saldo baja $30.000, el de Ana
sube $30.000 y su parte queda pagada.

### [BE]

- [ ] T011 [P] [US1] [BE] Crear `backend/tests/integration/splits.test.ts`. Debe comprobar:
  - crear: partes, parte propia y estado `open`; crear no mueve dinero; correos de invitación;
  - suma que no cuadra → `SPLIT_SHARES_MISMATCH`; parte fuera del rango de transferencias → `SPLIT_SHARE_OUT_OF_RANGE`; participante repetido, quien crea como participante, 0 u 11 → 400; participante inexistente → 404;
  - ver la división: creador y participantes sí; los demás → 404;
  - pagar: saldos, parte `paid` con su transferencia, nota «Gasto compartido: {título}», correo a quien creó;
  - pagar la última parte completa la división;
  - pagar por encima del umbral exige contraseña (`REAUTH_REQUIRED`) y sin saldo → `INSUFFICIENT_FUNDS`, y la parte sigue pendiente;
  - pagar una parte ya pagada → `SHARE_NOT_PENDING`; idempotencia: la misma clave devuelve lo mismo;
  - **concurrencia**: dos pagos simultáneos de la misma parte con claves distintas → una sola transferencia;
  - la suma del libro es 0.
- [ ] T012 [US1] [BE] Crear `backend/src/modules/splits/splits.service.ts` con `create` (research R3, R4, R6), `get` y `payMyShare` (research R2).
- [ ] T013 [US1] [BE] Crear `backend/src/modules/splits/splits.controller.ts` y `splits.routes.ts` para `POST /splits`, `GET /splits/{splitId}` y `POST /splits/{splitId}/shares/me/pay`. Agregar:
  - el limitador `splitCreate`;
  - la composición en `backend/src/modules/banking.module.ts` y el montaje en `backend/src/app.ts`;
  - el registro de las operaciones en `backend/src/openapi/registry.ts`, quitándolas de `PENDING_BACKEND`.

### [FE]

- [ ] T014 [P] [US1] [FE] Crear `frontend/tests/NewSplitPage.test.tsx` y `frontend/tests/SplitDetailPage.test.tsx`:
  - partes propuestas y editables, con la suma visible;
  - errores de participantes y de suma;
  - «Pagar mi parte», con contraseña sobre el umbral y reintento con la misma clave.
- [ ] T015 [US1] [FE] Crear `frontend/src/features/splits/` (api, hooks, `NewSplitPage.tsx` y `SplitDetailPage.tsx`) y las rutas `/compartidos/nueva` y `/compartidos/:id`.

### [E2E]

- [ ] T016 [US1] [E2E] Crear `e2e/splits.spec.ts`: dos contextos; Ana divide con Juan; Juan paga su parte; los saldos y el estado son correctos.

---

## Phase 3: User Story 2 — Seguir y gestionar mis divisiones (Priority: P2)

### [BE]

- [ ] T017 [P] [US2] [BE] Agregar a `backend/tests/integration/splits.test.ts`:
  - listar (creadas y como participante, paginado) y el resumen «te deben / debes»;
  - marcar pagada por fuera (sin mover dinero) y rechazar;
  - la división se completa al resolver la última parte;
  - recordar: correo; un segundo antes de 24 h → `SPLIT_REMINDER_TOO_SOON` con `retryAfterSeconds`, y después de 24 h funciona;
  - cancelar: pendientes canceladas, pagadas intactas; luego pagar → `SPLIT_CLOSED`;
  - **concurrencia**: pagar mientras se cancela (nunca se transfiere por una parte cancelada);
  - las acciones de quien creó, pedidas por un participante o un tercero → 404;
  - la base impide reabrir una división y cambiar una parte resuelta.
- [ ] T018 [US2] [BE] Agregar `list`, `summary`, `declineMyShare`, `markPaid`, `remind` y `cancel` al servicio, y sus rutas al controlador. Registrarlas y dejar `PENDING_BACKEND` vacío.

### [FE]

- [ ] T019 [P] [US2] [FE] Agregar pruebas de la lista, el resumen del inicio y las acciones (marcar, rechazar, recordar con `SPLIT_REMINDER_TOO_SOON` y cancelar con confirmación).
- [ ] T020 [US2] [FE] Crear `SplitsPage.tsx` (ruta `/compartidos`), `SplitsSummaryCard.tsx` en el inicio y las acciones según el rol en `SplitDetailPage`.

---

## Phase 4: Polish

- [ ] T021 [P] [FE] Revisar la accesibilidad y el diseño adaptable de las pantallas de gastos compartidos (SC-005). Registrar el resultado en `specs/007-gastos-compartidos/checklists/accessibility.md`.
- [ ] T022 [E2E] Ejecutar la validación de [quickstart.md](quickstart.md) con todo integrado, antes de `/speckit-converge`.

---

## Dependencies & Execution Order

| Tareas | Dependen de |
| :--- | :--- |
| `[SH]` T001–T005 | Nada; cierran la definición |
| `[BE]`/`[FE]` | Definición integrada |
| US2 | US1 |
| `[FE]` | La vista previa de destinatario del frontend de la 003 |
| `[E2E]` | El workspace `e2e/` |

## Implementation Strategy

Definición → base `[BE]` (T006–T010) → US1 → US2 → pulido. El backend puede ir en un solo PR.
