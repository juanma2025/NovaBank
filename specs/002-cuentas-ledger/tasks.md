---
description: "Task list for 002-cuentas-ledger"
---

# Tasks: Cuenta en COP, libro contable y recarga simulada

**Input**: Design documents from `/specs/002-cuentas-ledger/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/accounts.openapi.json](contracts/accounts.openapi.json),
[quickstart.md](quickstart.md)

**Tests**: Incluidas. La constitución exige una prueba por regla de dominio, E2E de los flujos
críticos y, en esta spec, pruebas de concurrencia y de invariantes del libro contable.

**Organization**: Tareas agrupadas por historia de usuario; dentro de cada fase, por capa.

## Format: `[ID] [P?] [Story?] [Capa] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: US1–US3. No se usa en Foundational ni Polish.
- **[Capa]** (constitución v2.3.0), exactamente una por tarea:

  | Etiqueta | Alcance | Rama |
  | :--- | :--- | :--- |
  | `[SH]` | `/shared` y configuración raíz | `002-cuentas-ledger` |
  | `[BE]` | `/backend` y `/db` | `002-cuentas-ledger-be` |
  | `[FE]` | `/frontend` | `002-cuentas-ledger-fe` |
  | `[E2E]` | `/e2e` | `002-cuentas-ledger-fe` |

## Path Conventions

Monorepo de la spec 001 (`shared/`, `db/`, `backend/`, `frontend/`, `e2e/`). Ver «Project
Structure» en [plan.md](plan.md).

---

## Phase 1: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: ninguna historia puede empezar antes de terminar esta fase.

### [SH] Contrato en código — se integra con la rama de definición

- [X] T001 [P] [SH] Crear `shared/src/money.ts` con utilidades de dinero puras (research R9):
  - `MoneyAmountSchema`: entero, ≥ 1 y ≤ `Number.MAX_SAFE_INTEGER`;
  - `SignedMoneySchema`: entero seguro, distinto de 0;
  - `formatCOP(amount)`: `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`;
  - `parseCOPInput(text)`: acepta «50000», «50.000» y «$50.000» (con espacios); devuelve el entero o `null` si hay decimales, negativos, letras o desborda.

  Pruebas en `shared/src/money.test.ts`.
- [X] T002 [P] [SH] Agregar a `shared/src/constants.ts`: `SUGGESTED_TOPUP_AMOUNTS = [20_000, 50_000, 100_000]`, `IDEMPOTENCY_HEADER = 'Idempotency-Key'`, `MOVEMENTS_PAGE_SIZE = 20` y `RECENT_MOVEMENTS = 5`.
- [X] T003 [SH] En `shared/src/errors.ts`:
  - agregar a `ERROR_CODES` los códigos `TOPUP_AMOUNT_OUT_OF_RANGE`, `TOPUP_DAILY_LIMIT` e `IDEMPOTENCY_KEY_REUSED`;
  - agregar a `ErrorDetailsSchema` `minAmount`, `maxAmount` y `remainingToday` (opcionales), según `ErrorResponse` de [contracts/accounts.openapi.json](contracts/accounts.openapi.json).

  **Ajuste al implementar**: como `ERROR_MESSAGES` y `ERROR_STATUS` del backend están tipados con todos los códigos, se agregaron sus 3 entradas (`backend/src/lib/error-messages.ts`, `backend/src/lib/errors.ts`) en la rama de definición para que el CI siga en verde. Lo mismo hará falta en `frontend/src/lib/messages.ts` si el frontend llega a `main` antes que esta definición.
- [X] T004 [SH] Crear `shared/src/accounts.schemas.ts`, cada esquema igual a su `components.schemas` del contrato de la 002:
  - `MovementTypeSchema`, `LedgerTransactionStatusSchema`, `MovementSchema`;
  - `AccountSummarySchema`, `MovementsPageSchema`;
  - `MovementsQuerySchema`: `cursor` opcional de hasta 200 caracteres y `limit` de 1 a 20, por defecto 20, con coerción desde query string;
  - `TopupLimitsSchema`, `CreateTopupRequestSchema` (estricto) y `TopupResultSchema`.

  Exportar los tipos con `z.infer` y reexportar todo en `shared/src/index.ts`, junto con `money.ts`.
- [X] T005 [P] [SH] Pruebas en `shared/src/accounts.schemas.test.ts`: los ejemplos del contrato son válidos, `CreateTopupRequest` rechaza campos extra y decimales, y `MovementsQuery` aplica el valor por defecto y los límites.
- [X] T006 [SH] Generalizar `shared/src/contract.test.ts` a todas las specs (research R10):
  - lee todos los `specs/*/contracts/*.json`;
  - comprueba que `ERROR_CODES` es exactamente la unión de sus `ErrorCode`;
  - comprueba que los enums de `details` son los del contrato que los define.
- [X] T007 [P] [SH] Agregar a `.env.example` `TOPUP_MIN_AMOUNT=1000`, `TOPUP_MAX_AMOUNT=500000` y `TOPUP_DAILY_LIMIT=2000000`, con un comentario cada una (plan, «Nuevas variables de entorno»).

**Checkpoint de definición**: PR de `002-cuentas-ledger` → `main`. Al integrarlo, el contrato de la
002 queda congelado.

### [BE] Base de datos y servicios base

- [X] T008 [BE] Agregar a `db/prisma/schema.prisma` los enums `account_kind`, `account_status`, `ledger_transaction_type`, `ledger_transaction_status` y el valor `TOPUP_COMPLETED` en `audit_event_type`, y los modelos con nombres `snake_case`, índices y relaciones de data-model.md:
  - `Account.kind`, `Account.user_id`, `Account.currency`, `Account.balance`, `Account.status`, `Account.created_at`;
  - `LedgerTransaction.type`, `LedgerTransaction.status`, `LedgerTransaction.account_id`, `LedgerTransaction.amount`, `LedgerTransaction.description`, `LedgerTransaction.reversal_of`, `LedgerTransaction.request_id`, `LedgerTransaction.created_at`, `LedgerTransaction.completed_at`;
  - `LedgerEntry.transaction_id`, `LedgerEntry.account_id`, `LedgerEntry.amount`, `LedgerEntry.created_at`;
  - `IdempotencyKey.user_id`, `IdempotencyKey.scope`, `IdempotencyKey.key`, `IdempotencyKey.request_hash`, `IdempotencyKey.response_status`, `IdempotencyKey.response_body`, `IdempotencyKey.created_at`, `IdempotencyKey.expires_at`.
- [X] T009 [BE] Generar la migración `db/prisma/migrations/<timestamp>_accounts_ledger/migration.sql` y agregarle a mano (research R2, R3):
  - los `CHECK` de data-model.md:
    - `Account.currency` = 'COP';
    - `Account.balance` ≥ 0 si `kind = student`;
    - `Account.user_id` obligatorio si `kind = student`;
    - `LedgerTransaction.amount` > 0;
    - `LedgerEntry.amount` ≠ 0;
  - el índice único parcial `(kind) WHERE kind = 'system_topups'` y la fila de la cuenta del sistema;
  - el *constraint trigger* `DEFERRABLE INITIALLY DEFERRED`: suma cero y al menos 2 asientos por `LedgerEntry.transaction_id`;
  - triggers que rechazan `UPDATE`/`DELETE`/`TRUNCATE` sobre `ledger_entries`;
  - el trigger de `ledger_transactions`: solo cambian `LedgerTransaction.status` y `LedgerTransaction.completed_at`, y solo desde `pending` hacia `completed`, `failed` o `reversed`.

  Aplicarla a `nova`, `nova_test` y `nova_e2e`.
- [X] T010 [P] [BE] Agregar a `backend/src/config/env.ts` `TOPUP_MIN_AMOUNT`, `TOPUP_MAX_AMOUNT` y `TOPUP_DAILY_LIMIT`, con sus valores por defecto y la regla `min ≤ max ≤ tope` (research R7). Sumar al `test.env` de `backend/vitest.config.ts` valores de prueba bajos (ej. 1000 / 50000 / 100000) para ejercitar el tope diario.
- [X] T011 [P] [BE] Crear `backend/src/lib/money.ts`: `toSafeNumber(bigint)`, que lanza un error si `!Number.isSafeInteger` (Principio I). Prueba en `backend/tests/unit/money.test.ts`.
- [X] T012 [P] [BE] Crear `backend/src/lib/bogota-day.ts`: `startOfBogotaDay(now)`, el inicio del día calendario en `America/Bogota` con `Intl.DateTimeFormat`, sin librerías. Prueba en `backend/tests/unit/bogota-day.test.ts`, con casos a las 23:59 y 00:00 de Bogotá y en UTC.

  **Ajuste al implementar**: sus pruebas quedaron en `backend/tests/unit/money.test.ts`, junto con las de `toSafeNumber`.
- [X] T013 [BE] Crear `backend/src/lib/idempotency/idempotency.repository.ts` e `idempotency.service.ts` (research R5):
  - `begin(tx, { userId, scope, key, body })`:
    - `INSERT … ON CONFLICT DO NOTHING RETURNING` sobre data-model.md `IdempotencyKey.user_id`, `IdempotencyKey.scope` e `IdempotencyKey.key`, con `IdempotencyKey.request_hash` = SHA-256 del cuerpo canónico (claves ordenadas) e `IdempotencyKey.expires_at` = +24 h;
    - devuelve `{ kind: 'new' }`, `{ kind: 'replay', status, body }` o lanza `IDEMPOTENCY_KEY_REUSED`;
  - `complete(tx, id, status, body)` guarda `IdempotencyKey.response_status` e `IdempotencyKey.response_body`;
  - `registerCleanup(maintenance)` borra las claves vencidas (`IdempotencyKey.created_at`, `IdempotencyKey.expires_at`).
- [X] T014 [BE] Crear el módulo `backend/src/modules/accounts/` con `accounts.repository.ts` y `accounts.service.ts` (research R1, R3, R4, R6):
  - `ensureForUser(db, userId)`: `INSERT … ON CONFLICT (user_id) DO NOTHING` y lectura;
  - `lockForUpdate(tx, accountId)`: `SELECT … FOR UPDATE`;
  - `applyBalanceDelta(tx, accountId, delta)`: solo para `kind = student`, respetando el `CHECK` de data-model.md `Account.balance`;
  - `getSystemTopupsAccount(db)`.

  Conversión con `toSafeNumber`.
- [X] T015 [BE] Crear el módulo `backend/src/modules/ledger/` con `ledger.repository.ts` y `ledger.service.ts` (research R2, R8):
  - `post(tx, { type, accountId, amount, description, lines, requestId })`:
    - inserta la operación `pending` (data-model.md `LedgerTransaction.status`) y sus asientos;
    - llama a `accounts.applyBalanceDelta` para las cuentas de estudiantes (nunca toca la tabla `accounts`);
    - pasa la operación a `completed` con `LedgerTransaction.completed_at`;
  - `listMovements(db, accountId, { cursor, limit })`: orden `(created_at DESC, id DESC)` y cursor opaco base64url;
  - `recentMovements(db, accountId, 5)`;
  - `sumTopupsSince(db, accountId, since)`.

  **Ajuste al implementar**: la composición de `accounts`, `ledger`, `topups` e idempotencia vive en `backend/src/modules/banking.module.ts`, que `app.ts` usa para montar los routers.
- [X] T016 [BE] Crear `backend/tests/helpers/users.ts` con `createUserWithSession(t)`, que crea un usuario y devuelve un `TestAgent` con sesión, para las pruebas de la 002.
- [X] T017 [BE] Crear `backend/tests/integration/ledger-invariants.test.ts` (reglas de dominio 2 y 3, SC-003). Debe comprobar:
  - insertar asientos que no suman cero falla al confirmar la transacción;
  - una operación con un solo asiento falla;
  - `UPDATE`, `DELETE` y `TRUNCATE` sobre `ledger_entries` fallan;
  - `completed → pending` falla en `ledger_transactions`;
  - un saldo de estudiante negativo falla por el `CHECK`;
  - tras varias recargas, la suma de todos los asientos es 0 y cada `balance` coincide con la suma de sus asientos.
- [X] T018 [BE] Generalizar `backend/tests/contract/openapi.contract.test.ts` (research R10):
  - lee todos los `specs/*/contracts/*.json`;
  - compara cada operación generada con la del contrato que la define;
  - exige la unión exacta de operaciones (salvo `GET /openapi.json`).

### [FE] Base del frontend

- [ ] T019 [P] [FE] Crear `frontend/src/features/accounts/api.ts` (una función por operación del contrato de la 002; `createTopup` envía la cabecera `IDEMPOTENCY_HEADER`) y los hooks `frontend/src/features/accounts/hooks/useAccount.ts` (`['account']`) y `useMovements.ts` (`useInfiniteQuery` con `['movements']`).
- [ ] T020 [P] [FE] Agregar a `frontend/src/lib/messages.ts` los textos de inicio, recarga e historial, los avisos de «dinero de demostración» y los mensajes de `TOPUP_AMOUNT_OUT_OF_RANGE`, `TOPUP_DAILY_LIMIT` e `IDEMPOTENCY_KEY_REUSED`.
- [ ] T021 [P] [FE] Crear en `frontend/src/features/home/components/`:
  - `MovementItem.tsx`: descripción, fecha en `America/Bogota`, monto con `formatCOP`, signo y color (verde «+»), estado si no es `completed`, y «••••••» si el saldo está oculto;
  - `MovementList.tsx`;
  - `EmptyMovements.tsx`: con el botón «Recargar».

**Checkpoint**: la base está lista.

---

## Phase 2: User Story 1 — Ver mi cuenta y mi saldo al entrar (Priority: P1) 🎯 MVP

**Goal**: `/inicio` muestra el saldo (ocultable), los 5 movimientos más recientes y la tarjeta
«Muy pronto»; la cuenta se crea sola.

**Independent Test**: con una cuenta nueva, `/inicio` muestra «$0», el estado vacío y la tarjeta
«Muy pronto»; al ocultar el saldo y recargar la página, sigue oculto.

### [BE]

- [X] T022 [P] [US1] [BE] Crear `backend/tests/integration/accounts.test.ts`. Debe comprobar:
  - `GET /api/v1/accounts/me` crea la cuenta con saldo 0 y `recentMovements` vacío (FR-001);
  - dos solicitudes simultáneas crean una sola cuenta;
  - un usuario existente sin cuenta la obtiene al primer acceso;
  - los movimientos recientes vienen ordenados y son máximo 5;
  - un estudiante nunca recibe datos de otro (FR-004);
  - sin sesión: 401.
- [X] T023 [US1] [BE] Crear `backend/src/modules/accounts/accounts.controller.ts` y `accounts.routes.ts` con `GET /api/v1/accounts/me` (`ensureForUser` más `ledger.recentMovements`; respuesta `AccountSummarySchema`), montarlo en `backend/src/app.ts` con `require-auth` y registrar la operación `getMyAccount` en `backend/src/openapi/registry.ts`.

### [FE]

- [ ] T024 [P] [US1] [FE] Crear `frontend/tests/HomePage.test.tsx`. Debe comprobar:
  - el estado de carga;
  - el estado vacío con «Recargar»;
  - la lista con signo y color;
  - ocultar y mostrar el saldo, que persiste en `localStorage` y sigue funcionando si `localStorage` falla;
  - la tarjeta «Muy pronto» abre un mensaje sin llamar a la API;
  - el error con «Reintentar».
- [ ] T025 [P] [US1] [FE] Crear `frontend/src/features/home/components/BalanceCard.tsx` (saldo con `formatCOP`; botón con `aria-pressed` que guarda `localStorage['nova:hide-balance']` dentro de `try/catch`, research R11) y `frontend/src/features/home/components/ComingSoonCard.tsx` (tarjeta de vidrio «Wallet cripto · Muy pronto» con un diálogo informativo).
- [ ] T026 [US1] [FE] Crear `frontend/src/features/home/pages/HomePage.tsx`:
  - saludo con el primer nombre, `BalanceCard`, `MovementList` (5), «Ver todos», «Recargar» y `ComingSoonCard`;
  - en `frontend/src/app/router.tsx`, `/inicio` usa `HomePage` y **se elimina** `WelcomePage` de la spec 001 (FR-015);
  - actualizar las pruebas de la spec 001 que esperaban `WelcomePage` o el texto «Hola, …» al terminar el registro o el login (`frontend/tests/RegisterPage.test.tsx`, `LoginPage.test.tsx`) y los E2E de la 001 que la verifiquen.

### [E2E]

- [ ] T027 [US1] [E2E] Crear `e2e/home.spec.ts`: un usuario nuevo ve «$0», el estado vacío y la tarjeta «Muy pronto»; ocultar el saldo persiste al recargar la página. También en el proyecto de 360 px.

**Checkpoint**: US1 funciona y se puede demostrar por sí sola.

---

## Phase 3: User Story 2 — Recargar mi cuenta con dinero de demostración (Priority: P2)

**Goal**: recargar con un resumen y confirmación, respetando los límites, con idempotencia y de
forma atómica.

**Independent Test**: recargar $50.000 en una cuenta en $0 → saldo $50.000 y movimiento «Recarga
simulada +$50.000»; un doble envío no duplica.

### [BE]

- [X] T028 [P] [US2] [BE] Crear `backend/tests/integration/topups.test.ts`. Debe comprobar:
  - una recarga válida actualiza el saldo y crea el movimiento `completed` (FR-005, FR-008);
  - fuera de rango: 422 `TOPUP_AMOUNT_OUT_OF_RANGE` con `minAmount`/`maxAmount`;
  - tope diario: 422 `TOPUP_DAILY_LIMIT` con `remainingToday`, que se reinicia en el día siguiente de Bogotá (reloj falso);
  - sin `Idempotency-Key`: 400;
  - la misma clave y el mismo cuerpo devuelven la respuesta original sin otra recarga;
  - la misma clave con otro cuerpo: 409 `IDEMPOTENCY_KEY_REUSED`;
  - **concurrencia**:
    - 10 recargas simultáneas del mismo estudiante con claves distintas → saldo = suma exacta y el tope diario se respeta;
    - 2 solicitudes simultáneas con la misma clave → una sola recarga;
    - recargas simultáneas de estudiantes distintos no se bloquean entre sí;
  - si falla a mitad (error forzado después de los asientos), no queda nada (FR-008);
  - se audita `TOPUP_COMPLETED` (FR-021);
  - `GET /topups/limits` devuelve los límites y lo que queda hoy.
- [X] T029 [US2] [BE] Crear `backend/src/modules/topups/topups.service.ts` con el flujo de plan.md («Flujo de `POST /topups`»), todo en una transacción:
  - `ensureForUser` → `lockForUpdate` → `idempotency.begin`;
  - rango y tope con `startOfBogotaDay` y `ledger.sumTopupsSince`;
  - `ledger.post` con los asientos +monto al estudiante y −monto a la cuenta del sistema (data-model.md `LedgerEntry.amount`) y la descripción «Recarga simulada» (data-model.md `LedgerTransaction.description`);
  - auditoría `TOPUP_COMPLETED`;
  - `idempotency.complete`.

  Agregar también `limits(userId)`.
- [X] T030 [US2] [BE] Crear `backend/src/modules/topups/topups.controller.ts` y `topups.routes.ts`:
  - `GET /api/v1/topups/limits`;
  - `POST /api/v1/topups`, que valida `Idempotency-Key` (8–100) y el cuerpo con Zod y responde 201 (o la respuesta guardada).

  Agregar el limitador `topups` (30 / 15 min por IP) en `backend/src/middleware/rate-limit/limiters.ts`, montar las rutas con `require-auth` en `backend/src/app.ts`, registrar `getTopupLimits` y `createTopup` en `backend/src/openapi/registry.ts` y la limpieza de idempotencia en `backend/src/server.ts`.

### [FE]

- [ ] T031 [P] [US2] [FE] Crear `frontend/tests/TopupPage.test.tsx` y `frontend/tests/AmountInput.test.tsx`. Deben comprobar:
  - formato mientras se escribe;
  - el rango con los límites del servidor;
  - los montos sugeridos;
  - el resumen con confirmación;
  - el éxito invalida `['account']` y `['movements']`;
  - un reintento tras un error de red **reutiliza la misma** `Idempotency-Key`;
  - un intento nuevo usa otra clave;
  - los errores de tope y de rango.
- [ ] T032 [P] [US2] [FE] Crear en `frontend/src/features/topups/components/`:
  - `AmountInput.tsx`: `parseCOPInput`, `inputMode="numeric"` y error accesible;
  - `SuggestedAmounts.tsx`: `SUGGESTED_TOPUP_AMOUNTS`;
  - `TopupConfirmDialog.tsx`: monto y aviso de dinero de demostración; diálogo accesible con foco atrapado.
- [ ] T033 [US2] [FE] Crear:
  - `frontend/src/features/topups/hooks/useTopupLimits.ts`;
  - `frontend/src/features/topups/hooks/useCreateTopup.ts`: genera la clave con `crypto.randomUUID()` al confirmar y la reutiliza en los reintentos del mismo intento;
  - `frontend/src/features/topups/pages/TopupPage.tsx`: estados de plan.md («Estados por vista»).

  Agregar la ruta `/recargar` en `frontend/src/app/router.tsx`.

### [E2E]

- [ ] T034 [US2] [E2E] Crear `e2e/topups.spec.ts`: recargar $50.000 → saldo y movimiento; un monto fuera de rango muestra el aviso; un doble clic en «Confirmar» aplica una sola recarga.

**Checkpoint**: US1 y US2 funcionan por su cuenta.

---

## Phase 4: User Story 3 — Revisar todo mi historial de movimientos (Priority: P3)

**Goal**: historial completo en páginas de 20, estable aunque entren movimientos nuevos.

**Independent Test**: con más de 20 movimientos, «Ver todos» muestra 20 y «Cargar más» trae los
siguientes sin repetir.

### [BE]

- [X] T035 [P] [US3] [BE] Crear `backend/tests/integration/movements.test.ts`. Debe comprobar:
  - la primera página de 20 en orden;
  - `nextCursor` trae la siguiente sin repetir ni saltar;
  - una recarga nueva entre páginas no desplaza el resultado (FR-020);
  - la última página trae `nextCursor` null;
  - un cursor inválido: 400;
  - aislamiento entre estudiantes.
- [X] T036 [US3] [BE] Agregar `GET /api/v1/accounts/me/movements` (`MovementsQuerySchema` → `ledger.listMovements`; respuesta `MovementsPageSchema`) en `backend/src/modules/accounts/accounts.controller.ts` y `accounts.routes.ts`, y registrar `listMyMovements` en `backend/src/openapi/registry.ts`.

### [FE]

- [ ] T037 [P] [US3] [FE] Crear `frontend/tests/MovementsPage.test.tsx`: primera página, «Cargar más», estado vacío y error sin perder las páginas cargadas.
- [ ] T038 [US3] [FE] Crear `frontend/src/features/movements/pages/MovementsPage.tsx` con `useMovements` y «Cargar más»; agregar la ruta `/movimientos` en `frontend/src/app/router.tsx` y conectar «Ver todos» de `HomePage`.

### [E2E]

- [ ] T039 [US3] [E2E] Crear `e2e/movements.spec.ts`: con más de 20 recargas (sembradas por la API), «Ver todos» y «Cargar más» sin repetidos.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T040 [P] [BE] Agregar `TOPUP_MIN_AMOUNT`, `TOPUP_MAX_AMOUNT` y `TOPUP_DAILY_LIMIT` a la tabla de variables de `docs/despliegue.md`.
- [ ] T041 [P] [FE] Revisar la accesibilidad y el diseño adaptable de inicio, recarga e historial (SC-006): teclado, lector de pantalla, 360 px, contraste en los dos temas y `prefers-reduced-motion`. Medir además que el saldo aparece en menos de 2 s después de iniciar sesión (SC-001). Registrar el resultado en `specs/002-cuentas-ledger/checklists/accessibility.md`.
- [ ] T042 [E2E] Ejecutar la validación de [quickstart.md](quickstart.md) (secciones 2–4, incluidas las consultas del libro contable) con todo integrado en `main`, antes de `/speckit-converge`.

---

## Dependencies & Execution Order

| Fase | Depende de |
| :--- | :--- |
| `[SH]` T001–T007 | Nada; cierran la rama de definición |
| `[BE]`/`[FE]` de Phase 1 | Definición integrada en `main` |
| Phase 2–4 | Phase 1 de su misma capa |
| `[E2E]` | El workspace `e2e/` de la spec 001 (T011 de la 001) y las tareas `[BE]`/`[FE]` de su historia |

Orden de las historias: US1 → US2 → US3. US2 y US3 dependen de `ledger` (T015), no de US1.

### Parallel Opportunities

- **Definición**: T001, T002, T005 y T007 en paralelo; T003 → T004 → T006.
- **`[BE]`**: T010–T012 en paralelo; T013, T014 → T015.
- **`[FE]`**: T019–T021 en paralelo.
- **Las capas entre sí**: tras la definición, `[BE]` y `[FE]` avanzan a la vez.

## Parallel Example: User Story 2

```text
T028 [US2] [BE] backend/tests/integration/topups.test.ts
T031 [US2] [FE] frontend/tests/TopupPage.test.tsx, AmountInput.test.tsx
T032 [US2] [FE] AmountInput.tsx, SuggestedAmounts.tsx, TopupConfirmDialog.tsx
```

## Implementation Strategy

1. **MVP**: definición (T001–T007) → base `[BE]` (T008–T018) y `[FE]` (T019–T021) → US1 (T022–T027).
2. **Incremental**: un PR del backend por historia (US1 → US2 → US3). El frontend conecta cada una
   al llegar a `main`.
3. **Cierre**: pulido (T040–T042) y `/speckit-converge`.

## Notes

- Cada tarea cita data-model.md (`Entidad.campo`) como fuente de sus restricciones.
- Marcar `[X]` solo las tareas propias.
- Commits: `feat(002): …`, `test(002): …`.
