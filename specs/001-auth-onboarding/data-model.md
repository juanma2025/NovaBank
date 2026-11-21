# Data Model: Registro e inicio de sesión de estudiantes

**Feature**: `001-auth-onboarding` · **Date**: 2026-11-20 · **Plan**: [plan.md](plan.md)

## Convenciones generales

- Tablas y columnas en `snake_case`.
- Claves primarias UUID v4 (`gen_random_uuid()`).
- Fechas en `timestamptz`, siempre en UTC.
- Los correos se guardan **normalizados**: sin espacios al inicio o al final y en minúsculas.
- Ningún secreto se guarda en claro:
  - contraseñas con Argon2id;
  - códigos con HMAC-SHA256;
  - tokens de sesión y de flujo con SHA-256.
- Los códigos de verificación se generan en el momento de enviar el correo y nunca se guardan en
  la bandeja de salida (research R6).

**Dueño de las tablas**: módulo `auth`, salvo `audit_events` y `email_outbox` (`backend/src/lib`)
y `rate_limit_hits` (`backend/src/middleware`).

Los dominios institucionales permitidos **no** son una tabla: se leen de la variable de entorno
`STUDENT_EMAIL_DOMAINS` (Principio III).

```text
users 1 ──── 1 data_consents
users 1 ──── * sessions
verification_flows * ── (email) ── 0..1 users
code_sends, login_attempts ── (email)  [sin FK: existen aunque el correo no tenga cuenta]
audit_events * ──── 0..1 users
```

---

## User (`users`) — spec: «Estudiante»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `email` | varchar(254) | NOT NULL, UNIQUE, normalizado; dominio en la lista permitida al crearse (FR-001, FR-009) |
| `full_name` | varchar(100) | NOT NULL; 2–100 caracteres; letras Unicode, espacios, `-` y `'` (FR-012) |
| `password_hash` | text | NOT NULL; Argon2id |
| `password_changed_at` | timestamptz | NOT NULL; se actualiza al recuperar la contraseña |
| `created_at` | timestamptz | NOT NULL, default `now()` |
| `updated_at` | timestamptz | NOT NULL |

**Validación** (antes de crear):
- La contraseña cumple FR-010: 10–128 caracteres, no contiene el correo ni su parte local y no
  está en la lista de contraseñas comunes.
- El nombre cumple FR-012.

## DataConsent (`data_consents`) — spec: «Consentimiento de datos»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `user_id` | uuid | NOT NULL, UNIQUE, FK → `users.id` |
| `policy_version` | varchar(20) | NOT NULL; ej. `2026-11-20` |
| `accepted_at` | timestamptz | NOT NULL; momento en que se aceptó en el paso 1 (FR-002) |

Se crea en la misma transacción que el usuario, copiando la versión y la fecha guardadas en el
flujo de registro.

## VerificationFlow (`verification_flows`) — spec: «Verificación por código»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `purpose` | enum `verification_purpose` (`registration`, `password_reset`) | NOT NULL |
| `email` | varchar(254) | NOT NULL, normalizado |
| `flow_token_hash` | char(64) | NOT NULL, UNIQUE; SHA-256 del token de la cookie `nova_vf` |
| `status` | enum `verification_status` (`awaiting_code`, `verified`, `completed`, `superseded`, `expired`) | NOT NULL |
| `code_hash` | char(64) | NULL hasta que el worker envía el código; siempre NULL en flujos señuelo (correo ya registrado o sin cuenta, R5) |
| `code_expires_at` | timestamptz | NOT NULL; al solicitar el código, provisional `now + 15 min`; el worker lo fija en `envío + 15 min` (FR-003, R6) |
| `code_attempts` | smallint | NOT NULL, default 0, 0–5 (FR-004) |
| `last_code_sent_at` | timestamptz | NOT NULL; momento de la última solicitud de código; para la espera de 60 s (FR-005) |
| `verified_at` | timestamptz | NULL hasta verificar |
| `complete_by` | timestamptz | NULL hasta verificar; `verified_at` + 30 min (FR-007, FR-020b) |
| `consent_policy_version` | varchar(20) | NOT NULL si `purpose = registration`; NULL si no |
| `consent_accepted_at` | timestamptz | NOT NULL si `purpose = registration`; NULL si no |
| `created_at` | timestamptz | NOT NULL |
| `expires_at` | timestamptz | NOT NULL; vida del flujo, **variable**: igual a `code_expires_at` mientras `status = awaiting_code` (se actualiza al reenviar y al enviar) e igual a `complete_by` al verificar. La cookie `nova_vf` tiene un tope fijo de 2 h (research R4) |

**Índices**:
- `(email, purpose, status)`, para reemplazar los flujos anteriores;
- `(expires_at)`, para la limpieza.

**Máquina de estados**:

```text
              verificar código correcto            completar (nombre+contraseña | contraseña nueva)
awaiting_code ─────────────────────────► verified ──────────────────────────────► completed
     │  ▲                                    │
     │  └── reenviar (nuevo code_hash,       │
     │       code_attempts = 0)              │
     ├── nuevo flujo mismo email+purpose ──► superseded   (también desde verified)
     └── expires_at / complete_by vencido ─► expired      (también desde verified)
```

**Reglas**:
- **Verificar**:
  - solo en `awaiting_code`, con `now < code_expires_at` y `code_attempts < 5`;
  - un código incorrecto incrementa `code_attempts`;
  - al llegar a 5 intentos, el código queda inutilizable hasta reenviar (`CODE_ATTEMPTS_EXHAUSTED`).
- **Reenviar**: solo en `awaiting_code`, con `now ≥ last_code_sent_at + 60 s` y menos de 5 filas
  en `code_sends` para el `email` en la última hora (registro y recuperación suman juntos,
  FR-005). Invalida el código anterior (`code_hash = NULL`) hasta que el worker envíe el nuevo.
- **Vigencia**: un flujo con `now ≥ expires_at` se trata como `expired` en cualquier operación.
- **Completar**: solo en `verified` y con `now < complete_by`.
- **Estados finales**: `completed`, `superseded` y `expired`. Las transiciones se ejecutan en una
  transacción con `SELECT … FOR UPDATE` sobre el flujo.

## CodeSend (`code_sends`)

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `email` | varchar(254) | NOT NULL, normalizado |
| `purpose` | `verification_purpose` | NOT NULL |
| `created_at` | timestamptz | NOT NULL |

**Índice**: `(email, created_at)`.

Se registra un envío por cada código **solicitado**, incluidos los flujos señuelo, para que el
límite se comporte igual exista o no la cuenta. Sirve para el límite de 5 envíos por correo y por
hora, sumando todos los propósitos (FR-005). `purpose` se guarda solo con fines de auditoría.

## Session (`sessions`) — spec: «Sesión»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK; va en el claim `sid` del JWT |
| `user_id` | uuid | NOT NULL, FK → `users.id` |
| `refresh_token_hash` | char(64) | NOT NULL, UNIQUE |
| `previous_refresh_token_hash` | char(64) | NULL; para detectar reuso (R2) |
| `rotated_at` | timestamptz | NULL |
| `created_at` | timestamptz | NOT NULL |
| `last_activity_at` | timestamptz | NOT NULL |
| `absolute_expires_at` | timestamptz | NOT NULL; `created_at` + 12 h (FR-016) |
| `revoked_at` | timestamptz | NULL mientras está activa |
| `revoke_reason` | enum `session_end_reason` (`logout`, `idle`, `absolute`, `password_reset`, `reuse_detected`) | NULL mientras está activa |

**Índices**:
- `(user_id) WHERE revoked_at IS NULL`, para revocar todas las sesiones al recuperar la
  contraseña;
- `(previous_refresh_token_hash)`, para detectar el reuso del refresh token (R2).

**Regla de vigencia** (se evalúa en cada solicitud): una sesión es válida si se cumplen las tres
condiciones:
- `revoked_at IS NULL`;
- `now − last_activity_at ≤ 15 min`;
- `now < absolute_expires_at`.

Si no es válida y aún no estaba revocada, se marca `revoked_at` con `idle` o `absolute` y se
audita `SESSION_ENDED`.

## LoginAttempt (`login_attempts`)

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `email` | varchar(254) | NOT NULL, normalizado; puede no tener cuenta |
| `origin_key` | char(64) | NOT NULL; SHA-256 del id de dispositivo o, si no hay cookie, de la IP (R7) |
| `created_at` | timestamptz | NOT NULL |

**Índices**: `(email, origin_key, created_at)` y `(email, created_at)`.

**Reglas (FR-015)**: solo se insertan intentos **fallidos**. Los intentos rechazados por un
bloqueo activo no se insertan.
- **Bloqueo por origen**: se toman los 5 fallos más recientes de `(email, origin_key)`. Si son 5 y
  el más antiguo ocurrió a 15 min o menos del más reciente, el bloqueo dura hasta el más
  reciente + 15 min.
- **Bloqueo global**: se toman los 20 fallos más recientes del `email`. Si son 20 y el más antiguo
  ocurrió a 60 min o menos del más reciente, el bloqueo dura hasta el más reciente + 15 min.
- **Inicio de sesión exitoso**: se borran las filas de ese `(email, origin_key)`.
- **Al recuperar la contraseña**: se borran todas las filas de ese correo (FR-020c).

## AuditEvent (`audit_events`) — spec: «Evento de auditoría»

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `type` | enum `audit_event_type` | NOT NULL; valores abajo |
| `user_id` | uuid | NULL si no hay usuario; FK → `users.id` |
| `email_hash` | char(64) | NULL; SHA-256 del correo normalizado, para eventos sin usuario sin guardar el correo en claro |
| `request_id` | uuid | NOT NULL |
| `metadata` | jsonb | NOT NULL, default `{}`; nunca contraseñas, códigos ni tokens |
| `created_at` | timestamptz | NOT NULL |

**Inmutable**: triggers rechazan `UPDATE`, `DELETE` (por fila) y `TRUNCATE` (por sentencia)
(R13). Las pruebas no vacían esta tabla: reinician la base de prueba completa.

**Valores de `audit_event_type`** (FR-021):

| Valor | Momento |
| :--- | :--- |
| `REGISTRATION_STARTED` | Paso 1 del registro |
| `EMAIL_VERIFIED` | Código correcto (registro o recuperación) |
| `ACCOUNT_CREATED` | Paso 3 del registro |
| `LOGIN_SUCCEEDED` / `LOGIN_FAILED` | Inicio de sesión |
| `LOGIN_LOCKED` | Al activarse un bloqueo |
| `SESSION_ENDED` | `metadata.reason`: `logout`, `idle`, `absolute`, `password_reset` o `reuse_detected` |
| `PASSWORD_RESET_REQUESTED` | Paso 1 de la recuperación |
| `PASSWORD_RESET_COMPLETED` | Contraseña cambiada por recuperación |

## EmailOutbox (`email_outbox`)

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `to_email` | varchar(254) | NOT NULL |
| `template` | enum `email_template` (`verification_code`, `already_registered`, `password_reset_code`, `password_changed`) | NOT NULL |
| `verification_flow_id` | uuid | NULL; referencia lógica (sin FK) al flujo, obligatoria para `verification_code` y `password_reset_code` |
| `payload` | jsonb | NOT NULL, default `{}`; datos no secretos de la plantilla. Nunca contiene códigos, contraseñas ni tokens |
| `status` | enum `outbox_status` (`pending`, `sent`, `failed`) | NOT NULL |
| `attempts` | smallint | NOT NULL, default 0, máximo 5 |
| `next_attempt_at` | timestamptz | NOT NULL |
| `last_error` | varchar(500) | NULL; mensaje técnico sin datos personales |
| `created_at` | timestamptz | NOT NULL |
| `sent_at` | timestamptz | NULL |

**Índice**: `(status, next_attempt_at)`.

**Preparación**: antes de enviar, el worker llama al preparador que el módulo dueño registró
para la plantilla. Para las plantillas de código, `auth` genera el código en ese momento y
guarda solo su hash en `VerificationFlow.code_hash` (research R6).

**Transiciones**:
- `pending` → `sent` cuando el envío funciona.
- `pending` → `sent` sin enviar, si el preparador descarta el correo (el flujo ya no espera
  código).
- `pending` → `pending` cuando falla y quedan intentos: `attempts + 1` y `next_attempt_at` con
  espera exponencial.
- `pending` → `failed` cuando se llega a 5 intentos.

## RateLimitHit (`rate_limit_hits`)

| Campo | Tipo | Restricciones |
| :--- | :--- | :--- |
| `key` | varchar(200) | PK; ej. `login:ip:<hash>` |
| `hits` | integer | NOT NULL |
| `reset_at` | timestamptz | NOT NULL |

Store compartido de `express-rate-limit` (R8).
