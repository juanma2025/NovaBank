---
description: "Task list for 004-tarjeta-virtual"
---

# Tasks: Tarjeta virtual

**Input**: Design documents from `/specs/004-tarjeta-virtual/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/cards.openapi.json](contracts/cards.openapi.json),
[quickstart.md](quickstart.md)

**Tests**: Incluidas (una por regla de dominio, concurrencia, protección de datos y el E2E de
«congelar tarjeta» que exige la constitución).

## Format: `[ID] [P?] [Story?] [Capa] Description`

| Etiqueta | Rama |
| :--- | :--- |
| `[SH]` | `004-tarjeta-virtual` |
| `[BE]` | `004-tarjeta-virtual-be` |
| `[FE]` | `004-tarjeta-virtual-fe` |
| `[E2E]` | `004-tarjeta-virtual-fe` |

---

## Phase 1: Foundational (Blocking Prerequisites)

### [SH] Contrato en código — rama de definición

- [X] T001 [P] [SH] Crear `shared/src/cards.ts`:
  - `MerchantCategorySchema` (`food`, `books`, `transport`, `stationery`, `entertainment`);
  - `DEMO_MERCHANTS`: los 6 comercios de `MerchantId` en el contrato, con `id`, `name` y `category`, y `MerchantIdSchema`;
  - `luhnCheckDigit(digits)`, `isValidCardNumber(number)` (16 dígitos y Luhn), `normalizeCardNumber` (quita espacios) y `maskCardNumber(last4)` («•••• 1234»).

  Pruebas en `shared/src/cards.test.ts`.
- [X] T002 [SH] Agregar `card_payment` a `MovementTypeSchema` en `shared/src/accounts.schemas.ts`, como en los contratos de la 002, la 003 y la 004 (research R9). Si algún `switch` del backend sobre el tipo deja de compilar, ajustarlo.
- [X] T003 [SH] Agregar a `shared/src/errors.ts` los códigos `CARD_LIMIT_REACHED`, `CARD_CANCELED`, `CARD_NOT_ACTIVE`, `CARD_DECLINED`, `CARD_PAYMENTS_LOCKED`, `PAYMENT_AMOUNT_OUT_OF_RANGE` y `PAYMENT_DAILY_LIMIT`.

  Agregar sus mensajes y estados HTTP en `backend/src/lib/error-messages.ts` y `backend/src/lib/errors.ts`:
  - 409: `CARD_CANCELED`;
  - 429: `CARD_PAYMENTS_LOCKED`;
  - 422: los demás.
- [X] T004 [SH] Crear `shared/src/cards.schemas.ts`, cada esquema igual a [contracts/cards.openapi.json](contracts/cards.openapi.json):
  - `CardStatusSchema`, `CardSchema`, `CardListSchema`;
  - `CardNicknameRequestSchema` (recorta espacios; 1–30);
  - `RevealCardRequestSchema`, `CardSecretsSchema`;
  - `CardPaymentSchema`, `CardPaymentsPageSchema`, `CardPaymentsQuerySchema`;
  - `PaymentLimitsSchema`;
  - `CreateCardPaymentRequestSchema` (estricto; `cardNumber` sin espacios y de 16 dígitos; `expiry` MM/AA; `cvv` de 3 dígitos);
  - `CardPaymentResultSchema`.

  Reexportar `cards.ts` y `cards.schemas.ts` en `shared/src/index.ts`.
- [X] T005 [P] [SH] Pruebas:
  - en `shared/src/cards.schemas.test.ts`: el nombre se recorta y se rechaza vacío o de más de 30; el número se acepta con espacios; se rechazan un vencimiento `13/30`, un CVV de 4 dígitos y campos extra;
  - en `shared/src/contract.test.ts`: los comercios de `DEMO_MERCHANTS` coinciden con `MerchantId`, las categorías con `MerchantCategory`, y los ejemplos del contrato son válidos.
- [X] T006 [P] [SH] Agregar a `.env.example`:
  - `CARD_ENCRYPTION_KEY` (vacía, con el comando para generarla, como en quickstart.md);
  - `CARD_PAYMENT_MIN_AMOUNT=1000`, `CARD_PAYMENT_MAX_AMOUNT=500000` y `CARD_PAYMENT_DAILY_LIMIT=1000000`.

  Agregar las 10 operaciones de la 004 a `PENDING_BACKEND` en `backend/tests/contract/openapi.contract.test.ts`.

**Checkpoint de definición**: PR → `main`. Ambos aprueban también el cambio de `Movement`.

### [BE] Base

- [X] T007 [BE] Agregar a `db/prisma/schema.prisma`:
  - los modelos `Card`, `CardPayment` y `CardPaymentDecline`;
  - los enums `card_status` y `merchant_category`;
  - los valores `system_merchants` en `account_kind`, `card_payment` en `ledger_transaction_type`, y `CARD_ISSUED`, `CARD_FROZEN`, `CARD_UNFROZEN`, `CARD_CANCELED`, `CARD_REVEALED` y `CARD_PAYMENT_APPROVED` en `audit_event_type`.

  Campos de data-model.md:
  - `Card.id`, `Card.user_id`, `Card.nickname`, `Card.last4`, `Card.pan_encrypted`, `Card.pan_hash`, `Card.exp_month`, `Card.exp_year`, `Card.status`, `Card.created_at`, `Card.updated_at` y `Card.canceled_at`;
  - `CardPayment.id`, `CardPayment.card_id`, `CardPayment.transaction_id`, `CardPayment.merchant_id`, `CardPayment.merchant_name`, `CardPayment.category`, `CardPayment.amount` y `CardPayment.created_at`;
  - `CardPaymentDecline.id`, `CardPaymentDecline.user_id` y `CardPaymentDecline.created_at`.
- [X] T008 [BE] Generar la migración `db/prisma/migrations/<timestamp>_cards/migration.sql` y agregarle a mano (los valores de enum nuevos se comparan como texto, como en la 003):
  - los `CHECK` de data-model.md `Card.exp_month`, `Card.last4`, `Card.canceled_at` y `CardPayment.amount`;
  - el trigger que impide modificar una tarjeta cancelada y borrar tarjetas (data-model.md, Card);
  - el trigger de inmutabilidad de `card_payments`;
  - la fila única de `system_merchants`.

  Aplicarla a `nova` y `nova_e2e`.
- [X] T009 [P] [BE] Agregar a `backend/src/config/env.ts` `CARD_ENCRYPTION_KEY` (obligatoria, 64 caracteres hexadecimales) y las 3 variables `CARD_PAYMENT_*` con la regla `min ≤ max ≤ tope` (research R10).

  En `backend/vitest.config.ts`, valores de prueba: una clave fija de prueba y los límites 1000 / 50000 / 60000. Agregar la clave también al job de CI en `.github/workflows/ci.yml` y a `docs/despliegue.md`.
- [X] T010 [P] [BE] Crear `backend/src/lib/card-crypto.ts`:
  - subclaves HKDF (`kEnc`, `kLookup`, `kCvv`);
  - `encryptPan` / `decryptPan` con AES-256-GCM;
  - `panHash`;
  - `deriveCvv`;
  - `generatePan`: prefijo `9`, `crypto.randomInt` y Luhn (research R2, R3).

  Pruebas en `backend/tests/unit/card-crypto.test.ts`: ida y vuelta del cifrado; texto cifrado alterado → error; números Luhn válidos que empiezan por 9; CVV estable para la misma tarjeta y distinto entre tarjetas.
- [X] T011 [BE] Agregar `getSystemMerchantsAccountId` en `backend/src/modules/accounts/accounts.service.ts` y `accounts.repository.ts`, y en `backend/src/lib/logger.ts` la redacción de `cardNumber`, `cvv`, `number` y sus variantes anidadas.
- [X] T012 [BE] Crear `backend/src/modules/cards/cards.repository.ts`:
  - crear la tarjeta;
  - listar por usuario;
  - buscar propia por id;
  - buscar propia por `pan_hash`;
  - `lockById` (`FOR UPDATE`);
  - actualizar estado y nombre;
  - contar las vigentes;
  - insertar pagos y listarlos por cursor;
  - insertar rechazos, leer los recientes y borrar los viejos.

  Registrar en `backend/src/server.ts` la limpieza de rechazos de más de 24 h.

---

## Phase 2: User Story 1 — Emitir y congelar mi tarjeta (Priority: P1) 🎯 MVP

**Independent Test**: se emite una tarjeta; solo se ven los últimos 4 dígitos; se congela y se
descongela, y queda auditado.

### [BE]

- [X] T013 [P] [US1] [BE] Crear `backend/tests/integration/cards.test.ts`. Debe comprobar:
  - emitir: 201, activa, nombre recortado, `last4` igual al final del número real, vencimiento a 4 años, titular en mayúsculas;
  - ninguna respuesta contiene el número completo;
  - congelar y descongelar, y repetir sin cambio (200, una sola auditoría);
  - la tarjeta de otro estudiante o un id inválido → 404;
  - auditoría `CARD_ISSUED`, `CARD_FROZEN` y `CARD_UNFROZEN` con `{ cardId, last4 }`;
  - en la base, `cards` no contiene el número en claro.
- [X] T014 [US1] [BE] Crear `backend/src/modules/cards/cards.service.ts` con `list`, `issue` (cuenta las vigentes con la cuenta bloqueada, research R7; reintenta si `pan_hash` choca), `freeze` y `unfreeze` (fila bloqueada; transiciones de research R8). El titular viene de `auth.directory`.
- [X] T015 [US1] [BE] Crear `backend/src/modules/cards/cards.controller.ts` y `cards.routes.ts` para `GET /cards`, `POST /cards`, `POST /cards/{cardId}/freeze` y `POST /cards/{cardId}/unfreeze`. Agregar:
  - el limitador `cardIssue` en `backend/src/middleware/rate-limit/limiters.ts`;
  - la composición en `backend/src/modules/banking.module.ts` y el montaje en `backend/src/app.ts`;
  - el registro de las operaciones en `backend/src/openapi/registry.ts`, quitándolas de `PENDING_BACKEND`.

### [FE]

- [X] T016 [P] [US1] [FE] Crear `frontend/tests/CardsPage.test.tsx`: lista vacía, emitir con nombre, congelar/descongelar y `CARD_LIMIT_REACHED`.
- [X] T017 [P] [US1] [FE] Crear `frontend/src/features/cards/components/VirtualCard.tsx` (vidrio esmerilado, «•••• 1234», vencimiento, titular, estado con texto y no solo color) y `CardNicknameDialog.tsx`.
- [X] T018 [US1] [FE] Crear `frontend/src/features/cards/api.ts`, los hooks (`useCards`, `useIssueCard`, `useSetCardFrozen`), `frontend/src/features/cards/pages/CardsPage.tsx`, la ruta `/tarjetas` y el acceso «Tarjetas» en `HomePage`.

### [E2E]

- [X] T019 [US1] [E2E] Crear `e2e/cards.spec.ts` con emitir, congelar y descongelar, comprobando lo visible.

---

## Phase 3: User Story 2 — Ver los datos completos con mi contraseña (Priority: P2)

### [BE]

- [X] T020 [P] [US2] [BE] Agregar a `backend/tests/integration/cards.test.ts`:
  - contraseña correcta → número de 16 dígitos con Luhn válido que termina en `last4`, vencimiento y CVV de 3 dígitos, con `Cache-Control: no-store`;
  - contraseña incorrecta → `REAUTH_FAILED`, sin datos;
  - 5 fallos → `REAUTH_LOCKED`, y los fallos se comparten con las transferencias de la 003;
  - una tarjeta cancelada → 409;
  - auditoría `CARD_REVEALED`;
  - los logs capturados durante la prueba no contienen el número ni el CVV.
- [X] T021 [US2] [BE] Agregar `reveal` a `cards.service.ts` (`auth.reauth.verify` fuera de la transacción; `decryptPan` y `deriveCvv`) y `POST /cards/{cardId}/reveal` con `no-store` al controlador y las rutas, con el limitador `cardReveal`. Registrar `revealCard` en `registry.ts` y quitarla de `PENDING_BACKEND`.

### [FE]

- [X] T022 [P] [US2] [FE] Crear `frontend/tests/RevealCardDialog.test.tsx`:
  - contraseña → datos visibles;
  - se ocultan a los 60 s y al desmontar;
  - «Copiar número»;
  - `REAUTH_FAILED` y `REAUTH_LOCKED`;
  - los datos no quedan en la caché de TanStack Query.
- [X] T023 [US2] [FE] Crear `frontend/src/features/cards/components/RevealCardDialog.tsx` y `frontend/src/features/cards/pages/CardDetailPage.tsx` (tarjeta y «Ver datos»), con la ruta `/tarjetas/:id`.

---

## Phase 4: User Story 3 — Pagar en la tienda demo (Priority: P2)

### [BE]

- [X] T024 [P] [US3] [BE] Crear `backend/tests/integration/store-payments.test.ts`. Debe comprobar:
  - pago aprobado: saldo, movimiento `card_payment` con «Compra en {comercio} · •••• {last4}», fila en `card_payments` con la categoría, y el pago en `GET /cards/{id}/payments`;
  - número con espacios;
  - tarjeta congelada o cancelada → `CARD_NOT_ACTIVE` sin mover dinero;
  - número, vencimiento o CVV equivocados, o una tarjeta de otro estudiante → `CARD_DECLINED` (el mismo mensaje en todos los casos);
  - 5 rechazos → `CARD_PAYMENTS_LOCKED` con `Retry-After`, que vence a los 15 min;
  - rango y tope diario (todas las tarjetas; las transferencias no cuentan) con reinicio en el día de Bogotá;
  - `INSUFFICIENT_FUNDS` con `availableBalance`;
  - idempotencia: misma respuesta; otro cuerpo da 409; doble clic simultáneo;
  - **concurrencia**: 5 pagos simultáneos que superan el saldo, y congelar mientras hay pagos en curso (ninguno queda a medias y el saldo coincide con los pagos aprobados);
  - auditoría `CARD_PAYMENT_APPROVED` sin datos de la tarjeta;
  - los logs no contienen el número ni el CVV;
  - la suma del libro es 0.
- [X] T025 [US3] [BE] Crear `backend/src/modules/cards/payments.service.ts` con `limits`, `pay` (flujo de research R6) y `listCardPayments`.
- [X] T026 [US3] [BE] Crear `backend/src/modules/cards/store.controller.ts` y `store.routes.ts` para `GET /store/limits` y `POST /store/payments`, y agregar `GET /cards/{cardId}/payments` al controlador y las rutas de tarjetas. Agregar el limitador `storePayments`, montar `/store` en `backend/src/app.ts`, registrar las 3 operaciones en `registry.ts` y quitarlas de `PENDING_BACKEND`.

### [FE]

- [X] T027 [P] [US3] [FE] Crear `frontend/tests/StorePage.test.tsx`:
  - elegir comercio → monto → datos;
  - validación Luhn y MM/AA mientras se escribe;
  - `CARD_DECLINED`, `CARD_NOT_ACTIVE`, `INSUFFICIENT_FUNDS` y `CARD_PAYMENTS_LOCKED`;
  - el reintento usa la misma `Idempotency-Key`.
- [X] T028 [US3] [FE] Crear:
  - `frontend/src/features/store/` (api, hooks, `StorePage.tsx`) y la ruta `/tienda`, con acceso desde `HomePage`;
  - la lista de pagos en `CardDetailPage`;
  - en `MovementItem` (spec 002), el tipo `card_payment`.

  Al pagar, invalidar `['account']`, `['movements']` y `['cards']`.

### [E2E]

- [X] T029 [US3] [E2E] Ampliar `e2e/cards.spec.ts`: recargar, emitir, ver datos con la contraseña, pagar en la tienda con esos datos y comprobar el saldo; congelar la tarjeta y comprobar que el mismo pago se rechaza (flujo crítico de la constitución).

---

## Phase 5: User Story 4 — Administrar varias tarjetas (Priority: P3)

### [BE]

- [X] T030 [P] [US4] [BE] Agregar a `backend/tests/integration/cards.test.ts`:
  - 3 vigentes; la cuarta → `CARD_LIMIT_REACHED`, incluso con 4 emisiones simultáneas;
  - cancelar libera el cupo y la nueva tarjeta tiene otro número;
  - renombrar; renombrar, congelar o descongelar una cancelada → 409;
  - las canceladas siguen en la lista;
  - auditoría `CARD_CANCELED`.
- [X] T031 [US4] [BE] Agregar `rename` y `cancel` a `cards.service.ts`, y `PATCH /cards/{cardId}` y `POST /cards/{cardId}/cancel` al controlador y las rutas. Registrar ambas en `registry.ts`, quitarlas de `PENDING_BACKEND` y dejar la lista vacía.

### [FE]

- [X] T032 [P] [US4] [FE] Crear `frontend/tests/CardDetailPage.test.tsx`: renombrar, cancelar con confirmación, una cancelada sin acciones y la lista con canceladas atenuadas.
- [X] T033 [US4] [FE] Agregar a `CardDetailPage` las acciones de renombrar y cancelar (diálogo de confirmación accesible), y en `CardsPage` el orden (vigentes primero) y el aviso del máximo.

---

## Phase 6: Polish

- [X] T034 [P] [FE] Revisar la accesibilidad y el diseño adaptable de `/tarjetas`, `/tarjetas/:id` y `/tienda` (SC-006). Registrar el resultado en `specs/004-tarjeta-virtual/checklists/accessibility.md`.
- [X] T035 [E2E] Ejecutar la validación de [quickstart.md](quickstart.md) con todo integrado, antes de `/speckit-converge`.

### Ajustes del análisis de consistencia (U1)

- [X] T036 [BE] En `backend/src/modules/cards/payments.service.ts`, rechazar con `CARD_NOT_ACTIVE` una tarjeta cuyo mes de vencimiento ya terminó en hora de Bogotá (FR-013, research R6), dentro de la transacción y después de la idempotencia. Prueba en `backend/tests/integration/store-payments.test.ts`: el último día del mes de vencimiento paga; al mes siguiente se rechaza sin mover dinero.
- [X] T037 [FE] En `frontend/src/features/cards/components/VirtualCard.tsx`, mostrar «Vencida» (texto, no solo color) cuando `expMonth`/`expYear` ya pasaron en hora de Bogotá, con su prueba en `frontend/tests/CardsPage.test.tsx`.

---

## Dependencies & Execution Order

| Tareas | Dependen de |
| :--- | :--- |
| `[SH]` T001–T006 | Nada; cierran la definición |
| `[BE]`/`[FE]` | Definición integrada |
| US2, US3, US4 | US1 (tarjeta emitida) |
| US3 en el frontend | US2 (los datos para pagar) |
| `[E2E]` | El workspace `e2e/` de la spec 001 |

## Implementation Strategy

Definición → base `[BE]` (T007–T012) → US1 → US2 → US3 → US4 → pulido. El backend puede ir en un solo
PR, como en la 003.
