# Research: Tarjeta virtual

**Feature**: `004-tarjeta-virtual` · **Date**: 2026-11-22 · **Plan**: [plan.md](plan.md)

Se reutiliza lo de las specs 001–003: sesión, auditoría, formato de error, límites de tasa,
`accounts`, `ledger` (con descripción por asiento), idempotencia, `startOfBogotaDay` y la
reautenticación de `auth` (`reauth.verify`).

---

## R1. Módulo `cards` y fronteras (Principio VI)

| Módulo | Dueño de | Lo que expone |
| :--- | :--- | :--- |
| `cards` (nuevo) | `cards`, `card_payments`, `card_payment_declines` | Endpoints de tarjetas (`/cards`) y de la tienda demo (`/store`) |
| `accounts` (002) | `accounts` | **Nuevo**: `getSystemMerchantsAccountId` |
| `ledger` (002) | sin cambios de propiedad | Tipo nuevo `card_payment` |
| `auth` (001) | `users`, `login_attempts` | Sin cambios: `directory.findById` (titular) y `reauth.verify` (003) |

`cards` no toca tablas ajenas: usa `accounts`, `ledger`, idempotencia y `auth`. La tabla
`card_payments` referencia `ledger_transactions.id`, como `accounts.user_id` referencia `users.id`.

## R2. Número, vencimiento y CVV (FR-003, regla de dominio 8)

**Decision**:
- **Número**: 16 dígitos: `9` + 14 dígitos aleatorios (`crypto.randomInt`) + dígito de control Luhn.
  El prefijo `9` (asignación nacional en ISO/IEC 7812) no pertenece a ninguna franquicia
  (Principio V). La unicidad la garantiza un índice único sobre su HMAC; si choca, se genera otro.
- **Vencimiento**: mes y año de emisión + 4 años (hora de Bogotá), guardados como `exp_month` y
  `exp_year`.
- **CVV**: **no se guarda**. Se deriva: `HMAC-SHA256(kCvv, cardId + ':' + número + ':' + MM/AA)`,
  reducido a 3 dígitos. Siempre da el mismo valor para la misma tarjeta y no se puede calcular sin la
  clave.

**Alternatives considered**: guardar el CVV cifrado (un dato sensible más en la base, sin ventaja);
un prefijo `4` o `5` (parecería una franquicia real).

## R3. Protección del número (Principio III, regla de dominio 8)

**Decision**:
- Una sola variable de entorno, `CARD_ENCRYPTION_KEY` (32 bytes en hexadecimal, 64 caracteres). De
  ella se derivan con HKDF-SHA256 tres subclaves con etiquetas distintas:
  - `kEnc`: cifra el número con **AES-256-GCM** (IV aleatorio de 12 bytes; se guarda
    `iv ‖ tag ‖ texto cifrado` en `pan_encrypted`);
  - `kLookup`: `pan_hash = HMAC-SHA256(kLookup, número)` para encontrar la tarjeta al pagar sin
    descifrar;
  - `kCvv`: deriva el CVV (R2).
- Se guardan en claro solo `last4`, el vencimiento y el estado.
- Los datos completos solo salen en `POST /cards/{id}/reveal`, con `Cache-Control: no-store` y
  `Pragma: no-cache`. La redacción de `pino` agrega `cardNumber`, `cvv` y `number`; los cuerpos de
  request ya se redactan (spec 001).
- Producción exige `CARD_ENCRYPTION_KEY`; en desarrollo y pruebas también (sin valor por defecto),
  para que nunca se cifre con una clave conocida.

**Alternatives considered**: `pgcrypto` en la base (la clave viajaría en cada consulta); cifrar
también `last4` (se muestra en todas las vistas; no aporta).

## R4. Ver los datos completos (FR-008, FR-009)

**Decision**: `POST /cards/{id}/reveal` con `{ password }`. Usa `auth.reauth.verify` de la spec 003,
**fuera** de cualquier transacción, así que el bloqueo (5 fallos en 15 min → 15 min) es el mismo que
el de las transferencias. Responde `{ number, expMonth, expYear, cvv }`. Una tarjeta cancelada
responde 409 `CARD_CANCELED`. Auditoría `CARD_REVEALED`. Límite de tasa `cardReveal` (30 cada
15 min) para acotar el costo de Argon2.

El frontend guarda los datos solo en el estado del componente, los oculta a los 60 s o al
desmontarse, y nunca en TanStack Query (que es una caché del cliente).

## R5. Pagos en la tienda demo (FR-011–FR-018)

**Decision**:
- **Comercios**: lista fija en `@nova/shared` (`DEMO_MERCHANTS`), cada uno con `id`, `name` y
  `category` (`food`, `books`, `transport`, `stationery`, `entertainment`). No hay tabla ni endpoint:
  el frontend y el backend usan la misma constante. El pago guarda el `merchant_id`, el nombre y la
  categoría para la spec 006.
- **Cuenta técnica**: nuevo `account_kind = system_merchants`, una sola fila creada en la migración.
  Igual que `system_topups`, no tiene saldo materializado ni se bloquea, así que no es un cuello de
  botella.
- **Solo tarjetas propias**: la búsqueda es `pan_hash = ? AND user_id = sesión`. Con datos de otra
  persona el resultado es el mismo que con datos inventados (`CARD_DECLINED`).
- **Rechazos por datos equivocados**: se guardan en `card_payment_declines` **fuera** de la
  transacción (como la reautenticación de la 003). Con 5 en 15 minutos, `POST /store/payments`
  responde 429 `CARD_PAYMENTS_LOCKED` durante 15 minutos (`retryAfterSeconds`). Un pago aprobado no
  borra los rechazos (los datos equivocados son la señal de abuso, no el éxito). Limpieza de más de
  24 h con el scheduler de mantenimiento.

## R6. Flujo de `POST /store/payments`

1. Validar el cuerpo y `Idempotency-Key`. El número llega sin espacios (el esquema los quita).
2. Rango → `PAYMENT_AMOUNT_OUT_OF_RANGE` (no depende de datos guardados).
3. Bloqueo por rechazos activo → `CARD_PAYMENTS_LOCKED`.
4. Buscar la tarjeta propia por `pan_hash`; comparar vencimiento y CVV en tiempo constante. Si algo
  no coincide: registrar el rechazo (fuera de la transacción) y responder `CARD_DECLINED` o, si con
  este llega a 5, `CARD_PAYMENTS_LOCKED`.
5. **Transacción**:
   1. cuenta propia (`ensureForUser`) y `lockForUpdate`;
   2. bloquear la fila de la tarjeta (`SELECT … FOR UPDATE`): serializa con congelar y cancelar;
   3. `idempotency.begin` (scope `store.payments`; el hash cubre `{ merchantId, amount, cardId }`,
      nunca el número ni el CVV);
   4. tarjeta no activa → `CARD_NOT_ACTIVE`;
   5. tope diario de pagos con tarjeta desde el inicio del día en Bogotá → `PAYMENT_DAILY_LIMIT`;
   6. saldo → `INSUFFICIENT_FUNDS` con `availableBalance`;
   7. `ledger.post` (`card_payment`): −monto al estudiante con la descripción
      «Compra en {comercio} · •••• {last4}» y +monto a `system_merchants`;
   8. fila en `card_payments`; auditoría `CARD_PAYMENT_APPROVED`;
   9. `idempotency.complete`.

**Por qué el estado se revisa dentro de la transacción**: si la tarjeta se congela mientras el pago
está en curso, el bloqueo de su fila hace que el pago vea el estado final (edge case de la spec).

## R7. Hasta 3 tarjetas vigentes (FR-002)

**Decision**: `POST /cards` cuenta las tarjetas no canceladas **dentro de una transacción que bloquea
la cuenta del estudiante** (`accounts.lockForUpdate`). Dos emisiones simultáneas se serializan y
nunca quedan 4 vigentes. La cuarta responde 422 `CARD_LIMIT_REACHED`. Límite de tasa `cardIssue`
(10 por hora), como pide la constitución para la emisión.

## R8. Estados de la tarjeta

| Desde | Acción | Hacia | Si no aplica |
| :--- | :--- | :--- | :--- |
| `active` | congelar | `frozen` | — |
| `frozen` | descongelar | `active` | — |
| `active` o `frozen` | cancelar | `canceled` | — |
| `frozen` | congelar | `frozen` (sin cambio, 200) | — |
| `active` | descongelar | `active` (sin cambio, 200) | — |
| `canceled` | cualquier acción o ver datos | — | 409 `CARD_CANCELED` |

Repetir una acción que ya está aplicada responde 200 sin auditar otra vez. Cambiar el nombre está
permitido en `active` y `frozen`.

## R9. Cambio en el contrato de `Movement`

`Movement.type` agrega `card_payment`. El contrato de la 002 y la copia de `Movement` en el de la 003
se actualizan en el PR de definición de la 004 (cambio aprobado por ambos, como en la 003 R8). La
descripción del movimiento sale del asiento (spec 003 R5), así que `ledger` no cambia su lectura.

## R10. Límites configurables

`CARD_PAYMENT_MIN_AMOUNT=1000`, `CARD_PAYMENT_MAX_AMOUNT=500000` y
`CARD_PAYMENT_DAILY_LIMIT=1000000`, validados con Zod (`min ≤ max ≤ tope`). `GET /store/limits`
devuelve los tres y `remainingToday`.
