# Implementation Plan: Transferencias entre estudiantes

**Branch**: `003-transferencias` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-transferencias/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Un estudiante envía dinero a otro identificándolo por correo institucional o por alias. Ve una vista
previa con su nombre parcial y su correo enmascarado, confirma, y escribe su contraseña si el monto
supera $200.000. La transferencia se registra en el libro contable de la spec 002 con un asiento por
cuenta, cada uno con su propia descripción. Cada estudiante puede elegir un alias opcional y único.

**Enfoque técnico** (detalle en [research.md](research.md)):

| Tema | Decisión |
| :--- | :--- |
| Módulos | `profile` (alias) y `transfers` nuevos; `auth` expone un directorio de usuarios y la reautenticación (R1) |
| Destinatario | Queda fijado por el id de su cuenta desde la vista previa (R3) |
| Reautenticación | Fuera de la transacción, para que el bloqueo por intentos funcione (R4) |
| Libro contable | Asientos con descripción propia (R5); dos cuentas bloqueadas en orden de `id` (R6) |
| Contrato congelado | Cambio aprobado en el contrato de la 002: `Movement` suma `transfer` y `note` (R8) |

## Technical Context

**Language/Version**: igual que las specs 001 y 002 (TypeScript 6.0, Node.js 24, React 19).

**Primary Dependencies**: **ninguna nueva.**

**Storage**: PostgreSQL 17. Una tabla nueva (`profiles`), columnas nuevas en `ledger_transactions`
(`counterparty_account_id`, `note`) y `ledger_entries` (`description`), y valores nuevos en enums.
Ver [data-model.md](data-model.md).

**Testing**: igual que la 002, más pruebas de transferencias cruzadas simultáneas (*deadlocks*) y
de la reautenticación con bloqueo.

**Performance Goals**: transferencia completa en menos de 45 s (SC-001).

**Constraints**: los de la 002 (dinero exacto, atomicidad, idempotencia, saldo nunca negativo) y,
además, la reautenticación por encima del umbral.

**Scale/Scope**: 6 operaciones nuevas, 3 pantallas (enviar, perfil y alias, y el resultado dentro de
enviar), 1 tabla.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / regla | Verificación | Estado |
| :--- | :--- | :--- |
| I. Dinero exacto, doble entrada, atomicidad | 2 asientos (−/+) en una transacción; las garantías de la 002 (suma cero, inmutabilidad, estados) aplican igual (R5, R7) | ✅ |
| I. Saldo nunca negativo + bloqueo | `lockManyForUpdate` en orden de `id`; `INSUFFICIENT_FUNDS` antes de registrar; el `CHECK` de la 002 como respaldo (R6) | ✅ |
| I. Idempotencia | `Idempotency-Key` obligatoria; el hash excluye la contraseña (R4, R7) | ✅ |
| II. SDD | Sin cobros, transferencias programadas ni notificaciones (fuera de la spec) | ✅ |
| III. Reautenticación por umbral | Contraseña por encima de $200.000, con bloqueo de 5 intentos en 15 min (R4) | ✅ |
| III. Mínimo privilegio y privacidad | Nombre parcial y correo enmascarado en la vista previa; límite de tasa en las búsquedas (R3) | ✅ |
| VI. Monolito modular | `transfers` orquesta `auth`, `profile`, `accounts`, `ledger` e idempotencia sin tocar sus tablas (R1) | ✅ |
| VI. Contratos primero | [contracts/transfers.openapi.json](contracts/transfers.openapi.json). El contrato de la 002 cambia, y lo aprueban ambos en este PR (R8) | ✅ |
| Reglas de dominio 1–7 | Cubiertas por R4–R7 y sus pruebas | ✅ |
| SQL explícito | `FOR UPDATE` sobre dos cuentas (orden de `id`); `CHECK` y trigger actualizados en la migración | ✅ |

**Estado del gate**: ✅ aprobado, sin violaciones ni enmiendas.

## Project Structure

```text
specs/003-transferencias/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md · tasks.md
├── contracts/transfers.openapi.json
└── checklists/requirements.md
specs/002-cuentas-ledger/contracts/accounts.openapi.json   # Movement: + transfer, + note (R8)

shared/src/
├── accounts.schemas.ts      # [SH] MovementType + 'transfer'; MovementSchema + note
├── transfers.schemas.ts     # [SH] AliasSchema (normaliza), Profile, SetAliasRequest, RecipientPreview,
│                            #      RecipientQuery, TransferLimits, CreateTransferRequest, TransferResult
├── names.ts                 # [SH] partialName("Ana Pérez Gómez") → "Ana P. G."
└── errors.ts                # [SH] + 10 códigos; details + availableBalance, reauthThreshold

db/prisma/                   # [BE] Profile; columnas nuevas; enums; migración (CHECK + trigger actualizado)

backend/src/
├── modules/auth/auth.directory.ts   # [BE] findByEmail, findById → { userId, fullName, email }
├── modules/auth/reauth.service.ts   # [BE] verify(userId, password) con bloqueo (login_attempts)
├── modules/profile/                 # [BE] repository, service, controller, routes
├── modules/accounts/accounts.service.ts  # [BE] + lockManyForUpdate (orden de id), + isStudentAccount
├── modules/ledger/                  # [BE] post con counterparty, note y descripción por asiento; toMovement + note
└── modules/transfers/               # [BE] service, controller, routes

frontend/src/                        # [FE]
├── features/transfers/pages/SendPage.tsx    # destinatario → monto y nota → confirmación (+ contraseña) → resultado
├── features/transfers/components/RecipientField.tsx · TransferConfirmDialog.tsx
├── features/profile/pages/ProfilePage.tsx    # alias: asignar, cambiar, quitar
└── features/home/components/MovementItem.tsx # + nota, + tipo transfer (spec 002)

e2e/transfers.spec.ts · e2e/alias.spec.ts    # [E2E]
```

## Diseño del backend

### Endpoints

Todos con `require-auth`. Detalle en [contracts/transfers.openapi.json](contracts/transfers.openapi.json).

| Método y ruta | Historia | Requisitos |
| :--- | :--- | :--- |
| `GET /profile/me` | US2 | FR-015–FR-017 |
| `PUT /profile/me/alias` | US2 | FR-015–FR-018 |
| `DELETE /profile/me/alias` | US2 | FR-017, FR-018 |
| `GET /transfers/recipient?q=` | US1 | FR-001–FR-004 |
| `GET /transfers/limits` | US1 | FR-006, FR-008 |
| `POST /transfers` | US1 | FR-005–FR-014, FR-018 |

**Flujo de `POST /transfers`**: ver research R7.

### Variables de entorno nuevas

| Variable | Valor por defecto | Regla |
| :--- | :--- | :--- |
| `TRANSFER_MIN_AMOUNT` | `1000` | `min ≤ umbral ≤ max ≤ tope` |
| `TRANSFER_MAX_AMOUNT` | `500000` | |
| `TRANSFER_DAILY_LIMIT` | `1000000` | |
| `TRANSFER_REAUTH_THRESHOLD` | `200000` | |

**Límites de tasa nuevos**: `recipientLookup` (60 cada 15 min por IP) y `transfers` (30 cada 15 min).

## Diseño del frontend

| Ruta | Pantalla | Estados |
| :--- | :--- | :--- |
| `/enviar` | `SendPage`: paso 1 destinatario (correo o alias) → paso 2 monto y nota, con límites y saldo disponible → `TransferConfirmDialog` (nombre parcial, correo enmascarado, monto, nota; campo de contraseña si supera `reauthThreshold`) → resultado | Carga en cada paso; `RECIPIENT_NOT_FOUND` y `TRANSFER_TO_SELF` en el campo; `INSUFFICIENT_FUNDS` con el disponible; `REAUTH_FAILED` y `REAUTH_LOCKED` en el diálogo; reintento con la **misma** `Idempotency-Key` |
| `/perfil` | `ProfilePage`: nombre, correo y alias (asignar, cambiar, quitar con confirmación) | `ALIAS_TAKEN` en el campo; validación del formato mientras se escribe con `AliasSchema` |
| `/inicio`, `/movimientos` (002) | `MovementItem` muestra la nota y el tipo `transfer` (con signo «−» en los envíos) | — |

`HomePage` (002) agrega el acceso «Enviar», y el encabezado agrega el acceso a «Perfil».

## Paquete `@nova/shared`

| Exportación | Uso |
| :--- | :--- |
| `partialName(fullName)` | «Ana Pérez Gómez» → «Ana P. G.» (FR-002) |
| `AliasSchema` | Recorta espacios, quita la `@` inicial, pasa a minúsculas y valida el formato (FR-015) |
| `ProfileSchema`, `SetAliasRequestSchema` | Perfil y alias |
| `RecipientQuerySchema`, `RecipientPreviewSchema` | Vista previa del destinatario |
| `TransferLimitsSchema`, `CreateTransferRequestSchema`, `TransferResultSchema` | Transferencias |
| `MovementTypeSchema` + `transfer`; `MovementSchema` + `note` | Cambio en la 002 (R8) |
| `ERROR_CODES` + `ALIAS_TAKEN`, `RECIPIENT_NOT_FOUND`, `TRANSFER_TO_SELF`, `TRANSFER_AMOUNT_OUT_OF_RANGE`, `TRANSFER_DAILY_LIMIT`, `INSUFFICIENT_FUNDS`, `REAUTH_REQUIRED`, `REAUTH_FAILED`, `REAUTH_LOCKED`; `details` + `availableBalance`, `reauthThreshold` | Errores |

## Guía para `/speckit-tasks`

Las etiquetas `[SH]`, `[BE]`, `[FE]` y `[E2E]` tienen el mismo alcance que en la 002. Orden de las
historias: US1 (enviar) → US2 (alias).

## Complexity Tracking

| Decisión | Por qué se necesita | Alternativa más simple descartada porque |
| :--- | :--- | :--- |
| Reautenticación fuera de la transacción | Que el bloqueo por intentos se acumule (R4) | Dentro de la transacción, el fallo se revierte junto con ella |
| Descripción por asiento | Cada participante ve su contraparte sin que `ledger` lea `users` (R5) | Calcular el nombre al leer acopla `ledger` con `auth` |
| Destinatario por id de cuenta | Cumplir FR-005 aunque el alias cambie de dueño (R3) | Enviar el alias en la confirmación puede mandar el dinero a otra persona |
