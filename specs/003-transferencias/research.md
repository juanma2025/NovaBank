# Research: Transferencias entre estudiantes

**Feature**: `003-transferencias` · **Date**: 2026-11-22 · **Plan**: [plan.md](plan.md)

Se reutiliza lo de las specs 001 y 002: sesión, auditoría, formato de error, límites de tasa,
`accounts`, `ledger`, idempotencia y `startOfBogotaDay`.

---

## R1. Módulos y fronteras (Principio VI)

| Módulo | Dueño de | Lo que expone |
| :--- | :--- | :--- |
| `profile` (nuevo) | `profiles` | `getProfile(userId)`, `setAlias`, `removeAlias`, `findUserIdByAlias(alias)` |
| `auth` (001) | `users`, `login_attempts` | **Nuevo**: `directory.findByEmail(email)`, `directory.findById(id)` → `{ userId, fullName, email }`; `reauth.verify(userId, password, requestId)` |
| `transfers` (nuevo) | — (orquesta) | Endpoints de destinatario, límites y transferencias |
| `ledger` (002) | sin cambios de propiedad | `post` acepta `counterpartyAccountId`, `note` y una descripción por asiento |

`transfers` no toca tablas: usa `auth`, `profile`, `accounts`, `ledger` e idempotencia.

## R2. Alias en una tabla propia del módulo `profile`

**Decision**: tabla `profiles (user_id PK, alias UNIQUE NULL, updated_at)`. El alias se guarda
normalizado: minúsculas y sin la arroba. Formato `^[a-z0-9](?:[a-z0-9._]{1,18}[a-z0-9])$` (3–20,
sin punto ni guion bajo al inicio o al final, FR-015). La unicidad la garantiza el índice
(FR-016); la carrera entre dos estudiantes que piden el mismo alias se resuelve con la violación de
unicidad, que da 409 `ALIAS_TAKEN`.

**Alternatives considered**: una columna en `users` (tabla de `auth`, rompe el Principio VI).

## R3. Destinatario fijado en la vista previa (FR-005)

**Decision**:
1. `GET /transfers/recipient?q=` busca por correo (si contiene `@` y un dominio) o por alias. Devuelve
   `{ recipientId, displayName, maskedEmail }`, donde `recipientId` es el **id de la cuenta** del
   destinatario (se crea si no existe, como en la spec 002).
2. `POST /transfers` recibe ese `recipientId`. Así, si el alias cambia de dueño entre la vista previa
   y la confirmación, el dinero llega a la persona que se mostró.
3. El servidor valida que `recipientId` sea una cuenta de estudiante distinta de la propia.

**Privacidad**: `displayName` = primer nombre e iniciales del resto («Ana P. G.»). El correo
enmascarado usa la regla de la spec 001 («an***@ucc.edu.co»). Las búsquedas tienen su propio límite
de tasa (60 cada 15 min por IP) para dificultar el rastreo masivo de estudiantes.

**Alternatives considered**: enviar el alias en la confirmación (incumple FR-005); un token firmado
de vista previa (más complejo sin un beneficio real, porque transferir a cualquier estudiante ya
está permitido).

## R4. Reautenticación por encima del umbral, fuera de la transacción

**Decision**:
- Si `amount > TRANSFER_REAUTH_THRESHOLD`, `POST /transfers` exige `password` en el cuerpo:
  - sin contraseña → 422 `REAUTH_REQUIRED`, con `details.reauthThreshold`;
  - contraseña incorrecta → 422 `REAUTH_FAILED`.
- La verificación ocurre **antes** de abrir la transacción de la transferencia, con
  `auth.reauth.verify(userId, password, requestId)`. Así cada fallo queda registrado aunque la
  transferencia no siga.
- **Bloqueo**: `auth` reutiliza su tabla `login_attempts` con la clave de origen
  `sha256('reauth:' + userId)` y la regla de 5 fallos en 15 minutos, que da 15 minutos de bloqueo
  (429 `REAUTH_LOCKED` con `retryAfterSeconds`). Un acierto borra esos fallos.
- La contraseña **no** entra en el hash de idempotencia, nunca se guarda en la respuesta y no aparece
  en los logs: la redacción de `pino` ya cubre `password`.

**Rationale**: la constitución (Principio III) exige reautenticación al superar umbrales. Si se
verificara dentro de la transacción, el fallo se revertiría con ella y el bloqueo por intentos nunca
se acumularía.

**Alternatives considered**: un endpoint de reautenticación que emita un token temporal (otro flujo
y otro estado que guardar para el MVP).

## R5. Asientos con descripción propia y transferencias en el libro

**Decision**:
- Se agrega el tipo `transfer` a `ledger_transaction_type`.
- En `ledger_transactions` se agregan `counterparty_account_id` (cuenta del destinatario) y `note`
  (hasta 140 caracteres, nulo).
- En `ledger_entries` se agrega `description` (nula), la descripción **desde la cuenta de ese
  asiento**: «Transferencia a Ana P. G.» en el asiento del que envía y «Transferencia de Juan C.» en
  el del que recibe. El nombre parcial queda tal cual era al momento de la transferencia, como en un
  extracto bancario.
- `Movement.description` = la del asiento si existe, si no la de la operación (recargas).
  `Movement.note` = la nota de la operación.

**Rationale**: el módulo `ledger` no puede leer `users` (Principio VI), y cada participante ve un
texto distinto. Los asientos siguen siendo inmutables: la descripción se escribe al crearlos.

## R6. Bloqueo de dos cuentas en orden de `id` (sin *deadlocks*)

**Decision**: `accounts.lockManyForUpdate(tx, [emisor, destinatario])` ordena los ids de forma
ascendente y ejecuta `SELECT … FOR UPDATE` en ese orden (regla definida en la spec 002, research R4).
Si A le envía a B y B le envía a A al mismo tiempo, ambas transacciones bloquean primero la misma
cuenta y no se produce un *deadlock* (SC-005).

## R7. Flujo de `POST /transfers`

1. Validar el cuerpo y `Idempotency-Key`.
2. Si `amount > umbral`: `auth.reauth.verify`, fuera de la transacción (R4).
3. **Transacción**:
   1. cuenta propia (`ensureForUser`);
   2. verificar que `recipientId` sea una cuenta de estudiante distinta de la propia
      (`TRANSFER_TO_SELF` / `RECIPIENT_NOT_FOUND`);
   3. `lockManyForUpdate`;
   4. `idempotency.begin` (scope `transfers.create`; el hash cubre `{ recipientId, amount, note }`);
   5. rango → `TRANSFER_AMOUNT_OUT_OF_RANGE`;
   6. tope diario de lo **enviado** desde el inicio del día en Bogotá → `TRANSFER_DAILY_LIMIT`;
   7. saldo → `INSUFFICIENT_FUNDS` con `details.availableBalance`;
   8. `ledger.post` con −monto al emisor y +monto al destinatario, cada asiento con su descripción;
   9. auditoría `TRANSFER_COMPLETED`;
   10. `idempotency.complete`.

## R8. Cambios en contratos y esquemas existentes

**Decision**: la 003 modifica el contrato **congelado** de la 002: `Movement.type` agrega `transfer` y
`Movement` agrega `note` (`string | null`). Se hace en el PR de definición de la 003, que aprueban
ambos integrantes, como pide la constitución para cambiar un contrato congelado.

El backend de la 002 (`toMovement`) y el frontend de la 002 (`MovementItem`) se ajustan en sus tareas
de la 003.

## R9. Límites configurables

**Decision**: `TRANSFER_MIN_AMOUNT=1000`, `TRANSFER_MAX_AMOUNT=500000`,
`TRANSFER_DAILY_LIMIT=1000000` y `TRANSFER_REAUTH_THRESHOLD=200000`. Se validan con Zod:
`min ≤ umbral ≤ max ≤ tope`. `GET /transfers/limits` devuelve los cuatro valores y `remainingToday`.
