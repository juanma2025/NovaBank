# Research: Cuenta en COP, libro contable y recarga simulada

**Feature**: `002-cuentas-ledger` · **Date**: 2026-11-22 · **Plan**: [plan.md](plan.md)

Formato: decisión, justificación y alternativas. Se reutiliza todo lo de la spec 001: sesión
(`require-auth`), auditoría, formato de error, límites de tasa con store en PostgreSQL, bandeja de
correos y mantenimiento.

---

## R1. Tres módulos con fronteras claras (Principio VI)

**Decision**:

| Módulo | Dueño de | Expone a otros módulos |
| :--- | :--- | :--- |
| `accounts` | `accounts` | `ensureForUser(userId)`, `lockForUpdate(tx, accountId)`, `getSummary(userId)` |
| `ledger` | `ledger_transactions`, `ledger_entries` | `post(tx, { type, accountId, lines, requestId })`, `listMovements(accountId, cursor)` |
| `topups` | — (usa los servicios de los otros dos) | Endpoints de recarga y límites |

`topups` nunca toca tablas: orquesta `accounts` y `ledger` dentro de una sola transacción.

**Rationale**: así `ledger` queda listo para transferencias (003), tarjeta (004) y metas (005) sin
cambios, y cada módulo podría extraerse como servicio más adelante.

**Alternatives considered**: un único módulo «banca» (más rápido hoy, pero rompe el Principio VI
en cuanto llegue la 003).

## R2. Libro contable de doble entrada

**Decision**:
- Cada **operación** (`ledger_transactions`) tiene sus **asientos** (`ledger_entries`). Cada asiento
  tiene un monto con signo: positivo acredita la cuenta y negativo la debita.
- Garantías en la base de datos, no solo en el código:
  - un *constraint trigger* `DEFERRABLE INITIALLY DEFERRED` comprueba al confirmar la transacción
    que los asientos de cada operación suman cero;
  - los asientos son inmutables: triggers rechazan `UPDATE`, `DELETE` y `TRUNCATE`;
  - en `ledger_transactions` solo pueden cambiar `status` y `completed_at`, y un trigger valida la
    máquina de estados: `pending` → `completed` | `failed` | `reversed`.
- Una recarga se inserta como `pending`, se registran sus asientos y se pasa a `completed`, todo en
  la misma transacción. Así se respeta el ciclo de vida de la constitución y queda listo para
  operaciones asíncronas futuras.

**Rationale**: SC-003 («la suma del libro es cero») se convierte en una garantía de PostgreSQL, igual
que la inmutabilidad de la auditoría en la spec 001.

**Alternatives considered**: columnas `debit`/`credit` separadas (más filas vacías y más reglas);
validar la suma solo en el código (no protege de errores futuros).

## R3. Saldo materializado y cuenta del sistema sin cuello de botella

**Decision**:
- `accounts.balance` (`BIGINT`) se mantiene **solo en las cuentas de estudiantes**, actualizado en
  la misma transacción que los asientos, con `CHECK (balance >= 0)` para esas cuentas.
- La **cuenta del sistema** (`kind = 'system_topups'`, origen de las recargas) **no** mantiene saldo
  materializado ni se bloquea. Su saldo, siempre negativo, se calcula sumando sus asientos cuando
  hace falta (auditoría o pruebas).
- Solo se bloquea con `SELECT … FOR UPDATE` la fila de la cuenta del estudiante.

**Rationale**: si cada recarga bloqueara la fila de la cuenta del sistema, todas las recargas de
todos los estudiantes quedarían en fila de una en una. El riesgo se identificó al diseñar la spec
001.

**Alternatives considered**: varias cuentas del sistema repartidas (más complejo que no
materializar); saldo siempre calculado (lento para la pantalla de inicio a medida que crecen los
movimientos).

## R4. Concurrencia y orden de bloqueo

**Decision**: toda operación que mueva dinero bloquea las filas de cuentas de estudiantes
involucradas con `SELECT … FOR UPDATE`, **en orden ascendente de `id`**, antes de leer el saldo o
calcular límites. En la 002 solo hay una cuenta bloqueada por operación. La regla del orden queda
escrita para la 003, donde una transferencia bloqueará dos cuentas y el orden evita *deadlocks*.

El bloqueo de la cuenta también serializa la comprobación del **tope diario**: dos recargas
simultáneas del mismo estudiante no pueden pasar ambas el límite.

**Rationale**: lo exige la constitución (regla de dominio 3) y resuelve la carrera del tope diario
sin tablas adicionales.

## R5. Idempotencia (`Idempotency-Key`)

**Decision**: módulo transversal `backend/src/lib/idempotency`, igual que la auditoría, con la tabla
`idempotency_keys`:

1. `POST /topups` exige la cabecera `Idempotency-Key`: un UUID que el frontend genera por cada
   intento confirmado y reutiliza si reintenta. Si falta, 400 `VALIDATION_ERROR`.
2. Dentro de la transacción de la recarga: `INSERT … ON CONFLICT (user_id, scope, key) DO NOTHING
   RETURNING id`.
   - **Si inserta**: se hace la recarga y se guarda la respuesta (estado y cuerpo) en la misma fila
     antes de confirmar.
   - **Si no inserta**: la clave ya existe. Se compara el hash SHA-256 del cuerpo: si es igual, se
     devuelve la respuesta guardada; si es distinto, 409 `IDEMPOTENCY_KEY_REUSED`.
3. Si llega una solicitud con la misma clave mientras la primera sigue en curso, PostgreSQL la
   **hace esperar** en el índice único hasta que la primera confirma, y entonces devuelve la
   respuesta guardada. No hace falta un estado «en proceso».
4. Si la recarga falla por una regla de negocio (422), la transacción se revierte y la clave no
   queda guardada: un reintento se vuelve a evaluar.
5. Las claves vencen a las 24 h. La limpieza la registra `lib/idempotency` en el mantenimiento.

**Rationale**: cumple la regla de dominio 4 (misma clave y mismo cuerpo → mismo resultado; cuerpo
distinto → 409) y SC-004, y queda lista para transferencias y pagos.

**Alternatives considered**: guardar la clave fuera de la transacción de negocio (deja ventanas de
doble aplicación); exigir la clave en el cuerpo en vez de la cabecera (lo prohíbe la constitución).

## R6. Creación de la cuenta: perezosa e idempotente

**Decision**: `accounts.ensureForUser(userId)` crea la cuenta si no existe (`INSERT … ON CONFLICT
(user_id) DO NOTHING`) y la devuelve. La llaman `GET /accounts/me` y `POST /topups`.

Tras registrarse, la app lleva al estudiante a `/inicio`, que pide `GET /accounts/me`, así que la
cuenta existe desde el primer instante para un estudiante nuevo. Quienes se registraron antes la
obtienen al entrar por primera vez (FR-001).

**Rationale**: no hay que modificar el módulo `auth` (spec 001) ni acoplarlo a `accounts`, y la
creación es segura ante solicitudes simultáneas.

**Alternatives considered**: crear la cuenta en `auth` al registrarse (acopla módulos y no cubre a
los usuarios existentes); un script de migración de datos (no cubre a los que se registren
después).

## R7. Límites de recarga configurables

**Decision**:
- Variables de entorno validadas con Zod: `TOPUP_MIN_AMOUNT=1000`, `TOPUP_MAX_AMOUNT=500000` y
  `TOPUP_DAILY_LIMIT=2000000`.
- El esquema exige `min ≤ max ≤ tope diario`.
- `GET /topups/limits` devuelve los límites y lo que **le queda hoy** al estudiante, para que el
  frontend valide mientras se escribe y diga «puedes recargar hasta $X hoy».
- El día se calcula en `America/Bogota` con `Intl` de Node, sin librerías de fechas.
- Errores: 422 `TOPUP_AMOUNT_OUT_OF_RANGE` (con `details.minAmount` y `details.maxAmount`) y 422
  `TOPUP_DAILY_LIMIT` (con `details.remainingToday`).

**Rationale**: constitución, regla de dominio 6 (límites configurables; superarlos → 422 indicando
el límite) y FR-009 y FR-010.

## R8. Paginación estable del historial

**Decision**: paginación por **cursor**:
- `GET /accounts/me/movements?cursor=…&limit=20`, ordenada por `(created_at DESC, id DESC)`.
- El cursor es opaco: base64url del par del último elemento de la página.
- La consulta pide los elementos estrictamente «después» del cursor, así que una recarga nueva no
  desplaza ni duplica elementos (FR-020).
- Índice `ledger_entries (account_id, created_at DESC, id DESC)`.

**Alternatives considered**: `offset`/`page` (repite o salta elementos cuando entran movimientos
nuevos).

## R9. Utilidades de dinero en `@nova/shared`

**Decision**:

| Exportación | Qué hace |
| :--- | :--- |
| `MoneyAmountSchema` | Entero positivo seguro |
| `SignedMoneySchema` | Entero seguro, para montos con signo en los movimientos |
| `formatCOP(amount)` | `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })` |
| `parseCOPInput(text)` | Acepta «50000», «50.000» y «$50.000»; devuelve el entero o `null` si hay decimales, negativos o texto |
| `SUGGESTED_TOPUP_AMOUNTS` | `[20_000, 50_000, 100_000]` |
| `IDEMPOTENCY_HEADER` | `'Idempotency-Key'` |

En el backend, los repositorios convierten el `bigint` de Prisma a `number`, verificando
`Number.isSafeInteger` (Principio I, v2.1.0).

**Note**: la constitución ya preveía «utilidades puras de dinero» en `/shared`. Llegan ahora,
cuando una spec las necesita (Principio II).

## R10. Pruebas de contrato con varias specs

**Decision**: las dos pruebas de contrato pasan a leer **todos** los archivos
`specs/*/contracts/*.json`:
- la de `shared` comprueba que `ERROR_CODES` contiene exactamente la unión de los `ErrorCode` de
  todos los contratos;
- la del backend compara cada operación generada con la del contrato que la define, y exige que
  estén todas las operaciones de todos los contratos.

**Rationale**: hoy ambas comparan solo contra el contrato de la 001 y fallarían al agregar los
endpoints de la 002. El cambio es parte de la definición de la 002, que aprueban ambos integrantes,
así que respeta la regla de contrato congelado. El contrato de la 001 no cambia.

## R11. Preferencia de saldo oculto

**Decision**: el frontend guarda la preferencia de ocultar el saldo en `localStorage` con la clave
`nova:hide-balance`, envuelto en `try/catch`. Si no está disponible, el saldo se muestra.

**Rationale**: FR-016 pide recordarla «en ese dispositivo». La constitución prohíbe `localStorage`
solo para tokens de autenticación. No es un dato sensible ni necesita viajar al servidor.

**Alternatives considered**: guardarla en el perfil del usuario (aplicaría a todos los
dispositivos, contra lo que pide la spec).
