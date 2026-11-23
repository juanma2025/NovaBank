# Implementation Plan: Tarjeta virtual

**Branch**: `004-tarjeta-virtual` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-tarjeta-virtual/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Cada estudiante puede tener hasta 3 tarjetas virtuales con nombre: las emite al instante, las
congela, las descongela, las renombra y las cancela. En las vistas estándar solo se ven los últimos
4 dígitos; el número completo, el vencimiento y el CVV se muestran tras escribir la contraseña. Con
esos datos paga en una «Tienda demo» dentro de Nova, con comercios ficticios; cada pago aprobado se
registra en el libro contable de la spec 002.

**Enfoque técnico** (detalle en [research.md](research.md)):

| Tema | Decisión |
| :--- | :--- |
| Módulo | `cards` nuevo, dueño de 3 tablas; usa `accounts`, `ledger`, idempotencia y `auth` (R1) |
| Datos de la tarjeta | Número con prefijo `9` y Luhn, cifrado con AES-256-GCM; búsqueda por HMAC; CVV derivado, nunca guardado (R2, R3) |
| Ver datos | Contraseña con el bloqueo compartido de la spec 003; `Cache-Control: no-store` (R4) |
| Pagos | Solo tarjetas propias; rechazo genérico y bloqueo tras 5 rechazos; estado revisado con la fila de la tarjeta bloqueada (R5, R6) |
| Comercios | Lista fija en `@nova/shared`; cuenta técnica `system_merchants` sin cuello de botella (R5) |
| Contrato congelado | `Movement.type` suma `card_payment` en los contratos de la 002 y la 003 (R9) |

## Technical Context

**Language/Version**: igual que las specs 001–003 (TypeScript 6.0, Node.js 24, React 19).

**Primary Dependencies**: **ninguna nueva.** El cifrado usa `node:crypto` (AES-256-GCM, HKDF, HMAC).

**Storage**: PostgreSQL 17. Tres tablas nuevas (`cards`, `card_payments`, `card_payment_declines`),
valores nuevos en enums y una fila nueva en `accounts`. Ver [data-model.md](data-model.md).

**Testing**: igual que la 003, más pruebas de: pagos simultáneos, congelar durante un pago,
emisiones simultáneas (máximo 3), bloqueo por rechazos, ausencia del número y el CVV en logs,
respuestas y la base en claro.

**Performance Goals**: emitir en menos de 15 s (SC-001) y pagar en menos de 60 s (SC-003).

**Constraints**: los de la 002 y la 003, más la regla de dominio 8 (tarjeta congelada, últimos 4
dígitos, datos completos solo con reautenticación y fuera de logs y cachés).

**Scale/Scope**: 10 operaciones nuevas, 3 pantallas (tarjetas, detalle de tarjeta y tienda demo), 3
tablas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / regla | Verificación | Estado |
| :--- | :--- | :--- |
| I. Dinero exacto, doble entrada, atomicidad | 2 asientos (−estudiante / +`system_merchants`) en una transacción con la fila de `card_payments` (R6) | ✅ |
| I. Saldo nunca negativo + bloqueo | `lockForUpdate` de la cuenta; `INSUFFICIENT_FUNDS` antes de registrar; el `CHECK` de la 002 como respaldo (R6) | ✅ |
| I. Idempotencia | `Idempotency-Key` en `POST /store/payments`; el hash excluye número, vencimiento y CVV (R6) | ✅ |
| II. SDD | Sin tarjetas físicas, billeteras, devoluciones ni cuotas (fuera de la spec) | ✅ |
| III. Reautenticación | Ver datos exige contraseña con bloqueo (R4) | ✅ |
| III. Mínimo privilegio | Tarjetas ajenas → 404; la tienda solo acepta tarjetas propias (R5) | ✅ |
| III. Secretos y logs | `CARD_ENCRYPTION_KEY` en el entorno; redacción de `cardNumber`, `cvv` y `number`; `no-store` (R3) | ✅ |
| V. Simulación segura | Prefijo `9` fuera de franquicias; comercios ficticios; sin sistemas externos (R2, R5) | ✅ |
| VI. Monolito modular | `cards` no toca tablas ajenas (R1) | ✅ |
| VI. Contratos primero | [contracts/cards.openapi.json](contracts/cards.openapi.json). `Movement` cambia en los contratos de la 002 y la 003, y lo aprueban ambos en este PR (R9) | ✅ |
| Regla de dominio 8 | Congelada rechaza de inmediato (estado leído con la fila bloqueada); últimos 4 en vistas estándar; datos con reautenticación (R4–R6) | ✅ |
| Seguridad: límites de tasa | `cardIssue`, `cardReveal` y `storePayments` (R4, R5, R7) | ✅ |
| Seguridad: auditoría | Emitir, congelar, descongelar, cancelar, ver datos y pagar (data-model.md) | ✅ |

**Estado del gate**: ✅ aprobado, sin violaciones ni enmiendas.

## Project Structure

```text
specs/004-tarjeta-virtual/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md · tasks.md
├── contracts/cards.openapi.json
└── checklists/requirements.md
specs/002-cuentas-ledger/contracts/accounts.openapi.json    # Movement.type + card_payment (R9)
specs/003-transferencias/contracts/transfers.openapi.json   # copia de Movement (R9)

shared/src/
├── accounts.schemas.ts      # [SH] MovementType + 'card_payment'
├── cards.ts                 # [SH] DEMO_MERCHANTS, MerchantCategory, luhnCheckDigit, isValidCardNumber,
│                            #      maskCardNumber, normalizeCardNumber
├── cards.schemas.ts         # [SH] Card, CardList, CardNicknameRequest, RevealCardRequest, CardSecrets,
│                            #      CardPayment, CardPaymentsPage, CardPaymentsQuery, PaymentLimits,
│                            #      CreateCardPaymentRequest, CardPaymentResult
└── errors.ts                # [SH] + 7 códigos

db/prisma/                   # [BE] Card, CardPayment, CardPaymentDecline; enums; migración (CHECK, triggers, fila system_merchants)

backend/src/
├── lib/card-crypto.ts               # [BE] HKDF, AES-256-GCM, HMAC de búsqueda, CVV derivado
├── modules/accounts/                # [BE] + getSystemMerchantsAccountId
└── modules/cards/                   # [BE] repository, service (cards), payments.service (tienda),
                                     #      controller, routes (/cards y /store)

frontend/src/                        # [FE]
├── features/cards/pages/CardsPage.tsx         # lista, emitir, congelar, renombrar, cancelar
├── features/cards/pages/CardDetailPage.tsx    # tarjeta, ver datos (60 s), pagos de la tarjeta
├── features/cards/components/VirtualCard.tsx · RevealCardDialog.tsx · CardNicknameDialog.tsx
├── features/store/pages/StorePage.tsx         # comercios → monto → datos de la tarjeta → resultado
└── features/home/components/MovementItem.tsx  # + tipo card_payment (spec 002)

e2e/cards.spec.ts                    # [E2E] emitir, ver datos, pagar, congelar → rechazado
```

## Diseño del backend

### Endpoints

Todos con `require-auth`. Detalle en [contracts/cards.openapi.json](contracts/cards.openapi.json).

| Método y ruta | Historia | Requisitos |
| :--- | :--- | :--- |
| `GET /cards` | US1, US4 | FR-002, FR-007 |
| `POST /cards` | US1, US4 | FR-001–FR-003, FR-006 |
| `PATCH /cards/{cardId}` | US4 | FR-005 |
| `POST /cards/{cardId}/freeze` | US1 | FR-004, FR-013 |
| `POST /cards/{cardId}/unfreeze` | US1 | FR-004 |
| `POST /cards/{cardId}/cancel` | US4 | FR-005 |
| `POST /cards/{cardId}/reveal` | US2 | FR-008–FR-010 |
| `GET /cards/{cardId}/payments` | US3 | FR-020 |
| `GET /store/limits` | US3 | FR-015 |
| `POST /store/payments` | US3 | FR-011–FR-019 |

Un `cardId` que no es UUID, que no existe o que es de otro estudiante responde 404 `NOT_FOUND`.

**Flujo de `POST /store/payments`**: ver research R6.

### Variables de entorno nuevas

| Variable | Valor por defecto | Regla |
| :--- | :--- | :--- |
| `CARD_ENCRYPTION_KEY` | — (obligatoria) | 64 caracteres hexadecimales (32 bytes) |
| `CARD_PAYMENT_MIN_AMOUNT` | `1000` | `min ≤ max ≤ tope` |
| `CARD_PAYMENT_MAX_AMOUNT` | `500000` | |
| `CARD_PAYMENT_DAILY_LIMIT` | `1000000` | |

**Límites de tasa nuevos**: `cardIssue` (10 por hora), `cardReveal` (30 cada 15 min) y
`storePayments` (30 cada 15 min).

## Diseño del frontend

| Ruta | Pantalla | Estados |
| :--- | :--- | :--- |
| `/tarjetas` | `CardsPage`: tarjetas como `VirtualCard` (vidrio esmerilado, nombre, •••• últimos 4, vencimiento, titular, estado). Acciones: nueva (diálogo con nombre), congelar/descongelar con un toque | Carga; vacío («Aún no tienes tarjetas»); `CARD_LIMIT_REACHED` al emitir; canceladas al final, atenuadas |
| `/tarjetas/:id` | `CardDetailPage`: tarjeta, «Ver datos» (`RevealCardDialog` → datos 60 s con cuenta regresiva y «Copiar número»), renombrar, cancelar con confirmación, lista de pagos de la tarjeta | `REAUTH_FAILED` y `REAUTH_LOCKED` en el diálogo; 404 → «No encontramos esta tarjeta»; los datos viven solo en el estado del componente (nunca en TanStack Query) |
| `/tienda` | `StorePage`: comercios de `DEMO_MERCHANTS` → monto (con límites y lo que queda hoy) → número, MM/AA y CVV (validación Luhn al escribir) → resultado | `CARD_DECLINED` genérico; `CARD_NOT_ACTIVE`; `INSUFFICIENT_FUNDS` con el disponible; `CARD_PAYMENTS_LOCKED` con cuenta regresiva; reintento con la **misma** `Idempotency-Key` |
| `/inicio`, `/movimientos` (002) | `MovementItem` reconoce el tipo `card_payment` (icono de tarjeta) | — |

`HomePage` (002) agrega los accesos «Tarjetas» y «Tienda demo».

## Paquete `@nova/shared`

| Exportación | Uso |
| :--- | :--- |
| `DEMO_MERCHANTS`, `MerchantIdSchema`, `MerchantCategorySchema` | Comercios de la tienda (FR-011) |
| `luhnCheckDigit`, `isValidCardNumber`, `normalizeCardNumber`, `maskCardNumber` | Número de tarjeta: generar, validar al escribir, quitar espacios, «•••• 1234» |
| `CardSchema`, `CardListSchema`, `CardStatusSchema`, `CardNicknameRequestSchema` | Tarjetas |
| `RevealCardRequestSchema`, `CardSecretsSchema` | Ver datos |
| `CardPaymentSchema`, `CardPaymentsPageSchema`, `CardPaymentsQuerySchema` | Pagos de una tarjeta |
| `PaymentLimitsSchema`, `CreateCardPaymentRequestSchema`, `CardPaymentResultSchema` | Tienda |
| `MovementTypeSchema` + `card_payment` | Cambio en la 002 (R9) |
| `ERROR_CODES` + `CARD_LIMIT_REACHED`, `CARD_CANCELED`, `CARD_NOT_ACTIVE`, `CARD_DECLINED`, `CARD_PAYMENTS_LOCKED`, `PAYMENT_AMOUNT_OUT_OF_RANGE`, `PAYMENT_DAILY_LIMIT` | Errores |

## Guía para `/speckit-tasks`

Las etiquetas `[SH]`, `[BE]`, `[FE]` y `[E2E]` tienen el mismo alcance que en la 003. Orden de las
historias: US1 (emitir y congelar) → US2 (ver datos) → US3 (pagar) → US4 (varias tarjetas).

## Complexity Tracking

| Decisión | Por qué se necesita | Alternativa más simple descartada porque |
| :--- | :--- | :--- |
| Número cifrado + HMAC de búsqueda | Revelar el número exige descifrarlo; pagar exige encontrarlo sin descifrar todas las tarjetas (R3) | Guardarlo en claro incumple la regla de dominio 8 y el Principio III |
| CVV derivado con HMAC | Mostrar y verificar el CVV sin guardarlo (R2) | Guardarlo cifrado agrega un dato sensible sin beneficio |
| Tabla de rechazos fuera de la transacción | Que el bloqueo por datos equivocados se acumule (R5) | Dentro de la transacción, el rechazo se revierte con ella |
