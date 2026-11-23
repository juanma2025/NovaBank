# Implementation Plan: Gastos compartidos

**Branch**: `007-gastos-compartidos` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-gastos-compartidos/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Una estudiante divide un gasto entre ella y hasta 10 compañeros. Nova propone partes iguales, que se
pueden ajustar. Crear la división no mueve dinero: cada participante paga su parte con «Pagar mi
parte», que hace una **transferencia normal** a quien creó la división y marca la parte como pagada
en la misma transacción. Quien creó la división puede marcar partes como pagadas por fuera, enviar
recordatorios y cancelarla; cada participante puede rechazar su parte. Los avisos llegan en Nova y
por correo.

**Enfoque técnico** (detalle en [research.md](research.md)):

| Tema | Decisión |
| :--- | :--- |
| Módulo | `splits` nuevo, dueño de 2 tablas; el dinero solo se mueve con `transfers.create` (R1) |
| Pagar una parte | `transfers.create(input, { inTransaction })`: la parte se bloquea y se marca dentro de la transacción de la transferencia (R2) |
| Participantes | `recipientId` de la vista previa de la spec 003 (R3) |
| Montos | `splitEvenly` en `@nova/shared`; la suma se valida en el backend (R4) |
| Estados | Partes solo salen de `pending`; la división se completa al resolver la última (R5) |
| Contratos existentes | Sin cambios |

## Technical Context

**Language/Version**: igual que las specs 001–006 (TypeScript 6.0, Node.js 24, React 19).

**Primary Dependencies**: **ninguna nueva.**

**Storage**: PostgreSQL 17. Dos tablas nuevas, dos enums y tres valores en `email_template`. Ver
[data-model.md](data-model.md).

**Testing**: igual que la 006, más pruebas de: pagos simultáneos de la misma parte, pagar mientras se
cancela, idempotencia del pago, reglas de transferencias heredadas (saldo, contraseña) y correos.

**Performance Goals**: crear una división en menos de 60 s (SC-001) y pagar una parte en menos de 30 s
(SC-002).

**Constraints**: regla de dominio 11 (la división no mueve dinero; cada pago es una transferencia
normal con todas sus reglas).

**Scale/Scope**: 9 operaciones nuevas, 3 pantallas (lista, crear y detalle), 2 tablas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / regla | Verificación | Estado |
| :--- | :--- | :--- |
| I. Doble entrada, atomicidad, saldo no negativo | El pago es una transferencia de la spec 003: mismos asientos, bloqueos y verificación de saldo; la parte se marca en esa misma transacción (R2) | ✅ |
| I. Idempotencia | «Pagar mi parte» exige `Idempotency-Key` y usa la de las transferencias (R2) | ✅ |
| II. SDD | Sin porcentajes, recibos, grupos ni reembolsos automáticos (fuera de la spec) | ✅ |
| III. Reautenticación | La contraseña por encima del umbral se aplica igual que en una transferencia (R2) | ✅ |
| III. Privacidad | Nombres parciales; nunca el correo completo de los demás (FR-013) | ✅ |
| III. Mínimo privilegio | Divisiones ajenas → 404; solo quien creó cancela, marca o recuerda (R5) | ✅ |
| VI. Monolito modular | `splits` no toca tablas ajenas; usa el servicio público de `transfers` (R1) | ✅ |
| VI. Contratos primero | [contracts/splits.openapi.json](contracts/splits.openapi.json); los contratos existentes no cambian | ✅ |
| Regla de dominio 11 | Crear, rechazar, marcar, recordar y cancelar no mueven dinero; pagar es una transferencia normal sujeta a todas las reglas (R2) | ✅ |
| Seguridad: límites de tasa | `splitCreate` (R9); el pago usa el límite de transferencias | ✅ |
| Seguridad: auditoría | El pago queda auditado como `TRANSFER_COMPLETED` (R9) | ✅ |

**Estado del gate**: ✅ aprobado, sin violaciones ni enmiendas.

## Project Structure

```text
specs/007-gastos-compartidos/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md · tasks.md
├── contracts/splits.openapi.json
└── checklists/requirements.md

shared/src/
├── splits.ts                # [SH] SPLIT_MAX_PARTICIPANTS, SPLIT_TOTAL_MIN/MAX, SPLIT_TITLE_MAX_LENGTH, splitEvenly
├── splits.schemas.ts        # [SH] Split, SplitShare, SplitListItem, SplitsPage, SplitsSummary,
│                            #      CreateSplitRequest, PayShareRequest, PayShareResult, SplitsQuery
└── errors.ts                # [SH] + 5 códigos

db/prisma/                   # [BE] Split, SplitShare; enums; migración (CHECK y triggers)

backend/src/
├── lib/mail/templates/index.ts      # [BE] split_invitation, split_reminder, split_paid
├── modules/transfers/transfers.service.ts  # [BE] create(input, { inTransaction })
└── modules/splits/                  # [BE] repository, service, controller, routes

frontend/src/                        # [FE]
├── features/splits/pages/SplitsPage.tsx       # lista: las que creé y en las que participo
├── features/splits/pages/NewSplitPage.tsx     # título, total, participantes (vista previa 003), partes
├── features/splits/pages/SplitDetailPage.tsx  # partes y acciones según el rol; «Pagar mi parte»
└── features/home/components/SplitsSummaryCard.tsx   # «Te deben» / «Debes»

e2e/splits.spec.ts                   # [E2E]
```

## Diseño del backend

### Endpoints

Todos con `require-auth`. Detalle en [contracts/splits.openapi.json](contracts/splits.openapi.json).

| Método y ruta | Historia | Requisitos |
| :--- | :--- | :--- |
| `POST /splits` | US1 | FR-001–FR-004, FR-015 |
| `GET /splits/{splitId}` | US1, US2 | FR-013, FR-014 |
| `POST /splits/{splitId}/shares/me/pay` | US1 | FR-005, FR-006, FR-009, FR-015 |
| `GET /splits` | US2 | FR-012 |
| `GET /splits/summary` | US2 | FR-012 |
| `POST /splits/{splitId}/shares/me/decline` | US2 | FR-008, FR-009 |
| `POST /splits/{splitId}/shares/{shareId}/mark-paid` | US2 | FR-007, FR-009 |
| `POST /splits/{splitId}/shares/{shareId}/remind` | US2 | FR-011 |
| `POST /splits/{splitId}/cancel` | US2 | FR-010 |

Una división, o una parte, que no es UUID, que no existe o en la que la estudiante no participa →
404. Las acciones de quien creó, pedidas por un participante → 404 (no revela qué acciones existen).

**Límite de tasa nuevo**: `splitCreate` (20 por hora).

## Diseño del frontend

| Ruta | Pantalla | Estados |
| :--- | :--- | :--- |
| `/compartidos` | `SplitsPage`: lista paginada con título, total, rol, estado y lo pendiente; acceso a «Nueva división» | Carga; vacío («Divide tu primer gasto») |
| `/compartidos/nueva` | `NewSplitPage`: título y total; participantes con la vista previa de destinatario de la spec 003 (nombre parcial y correo enmascarado); partes propuestas con `splitEvenly` y editables, mostrando la parte propia y si la suma cuadra | `RECIPIENT_NOT_FOUND`, `TRANSFER_TO_SELF` y duplicados en el campo; `SPLIT_SHARES_MISMATCH`; `SPLIT_SHARE_OUT_OF_RANGE` |
| `/compartidos/:id` | `SplitDetailPage`: partes con estado (texto e icono); participante: «Pagar mi parte» (contraseña si supera el umbral) y «Rechazar»; quien creó: «Marcar pagada por fuera», «Recordar» y «Cancelar» con confirmación | Errores de transferencia de la spec 003; `SHARE_NOT_PENDING`; `SPLIT_CLOSED`; `SPLIT_REMINDER_TOO_SOON` con la hora; reintento del pago con la **misma** `Idempotency-Key` |
| `/inicio` (002) | `SplitsSummaryCard`: «Te deben» y «Debes», con acceso a `/compartidos` | Oculta si ambos son 0 |

Tras pagar, invalidar `['account']`, `['movements']`, `['splits']` y `['budget']`.

## Paquete `@nova/shared`

| Exportación | Uso |
| :--- | :--- |
| `SPLIT_MAX_PARTICIPANTS`, `SPLIT_TOTAL_MIN`, `SPLIT_TOTAL_MAX`, `SPLIT_TITLE_MAX_LENGTH`, `SPLIT_REMINDER_INTERVAL_HOURS` | Reglas de la división |
| `splitEvenly(total, participants)` | Partes iguales con el sobrante para quien crea (R4) |
| Esquemas de `splits.schemas.ts` | API |
| `ERROR_CODES` + `SPLIT_SHARES_MISMATCH`, `SPLIT_SHARE_OUT_OF_RANGE`, `SPLIT_CLOSED`, `SHARE_NOT_PENDING`, `SPLIT_REMINDER_TOO_SOON` | Errores |

## Guía para `/speckit-tasks`

Las etiquetas `[SH]`, `[BE]`, `[FE]` y `[E2E]` tienen el mismo alcance que en la 006. Orden de las
historias: US1 (crear y pagar) → US2 (seguir y gestionar).

## Complexity Tracking

| Decisión | Por qué se necesita | Alternativa más simple descartada porque |
| :--- | :--- | :--- |
| Paso opcional dentro de la transacción de `transfers.create` | Que la transferencia y la parte pagada sean atómicas y una parte nunca se pague dos veces (R2) | Dos transacciones separadas pueden dejar dinero movido con la parte pendiente; copiar la lógica de transferencias incumple la regla de dominio 11 |
