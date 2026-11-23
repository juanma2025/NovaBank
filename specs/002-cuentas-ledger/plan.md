# Implementation Plan: Cuenta en COP, libro contable y recarga simulada

**Branch**: `002-cuentas-ledger` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-cuentas-ledger/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Cada estudiante tiene una cuenta en COP cuyo saldo sale de un libro contable de doble entrada
inmutable. Puede recargarla con dinero de demostración y ve en la pantalla de inicio su saldo
(ocultable), sus últimos movimientos y la tarjeta «Muy pronto» de cripto. También puede recorrer su
historial completo.

**Enfoque técnico** (detalle en [research.md](research.md)):

| Tema | Decisión |
| :--- | :--- |
| Módulos | Tres: `accounts`, `ledger` y `topups`. `topups` orquesta a los otros dos sin tocar sus tablas (R1) |
| Libro contable | Las garantías viven en PostgreSQL: suma cero, asientos inmutables y máquina de estados (R2) |
| Saldo | Materializado solo en las cuentas de estudiantes. La cuenta del sistema no se bloquea, así que no es cuello de botella (R3) |
| Concurrencia | Bloqueo de fila en orden de `id` (R4) |
| Idempotencia | Clave guardada dentro de la transacción de negocio (R5) |
| Cuenta | Creación perezosa e idempotente (R6) |
| Límites | Configurables, con un endpoint que informa lo que le queda hoy al estudiante (R7) |
| Historial | Paginación por cursor (R8) |
| Pruebas de contrato | Generalizadas a todas las specs (R10) |

Se reutiliza todo lo de la spec 001: sesión, auditoría, formato de error, límites de tasa,
mantenimiento y helpers de prueba.

## Technical Context

**Language/Version**: TypeScript 6.0 estricto sobre Node.js 24 LTS; React 19 en el navegador (igual
que la spec 001).

**Primary Dependencies**: las mismas de la spec 001. **Ninguna dependencia nueva.**

**Storage**: PostgreSQL 17. Hay 4 tablas nuevas (`accounts`, `ledger_transactions`,
`ledger_entries` e `idempotency_keys`) y un valor nuevo en el enum de auditoría. Ver
[data-model.md](data-model.md).

**Testing**: Vitest + Supertest con la BD `nova_test`, Testing Library + jsdom y Playwright, igual
que en la spec 001. Se agregan pruebas de concurrencia (recargas simultáneas) y de invariantes del
libro.

**Target Platform**: igual que la spec 001.

**Project Type**: aplicación web (SPA + API REST) en el monorepo existente.

**Performance Goals**: saldo visible en menos de 2 s tras iniciar sesión (SC-001); recarga completa
en menos de 30 s (SC-002).

**Constraints**:
- Dinero en `BIGINT` y en pesos enteros; nunca punto flotante (Principio I).
- Saldo nunca negativo.
- Operaciones atómicas.
- `Idempotency-Key` obligatoria en los `POST` que mueven dinero.

**Scale/Scope**: demo académica. El diseño soporta muchas recargas simultáneas de distintos
estudiantes sin contención (R3). 4 endpoints, 3 pantallas, 4 tablas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / regla | Verificación | Estado |
| :--- | :--- | :--- |
| I. Dinero exacto | `BIGINT` en la BD, `number` entero seguro en el código, entero en la API, formato `es-CO` sin decimales (R9) | ✅ |
| I. Doble entrada inmutable | Suma cero con *constraint trigger*; asientos sin `UPDATE`/`DELETE`/`TRUNCATE`; correcciones solo por reversión (R2) | ✅ |
| I. Saldo derivado | `balance` actualizado en la misma transacción que los asientos; invariante probado (data-model) | ✅ |
| I. Saldo nunca negativo + bloqueo | `SELECT … FOR UPDATE` sobre la cuenta del estudiante; `CHECK (balance >= 0)` (R3, R4) | ✅ |
| I. Idempotencia y atomicidad | `Idempotency-Key` obligatoria; misma clave + mismo cuerpo = misma respuesta; cuerpo distinto = 409; todo en una transacción (R5) | ✅ |
| II. SDD y cero código sombra | Sin reversiones ni retiros (no los pide la spec). Las utilidades de dinero llegan ahora porque la spec las necesita | ✅ |
| III. Mínimo privilegio | Solo `/accounts/me`: un estudiante nunca recibe un id ajeno; sin rutas con ids de cuentas | ✅ |
| IV. Estética, «Muy pronto», accesibilidad | Tarjeta «Muy pronto» sin backend ni datos simulados; saldo ocultable; WCAG AA | ✅ |
| V. Simulación segura | La recarga simulada es la única entrada de dinero, contra la cuenta técnica del sistema; avisos de «dinero de demostración» | ✅ |
| VI. Monolito modular | `topups` usa servicios públicos de `accounts` y `ledger`; idempotencia en `lib/` (R1) | ✅ |
| VI. Configuración por entorno | `TOPUP_MIN_AMOUNT`, `TOPUP_MAX_AMOUNT` y `TOPUP_DAILY_LIMIT` validadas con Zod (R7) | ✅ |
| VI. Contratos primero | [contracts/accounts.openapi.json](contracts/accounts.openapi.json); pruebas de contrato generalizadas (R10) | ✅ |
| Reglas de dominio 1–7 | Cubiertas por R2–R7; cada una con al menos una prueba (ver tareas) | ✅ |
| SQL explícito (v2.3.0) | `FOR UPDATE` sobre `accounts`, `INSERT … ON CONFLICT` en idempotencia y en la creación de cuentas, triggers en la migración. Justificación abajo | ✅ |
| Errores y validación | Códigos nuevos con su HTTP canónico: 422 por reglas de negocio, 409 por idempotencia | ✅ |
| Seguridad | Límite de tasa en recargas (constitución); auditoría `TOPUP_COMPLETED` | ✅ |

**Usos de SQL explícito en esta spec**:

| Uso | Por qué Prisma no basta |
| :--- | :--- |
| `SELECT … FROM accounts WHERE id = $1 FOR UPDATE` | Prisma no expresa bloqueos de fila |
| `INSERT INTO idempotency_keys … ON CONFLICT DO NOTHING RETURNING` | Hace falta saber atómicamente si la clave es nueva y esperar a una solicitud concurrente con la misma clave |
| `INSERT INTO accounts … ON CONFLICT (user_id) DO NOTHING` | Creación perezosa segura ante solicitudes simultáneas |
| Triggers de suma cero, inmutabilidad y estados | Son objetos de la BD que Prisma no genera |

**Estado del gate**: ✅ aprobado, sin violaciones. **Re-check post-diseño**: sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/002-cuentas-ledger/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/accounts.openapi.json
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (cambios sobre el monorepo de la spec 001)

```text
shared/src/
├── money.ts                 # [SH] MoneyAmountSchema, SignedMoneySchema, formatCOP, parseCOPInput
├── accounts.schemas.ts      # [SH] Movement, AccountSummary, MovementsPage, TopupLimits,
│                            #      CreateTopupRequest, TopupResult
├── constants.ts             # [SH] + SUGGESTED_TOPUP_AMOUNTS, IDEMPOTENCY_HEADER, MOVEMENTS_PAGE_SIZE
├── errors.ts                # [SH] + TOPUP_AMOUNT_OUT_OF_RANGE, TOPUP_DAILY_LIMIT, IDEMPOTENCY_KEY_REUSED;
│                            #      details + minAmount, maxAmount, remainingToday
└── contract.test.ts         # [SH] lee todos los specs/*/contracts/*.json (R10)

db/prisma/
├── schema.prisma            # [BE] Account, LedgerTransaction, LedgerEntry, IdempotencyKey + enums
└── migrations/<ts>_accounts_ledger/  # [BE] + triggers, índices parciales, CHECKs, cuenta del sistema

backend/src/
├── config/env.ts            # [BE] + TOPUP_MIN_AMOUNT, TOPUP_MAX_AMOUNT, TOPUP_DAILY_LIMIT
├── lib/
│   ├── money.ts             # [BE] toSafeNumber(bigint)
│   ├── bogota-day.ts        # [BE] inicio del día en America/Bogota con Intl
│   └── idempotency/         # [BE] idempotency.repository.ts, idempotency.service.ts
├── modules/accounts/        # [BE] accounts.repository.ts, accounts.service.ts, accounts.routes.ts,
│                            #      accounts.controller.ts
├── modules/ledger/          # [BE] ledger.repository.ts, ledger.service.ts (post, listMovements, cursor)
├── modules/topups/          # [BE] topups.service.ts, topups.routes.ts, topups.controller.ts
├── openapi/registry.ts      # [BE] + 4 operaciones
└── app.ts                   # [BE] monta /accounts y /topups con require-auth
backend/tests/
├── integration/accounts.test.ts · topups.test.ts · ledger-invariants.test.ts
├── unit/money.test.ts · bogota-day.test.ts
└── contract/openapi.contract.test.ts  # [BE] unión de todos los contratos (R10)

frontend/src/                # [FE]
├── features/home/
│   ├── pages/HomePage.tsx               # reemplaza WelcomePage en /inicio
│   ├── components/BalanceCard.tsx       # saldo + ocultar (localStorage, R11)
│   ├── components/MovementList.tsx · MovementItem.tsx · EmptyMovements.tsx
│   └── components/ComingSoonCard.tsx    # cripto «Muy pronto»
├── features/topups/
│   ├── pages/TopupPage.tsx              # monto, sugeridos, resumen y confirmación
│   ├── components/AmountInput.tsx · SuggestedAmounts.tsx · TopupConfirmDialog.tsx
│   └── hooks/useTopupLimits.ts · useCreateTopup.ts   # Idempotency-Key por intento
├── features/movements/pages/MovementsPage.tsx         # historial con «Cargar más»
├── features/accounts/api.ts · hooks/useAccount.ts · useMovements.ts
└── lib/messages.ts          # + textos y códigos de error nuevos
frontend/tests/              # HomePage, TopupPage, MovementsPage, AmountInput

e2e/                         # [E2E] home.spec.ts · topups.spec.ts
```

**Structure Decision**: se mantienen los cuatro workspaces de la spec 001. Los módulos nuevos
siguen la estructura de `auth`.

## Diseño del backend

### Endpoints

Todos con `require-auth`. Detalle en [contracts/accounts.openapi.json](contracts/accounts.openapi.json).

| Método y ruta | Historia | Requisitos | Notas |
| :--- | :--- | :--- | :--- |
| `GET /accounts/me` | US1 | FR-001–FR-004, FR-015 | Crea la cuenta si no existe; saldo y 5 movimientos recientes |
| `GET /accounts/me/movements` | US3 | FR-020 | Cursor opaco, páginas de 20 |
| `GET /topups/limits` | US2 | FR-009, FR-010 | Mínimo, máximo, tope diario y lo que queda hoy |
| `POST /topups` | US2 | FR-005–FR-013, FR-021 | `Idempotency-Key`, límite de tasa y transacción única |

### Flujo de `POST /topups`

Todo dentro de **una** transacción de PostgreSQL:

1. Validar el cuerpo (`CreateTopupRequestSchema`) y la cabecera `Idempotency-Key` (8–100
   caracteres); si falta algo, 400.
2. `accounts.ensureForUser` y luego `accounts.lockForUpdate(cuenta del estudiante)`.
3. `idempotency.begin(userId, 'topups.create', key, hash(body))`:
   - si es una repetición con el mismo cuerpo → devolver la respuesta guardada;
   - si el cuerpo es distinto → 409.
4. Validar el rango (`TOPUP_AMOUNT_OUT_OF_RANGE`) y el tope diario: la suma de recargas
   `completed` de hoy en Bogotá más el monto no puede superar el tope (`TOPUP_DAILY_LIMIT`).
5. `ledger.post`: insertar la operación `pending`, los asientos (+monto al estudiante, −monto al
   sistema), actualizar `balance` y pasar la operación a `completed`.
6. Auditar `TOPUP_COMPLETED`.
7. `idempotency.complete(201, cuerpo)` y confirmar.

Si una regla de negocio falla, la transacción se revierte completa y no queda ni la clave ni un
asiento (FR-008).

### Nuevas variables de entorno

| Variable | Valor por defecto | Regla |
| :--- | :--- | :--- |
| `TOPUP_MIN_AMOUNT` | `1000` | Entero ≥ 1 |
| `TOPUP_MAX_AMOUNT` | `500000` | Entero ≥ `TOPUP_MIN_AMOUNT` |
| `TOPUP_DAILY_LIMIT` | `2000000` | Entero ≥ `TOPUP_MAX_AMOUNT` |

Límite de tasa nuevo: `topups`, 30 solicitudes cada 15 minutos por IP.

## Diseño del frontend

### Rutas

| Ruta | Pantalla | Notas |
| :--- | :--- | :--- |
| `/inicio` | `HomePage` | **Reemplaza** `WelcomePage` de la spec 001 (FR-015) |
| `/recargar` | `TopupPage` | Monto, montos sugeridos, resumen con confirmación y resultado |
| `/movimientos` | `MovementsPage` | Historial con «Cargar más» |

### Estados por vista

| Vista | Carga | Vacío | Error |
| :--- | :--- | :--- | :--- |
| `HomePage` | Esqueleto del saldo y de 3 movimientos | «Aún no tienes movimientos» + botón «Recargar» | `Alert` con «Reintentar»; si la sesión expiró, el comportamiento de la spec 001 |
| `TopupPage` | Límites cargando: botón deshabilitado. Confirmando: spinner en «Confirmar» | — | Rango o tope en el campo, con «puedes recargar hasta $X hoy»; red caída → reintentar **con la misma** `Idempotency-Key` |
| `MovementsPage` | Esqueleto; «Cargando más…» al final | Igual que en `HomePage` | `Alert` con «Reintentar» sin perder las páginas ya cargadas |

### Comportamientos clave

- **`AmountInput`**:
  - usa `parseCOPInput`;
  - formatea mientras se escribe («50.000»);
  - `inputMode="numeric"`;
  - valida contra `TopupLimits`.
- **Confirmación** (constitución): `TopupConfirmDialog` muestra el monto y el aviso de dinero de
  demostración. «Confirmar» genera la `Idempotency-Key` con `crypto.randomUUID()` una sola vez por
  intento, y la reutiliza en los reintentos de ese intento.
- **Tras recargar**: invalida `['account']` y `['movements']` en TanStack Query; el saldo nuevo
  aparece sin recargar la página.
- **Saldo oculto**:
  - la preferencia se guarda en `localStorage['nova:hide-balance']`, con `try/catch`;
  - se ocultan el saldo y los montos con «••••••»;
  - el botón tiene `aria-pressed` y una etiqueta accesible.
- **Movimientos**:
  - signo y color: verde «+», con signo explícito además del color (Principio IV);
  - fecha en `America/Bogota` con `Intl.DateTimeFormat('es-CO')`.
- **`ComingSoonCard`**: tarjeta de vidrio «Wallet cripto · Muy pronto». Al pulsarla, un diálogo
  informativo; sin llamadas a la API.

## Paquete `@nova/shared`: esquemas y utilidades nuevos

| Exportación | Uso |
| :--- | :--- |
| `MoneyAmountSchema`, `SignedMoneySchema` | Enteros seguros (positivo / con signo) |
| `formatCOP(amount)`, `parseCOPInput(text)` | Formato y lectura de montos colombianos (R9) |
| `MovementSchema`, `MovementTypeSchema`, `LedgerTransactionStatusSchema` | Movimiento (contrato `Movement`) |
| `AccountSummarySchema`, `MovementsPageSchema`, `MovementsQuerySchema` | Cuenta y paginación |
| `TopupLimitsSchema`, `CreateTopupRequestSchema`, `TopupResultSchema` | Recargas |
| `SUGGESTED_TOPUP_AMOUNTS`, `IDEMPOTENCY_HEADER`, `MOVEMENTS_PAGE_SIZE` (20), `RECENT_MOVEMENTS` (5) | Constantes |
| `ERROR_CODES` + 3 códigos; `ErrorDetailsSchema` + `minAmount`, `maxAmount`, `remainingToday` | Errores de la 002 |

## Guía para `/speckit-tasks`: etiquetas por capa

| Etiqueta | Alcance en esta spec |
| :--- | :--- |
| `[SH]` | `shared/` (dinero, esquemas, errores, prueba de contrato multi-spec) |
| `[BE]` | `db/`, `backend/` (módulos, idempotencia, migración, pruebas de integración, concurrencia e invariantes, prueba de contrato multi-spec) |
| `[FE]` | `frontend/` (inicio, recarga, historial; reemplazo de `WelcomePage`) |
| `[E2E]` | `e2e/` (inicio y recarga) |

Orden de las historias para los PR del backend: US1 → US2 → US3.

## Complexity Tracking

| Decisión | Por qué se necesita | Alternativa más simple descartada porque |
| :--- | :--- | :--- |
| Cuenta del sistema sin saldo materializado | Que las recargas de distintos estudiantes no queden en fila (R3) | Bloquear la cuenta del sistema serializa todas las recargas |
| Garantías del libro en triggers | SC-003 y la regla de dominio 2 como garantías de la BD, no solo del código | Validar solo en código no protege de errores futuros |
| Idempotencia dentro de la transacción | Evitar ventanas de doble aplicación (R5) | Guardar la clave en una transacción separada permite duplicados |
