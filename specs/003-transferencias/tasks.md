---
description: "Task list for 003-transferencias"
---

# Tasks: Transferencias entre estudiantes

**Input**: Design documents from `/specs/003-transferencias/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/transfers.openapi.json](contracts/transfers.openapi.json),
[quickstart.md](quickstart.md)

**Tests**: Incluidas (una por regla de dominio, concurrencia, reautenticación y E2E del flujo
crítico «enviar fondos»).

## Format: `[ID] [P?] [Story?] [Capa] Description`

Capas y ramas como en la 002:

| Etiqueta | Rama |
| :--- | :--- |
| `[SH]` | `003-transferencias` |
| `[BE]` | `003-transferencias-be` |
| `[FE]` | `003-transferencias-fe` |
| `[E2E]` | `003-transferencias-fe` |

---

## Phase 1: Foundational (Blocking Prerequisites)

### [SH] Contrato en código — rama de definición

- [ ] T001 [P] [SH] Crear `shared/src/names.ts` con `partialName(fullName)`: primer nombre completo e inicial con punto de cada palabra restante («Ana Pérez Gómez» → «Ana P. G.»; «Lu» → «Lu»; respeta guiones y tildes). Pruebas en `shared/src/names.test.ts`.
- [ ] T002 [SH] Cambiar en `shared/src/accounts.schemas.ts`: `MovementTypeSchema` agrega `transfer` y `MovementSchema` agrega `note` (`string ≤ 140 | null`), igual que `Movement` en los contratos de la 002 y la 003 (research R8).

  Para que el CI siga en verde, el backend de la 002 debe enviar `note: null` en `toMovement` (`backend/src/modules/ledger/ledger.service.ts`) hasta T010.
- [ ] T003 [SH] Agregar a `shared/src/errors.ts`:
  - los códigos `ALIAS_TAKEN`, `RECIPIENT_NOT_FOUND`, `TRANSFER_TO_SELF`, `TRANSFER_AMOUNT_OUT_OF_RANGE`, `TRANSFER_DAILY_LIMIT`, `INSUFFICIENT_FUNDS`, `REAUTH_REQUIRED`, `REAUTH_FAILED` y `REAUTH_LOCKED`;
  - en `details`, `availableBalance` y `reauthThreshold`.

  Agregar sus mensajes y estados HTTP en `backend/src/lib/error-messages.ts` y `backend/src/lib/errors.ts`:
  - 409: `ALIAS_TAKEN`;
  - 404: `RECIPIENT_NOT_FOUND`;
  - 429: `REAUTH_LOCKED`;
  - 422: los demás.
- [ ] T004 [SH] Crear `shared/src/transfers.schemas.ts`, cada esquema igual a [contracts/transfers.openapi.json](contracts/transfers.openapi.json):
  - `AliasSchema`: `trim`, quita la `@` inicial, minúsculas y el patrón de data-model.md `Profile.alias`;
  - `ProfileSchema`, `SetAliasRequestSchema`;
  - `RecipientQuerySchema` (`q` de 3 a 254) y `RecipientPreviewSchema`;
  - `TransferLimitsSchema`;
  - `CreateTransferRequestSchema` (estricto; `note` ≤ 140 o null; `password` opcional de 1 a 128);
  - `TransferResultSchema`.

  Agregar también la constante `TRANSFER_NOTE_MAX_LENGTH = 140` y reexportar todo en `shared/src/index.ts`.
- [ ] T005 [P] [SH] Pruebas en `shared/src/transfers.schemas.test.ts`:
  - `AliasSchema` normaliza «@Ana.Perez» → «ana.perez» y rechaza «.ab», «ab_», «a», «con espacio» y «ñandu»;
  - `CreateTransferRequest` rechaza campos extra y notas de más de 140 caracteres;
  - los ejemplos del contrato son válidos.
- [ ] T006 [P] [SH] Agregar a `.env.example` `TRANSFER_MIN_AMOUNT=1000`, `TRANSFER_MAX_AMOUNT=500000`, `TRANSFER_DAILY_LIMIT=1000000` y `TRANSFER_REAUTH_THRESHOLD=200000`, con comentarios.

**Checkpoint de definición**: PR → `main`. Ambos aprueban también el cambio en el contrato de la 002.

### [BE] Base

- [ ] T007 [BE] Agregar a `db/prisma/schema.prisma`:
  - el modelo `Profile` (data-model.md `Profile.user_id`, `Profile.alias`, `Profile.updated_at`);
  - en `LedgerTransaction`, data-model.md `LedgerTransaction.counterparty_account_id` y `LedgerTransaction.note`;
  - en `LedgerEntry`, data-model.md `LedgerEntry.description`;
  - el valor `transfer` en `ledger_transaction_type` y `TRANSFER_COMPLETED` y `ALIAS_CHANGED` en `audit_event_type`.
- [ ] T008 [BE] Generar la migración `db/prisma/migrations/<timestamp>_transfers/migration.sql` y agregarle a mano:
  - el `CHECK` de formato de data-model.md `Profile.alias`;
  - el `CHECK` de transferencias sobre data-model.md `LedgerTransaction.counterparty_account_id`;
  - la redefinición de `ledger_transactions_guard()` para que `counterparty_account_id` y `note` tampoco puedan cambiar.

  Aplicarla a `nova`, `nova_test` y `nova_e2e`.
- [ ] T009 [P] [BE] Agregar a `backend/src/config/env.ts` las 4 variables `TRANSFER_*` con la regla `min ≤ umbral ≤ max ≤ tope` (research R9), y a `backend/vitest.config.ts` valores de prueba (1000 / 20000 / 50000 / 60000).
- [ ] T010 [BE] Ampliar el módulo `ledger`:
  - `post` acepta `counterpartyAccountId`, `note` y `description` por línea (data-model.md `LedgerEntry.description`);
  - `toMovement` usa la descripción del asiento si existe y `note` de la operación (data-model.md, «Movement»), reemplazando el `note: null` provisional de T002;
  - `sumCompletedSince` sirve para `transfer`.

  Archivos: `backend/src/modules/ledger/ledger.service.ts` y `ledger.repository.ts`.
- [ ] T011 [BE] Agregar `lockManyForUpdate(tx, ids)` (ordena ascendente y bloquea en ese orden, research R6) y `findStudentAccountById(db, id)` en `backend/src/modules/accounts/accounts.service.ts` y `accounts.repository.ts`.
- [ ] T012 [BE] Crear en el módulo `auth`:
  - `backend/src/modules/auth/auth.directory.ts`: `findByEmail` y `findById` → `{ userId, fullName, email }`;
  - `backend/src/modules/auth/reauth.service.ts`: `verify(userId, password, requestId)` con Argon2. Los fallos van a `login_attempts` con `origin_key = sha256('reauth:' + userId)` (5 fallos en 15 min dan 15 min de bloqueo → `REAUTH_LOCKED`); un acierto borra esos fallos; cada fallo lanza `REAUTH_FAILED` (research R4).

  Exponer ambos en `createAuthModule`.
- [ ] T013 [BE] Actualizar las pruebas de la 002 para el campo `note` y el tipo `transfer` (`backend/tests/integration/accounts.test.ts`, `movements.test.ts`) y verificar que la prueba de contrato cubre las 22 operaciones de las tres specs.

---

## Phase 2: User Story 1 — Enviar dinero a un compañero (Priority: P1) 🎯 MVP

**Independent Test**: con A en $50.000, enviar $15.000 a B → A queda en $35.000, B sube $15.000, y
cada uno ve su movimiento con signo y nota.

### [BE]

- [ ] T014 [P] [US1] [BE] Crear `backend/tests/integration/transfers.test.ts`. Debe comprobar:
  - vista previa por correo y por alias, con nombre parcial y correo enmascarado;
  - `RECIPIENT_NOT_FOUND`;
  - `TRANSFER_TO_SELF` en la vista previa y en el envío;
  - una transferencia válida: saldos, movimientos con signo, descripciones distintas por cuenta y nota;
  - rango y tope diario de lo enviado (lo recibido no cuenta), que se reinicia en el día siguiente de Bogotá;
  - `INSUFFICIENT_FUNDS` con `availableBalance`; enviar todo el saldo deja $0;
  - por encima del umbral: sin contraseña → `REAUTH_REQUIRED`; incorrecta → `REAUTH_FAILED` sin mover dinero; 5 fallos → `REAUTH_LOCKED`; correcta → 201;
  - idempotencia: la misma clave da la misma respuesta; otro cuerpo da 409; la contraseña no entra en el hash;
  - **concurrencia**:
    - A→B y B→A simultáneas sin *deadlock* (SC-005);
    - 5 envíos simultáneos que juntos superan el saldo: solo se aplican los que caben y el saldo nunca es negativo;
  - el destinatario fijado por id aunque el alias cambie de dueño (FR-005);
  - auditoría `TRANSFER_COMPLETED`;
  - la suma del libro es 0.
- [ ] T015 [US1] [BE] Crear `backend/src/modules/transfers/transfers.service.ts` con `findRecipient(userId, q)` (correo → `auth.directory`; alias → `profile.findUserIdByAlias`; cuenta con `accounts.ensureForUser`; `partialName` y correo enmascarado), `limits(userId)` y `create(...)` según el flujo de research R7. Los asientos van con `description` («Transferencia a …» / «Transferencia de …») y la nota en data-model.md `LedgerTransaction.note`.
- [ ] T016 [US1] [BE] Crear `backend/src/modules/transfers/transfers.controller.ts` y `transfers.routes.ts` para `GET /transfers/recipient`, `GET /transfers/limits` y `POST /transfers` (`Idempotency-Key`). Agregar los limitadores `recipientLookup` (60 / 15 min) y `transfers` (30 / 15 min) en `backend/src/middleware/rate-limit/limiters.ts`, montar las rutas en `backend/src/modules/banking.module.ts` y `backend/src/app.ts`, y registrar `findRecipient`, `getTransferLimits` y `createTransfer` en `backend/src/openapi/registry.ts`.

### [FE]

- [ ] T017 [P] [US1] [FE] Crear `frontend/tests/SendPage.test.tsx`:
  - pasos destinatario → monto → confirmación;
  - errores de destinatario, saldo y tope;
  - contraseña pedida solo por encima del umbral;
  - `REAUTH_FAILED` y `REAUTH_LOCKED`;
  - el reintento reutiliza la misma `Idempotency-Key`.
- [ ] T018 [P] [US1] [FE] Crear `frontend/src/features/transfers/components/RecipientField.tsx` (correo o alias, con vista previa) y `TransferConfirmDialog.tsx` (nombre parcial, correo enmascarado, monto, nota y contraseña condicional; diálogo accesible).
- [ ] T019 [US1] [FE] Crear:
  - `frontend/src/features/transfers/api.ts`;
  - los hooks `useRecipient`, `useTransferLimits` y `useCreateTransfer` (clave por intento);
  - `frontend/src/features/transfers/pages/SendPage.tsx`;
  - la ruta `/enviar` y el acceso «Enviar» en `HomePage`.

  Al terminar, invalidar `['account']` y `['movements']`.
- [ ] T020 [US1] [FE] Actualizar `frontend/src/features/home/components/MovementItem.tsx` (spec 002) para mostrar la nota y el tipo `transfer`, con su prueba.

### [E2E]

- [ ] T021 [US1] [E2E] Crear `e2e/transfers.spec.ts`: dos contextos; A recarga y le envía a B por correo; los dos saldos y movimientos son correctos; con monto alto se pide la contraseña; un doble clic aplica una sola transferencia.

---

## Phase 3: User Story 2 — Elegir mi alias (Priority: P2)

### [BE]

- [ ] T022 [P] [US2] [BE] Crear `backend/tests/integration/profile.test.ts`:
  - asignar, cambiar y quitar el alias;
  - normalización;
  - `ALIAS_TAKEN`, incluso con dos solicitudes simultáneas;
  - formato inválido da 400;
  - el alias anterior queda libre;
  - auditoría `ALIAS_CHANGED` sin el alias en `metadata`.
- [ ] T023 [US2] [BE] Crear el módulo `backend/src/modules/profile/` (repository, service, controller, routes):
  - `GET /profile/me`, `PUT /profile/me/alias` y `DELETE /profile/me/alias`;
  - `findUserIdByAlias` para `transfers`;
  - la violación de unicidad sobre data-model.md `Profile.alias` → 409 `ALIAS_TAKEN`.

  Montarlo en `backend/src/app.ts` y registrar las 3 operaciones en `backend/src/openapi/registry.ts`.

### [FE]

- [ ] T024 [P] [US2] [FE] Crear `frontend/tests/ProfilePage.test.tsx`: validación mientras se escribe, `ALIAS_TAKEN` y quitar con confirmación.
- [ ] T025 [US2] [FE] Crear `frontend/src/features/profile/pages/ProfilePage.tsx` con su API y hooks, la ruta `/perfil` y el acceso desde el encabezado.

### [E2E]

- [ ] T026 [US2] [E2E] Crear `e2e/alias.spec.ts`: B asigna un alias y A le transfiere usando ese alias.

---

## Phase 4: Polish

- [ ] T027 [P] [BE] Agregar las variables `TRANSFER_*` a `docs/despliegue.md`.
- [ ] T028 [P] [FE] Revisar la accesibilidad y el diseño adaptable de `/enviar` y `/perfil` (SC-006). Registrar el resultado en `specs/003-transferencias/checklists/accessibility.md`.
- [ ] T029 [E2E] Ejecutar la validación de [quickstart.md](quickstart.md) con todo integrado, antes de `/speckit-converge`.

---

## Dependencies & Execution Order

| Tareas | Dependen de |
| :--- | :--- |
| `[SH]` T001–T006 | Nada; cierran la definición |
| `[BE]`/`[FE]` | Definición integrada |
| T015 (envío por alias) | T023 (módulo `profile`) para `findUserIdByAlias`. Si US1 va antes, implementar primero solo la búsqueda por correo y completar el alias con US2 |
| `[E2E]` | El workspace `e2e/` (T011 de la spec 001) |

## Implementation Strategy

Definición → base `[BE]` (T007–T013) → US1 (enviar por correo) → US2 (alias, que completa el envío
por alias) → pulido. Un PR del backend por historia.
