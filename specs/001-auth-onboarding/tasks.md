---
description: "Task list for 001-auth-onboarding"
---

# Tasks: Registro e inicio de sesión de estudiantes

**Input**: Design documents from `/specs/001-auth-onboarding/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/auth.openapi.json](contracts/auth.openapi.json),
[quickstart.md](quickstart.md)

**Tests**: Incluidas. La constitución exige al menos una prueba automatizada por regla de
dominio y E2E con Playwright del flujo de registro y verificación.

**Organization**: Tareas agrupadas por historia de usuario. Dentro de cada fase se agrupan por
capa.

## Format: `[ID] [P?] [Story?] [Capa] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes).
- **[Story]**: historia de usuario (US1–US4). No se usa en Setup, Foundational ni Polish.
- **[Capa]** (constitución v2.3.0), exactamente una por tarea:

  | Etiqueta | Alcance | Rama |
  | :--- | :--- | :--- |
  | `[SH]` | `/shared` y configuración raíz compartida | `001-auth-onboarding` |
  | `[BE]` | `/backend`, `/db` y Docker Compose | `001-auth-onboarding-be` |
  | `[FE]` | `/frontend` | `001-auth-onboarding-fe` |
  | `[E2E]` | `/e2e` | `001-auth-onboarding-fe` |

- **Cómo implementar cada capa**:
  - Backend: `/speckit-implement Implementa solo las tareas etiquetadas [BE], historia por historia.`
  - Frontend: lo mismo con `[FE]`, y después con `[E2E]`.

## Path Conventions

Monorepo con npm workspaces: `shared/`, `db/`, `backend/`, `frontend/` y `e2e/`, más la
configuración en la raíz. Ver «Project Structure» en [plan.md](plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: inicializar el monorepo y cada workspace.

### [SH] Configuración raíz y paquete compartido

- [X] T001 [SH] Crear `package.json` raíz con `"private": true`, `engines.node >=24` y workspaces `shared`, `db`, `backend`, `frontend`, `e2e`.
  - Scripts compatibles con Windows (solo `npm run <x> -w <ws>`, sin comandos de bash): `dev:backend`, `dev:frontend`, `db:generate`, `db:migrate`, `lint`, `typecheck`, `test`, `test:e2e`, `build` (orden `shared` → `db` → `backend` → `frontend`).
  - Usar `--workspaces --if-present` para que los scripts funcionen aunque una capa aún no exista.
  - Si npm exige que existan las carpetas, crear en cada workspace un `package.json` mínimo (solo `name`, `private`, `version`), sin otro contenido; cada capa lo completa en su rama.
- [X] T002 [P] [SH] Crear `tsconfig.base.json`:
  - `strict: true`, `noUncheckedIndexedAccess` y `customConditions: ["development"]`, con `module`/`moduleResolution` compatibles con la condición `development` (research R11);
  - referencias de proyecto para `tsc -b`.
  - Fijar en el `package.json` raíz una versión de `typescript` compatible con `typescript-eslint` y anotarla en «Technical Context» de [plan.md](plan.md).
- [X] T003 [P] [SH] Crear `eslint.config.js` (flat config):
  - `typescript-eslint` estricto con `no-explicit-any` como error;
  - `eslint-plugin-react-hooks` solo para `frontend/**`;
  - integración con Prettier.

  Crear también `.prettierrc` y `.prettierignore`, y agregar las devDependencies a la raíz.
- [X] T004 [P] [SH] Crear `.env.example` con todas las variables de la tabla «Variables de entorno» de [plan.md](plan.md):
  - valores de desarrollo no secretos (`APP_ORIGIN=http://localhost:5173`, `STUDENT_EMAIL_DOMAINS=ucc.edu.co`, SMTP → Mailpit en `localhost:1025`);
  - un comentario por variable con el comando para generar secretos (ver [quickstart.md](quickstart.md));
  - `SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE` y `SESSION_IDLE_WARNING_SECONDS_OVERRIDE`, comentadas y marcadas como «solo desarrollo y E2E».
- [X] T005 [P] [SH] Crear `.github/workflows/ci.yml` con los trabajos `quality` y `e2e` según research R15:
  - servicios `postgres:17` y `axllent/mailpit`;
  - un paso que crea las bases `nova_test` y `nova_e2e` con `psql`/`createdb` (el servicio de CI no ejecuta `docker/postgres/init.sql`) y aplica `prisma migrate deploy` a cada una;
  - `npm ci`, `npm run db:generate`, `lint`, `typecheck`, `test`, `build`;
  - E2E con Playwright;
  - todos los pasos con `--if-present` mientras las capas se completan.
- [X] T006 [SH] Crear el paquete `shared/`:
  - `shared/package.json` (`@nova/shared`, `exports` con las condiciones `types` / `development` / `default` según research R11, scripts `build`, `test`, `typecheck`, dependencia `zod@4`);
  - `shared/tsconfig.json`, `shared/vitest.config.ts` y `shared/src/index.ts`, vacío por ahora.

### [BE] Infraestructura del backend

- [X] T007 [P] [BE] Crear `docker-compose.yml` con `postgres:17` (usuario y base `nova`, puerto 5433 del host para no chocar con un PostgreSQL instalado en Windows, volumen persistente) y `axllent/mailpit` (1025 SMTP, 8025 web), y `docker/postgres/init.sql`, que crea las bases `nova_test` y `nova_e2e` (research R15).
- [X] T008 [P] [BE] Crear el workspace `db/`:
  - `db/package.json` (`@nova/db`, dependencias `prisma@7`, `@prisma/client`, `@prisma/adapter-pg`, `pg`; scripts `generate`, `migrate` (`prisma migrate dev`) y `deploy` (`prisma migrate deploy`), que la raíz invoca con `db:generate`, `db:migrate` y `db:deploy`);
  - `db/prisma.config.ts`, `db/tsconfig.json` y `db/src/index.ts`, que exporta una fábrica del cliente Prisma con el adaptador pg y `DATABASE_URL` (research R13).
  - Verificar la configuración exacta de Prisma 7 en su documentación vigente.
- [X] T009 [P] [BE] Crear el workspace `backend/`:
  - `backend/package.json` (dependencias del plan; script `dev` = `tsx watch --conditions=development src/server.ts`; `build` con `tsc -b`; `start` = `node dist/server.js`);
  - `backend/tsconfig.json` y un `tsconfig` de build con `customConditions: []`, para compilar contra `@nova/shared/dist` (research R11);
  - `backend/vitest.config.ts`, con variables de prueba en `test.env`: `DATABASE_URL` a `nova_test`, `STUDENT_EMAIL_DOMAINS=nova-test.edu.co`, secretos ficticios y `NODE_ENV=test`.

### [FE] Migración de la plantilla existente

- [ ] T010 [P] [FE] Migrar `Nova_Front/` (plantilla por defecto de Vite subida a `main`) al workspace `frontend/`:
  - **Package**: crear `frontend/package.json` (`@nova/frontend`, dependencias del plan: React 19, React Router 7, TanStack Query 5, `lucide-react`, `@nova/shared`; devDependencies `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss@4`, Vitest, Testing Library, `jsdom`).
  - **Archivos a mover**: `index.html`, `src/main.tsx`, `vite.config.ts` y los `tsconfig*.json`, ajustados para extender `tsconfig.base.json`.
  - **Vite**: proxy `/api` → `http://localhost:3000` y plugin `@tailwindcss/vite`.
  - **Eliminar**: `Nova_Front/.oxlintrc.json`, `oxlint`, `Nova_Front/package-lock.json` (rige el lockfile único de la raíz), los recursos de la plantilla (`App.tsx`, `App.css`, `assets/hero.png`, `assets/react.svg`, `assets/vite.svg`, `public/icons.svg`) y la carpeta `Nova_Front/` completa.

### [E2E] Workspace de pruebas extremo a extremo

- [ ] T011 [P] [E2E] Crear el workspace `e2e/`:
  - `e2e/package.json` (`@playwright/test`; el script se llama `e2e`, no `test`, para que `npm test` no ejecute Playwright; la raíz lo invoca con `npm run test:e2e`);
  - `e2e/playwright.config.ts`: Chromium, más un proyecto móvil a 360 px. `webServer` arranca el backend compilado con `SERVE_FRONTEND=true` en `http://localhost:3000` (un solo origen, research R14), con `DATABASE_URL` a `nova_e2e` (migraciones aplicadas antes de arrancar), `STUDENT_EMAIL_DOMAINS=nova-test.edu.co`, `SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE=20` y `SESSION_IDLE_WARNING_SECONDS_OVERRIDE=8`.

**Checkpoint**: `npm install` funciona en la raíz y los workspaces existen.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: contrato en código, infraestructura del backend, sesión base y armazón del frontend.

**⚠️ CRITICAL**: ninguna historia de usuario puede empezar antes de terminar esta fase.

### [SH] Contrato en código (`@nova/shared`) — se integra con la rama de definición

- [X] T012 [P] [SH] Crear `shared/src/constants.ts` con:

  | Constante | Valor |
  | :--- | :--- |
  | `PRIVACY_POLICY_VERSION` | `'2026-11-20'` |
  | `CODE_LENGTH` | 6 |
  | `SESSION_IDLE_TIMEOUT_SECONDS` | 900 |
  | `SESSION_IDLE_WARNING_SECONDS` | 60 |
  | `PASSWORD_MIN_LENGTH` | 10 |
  | `PASSWORD_MAX_LENGTH` | 128 |
  | `FULL_NAME_MIN_LENGTH` | 2 |
  | `FULL_NAME_MAX_LENGTH` | 100 |
  | `EMAIL_MAX_LENGTH` | 254 |

- [X] T013 [P] [SH] Crear `shared/src/errors.ts` con `ErrorCodeSchema` (los 21 códigos de `components.schemas.ErrorCode` en [contracts/auth.openapi.json](contracts/auth.openapi.json)), `ErrorDetailsSchema` y `ErrorResponseSchema` (`ErrorResponse` del contrato, constitución v2.3.0).
- [X] T014 [P] [SH] Crear `shared/src/email.ts`:
  - `normalizeEmail()` (trim y minúsculas);
  - `InstitutionalEmailSchema` (formato y longitud según data-model.md `User.email`; aplica `normalizeEmail` antes de validar).
- [X] T015 [P] [SH] Crear `shared/src/password.ts`:
  - `PasswordSchema` (longitud según la sección «Validación» de `User` en data-model.md y FR-010);
  - `validatePasswordRules(password, email)` → `('too_short' | 'too_long' | 'contains_email')[]`, que también detecta la parte local del correo (FR-010, research R10).
- [X] T016 [SH] Crear `shared/src/auth.schemas.ts` con los esquemas de la tabla «Paquete `@nova/shared`» de [plan.md](plan.md), cada uno igual a su `components.schemas` del contrato:
  - `FullNameSchema` (data-model.md `User.full_name`) y `VerificationCodeSchema`;
  - requests: `StartRegistrationRequestSchema`, `StartPasswordResetRequestSchema`, `VerifyCodeRequestSchema`, `CompleteRegistrationRequestSchema`, `CompletePasswordResetRequestSchema`, `LoginRequestSchema`;
  - responses: `VerificationStateSchema`, `UserSchema`, `SessionInfoSchema`, `SessionResponseSchema`.

  Exportar los tipos con `z.infer` y reexportar todo en `shared/src/index.ts`.
- [X] T017 [P] [SH] Pruebas en `shared/src/email.test.ts`, `shared/src/password.test.ts` y `shared/src/auth.schemas.test.ts`:
  - el mismo correo con mayúsculas y espacios es equivalente;
  - nombres con tildes, ñ, guion y apóstrofo son válidos, y con números no;
  - el código acepta exactamente 6 dígitos;
  - las tres reglas de contraseña;
  - los ejemplos del contrato son válidos.

**Checkpoint de definición**: PR de `001-auth-onboarding` → `main`. Al integrarlo, el contrato
queda congelado y empiezan las ramas `-be` y `-fe`.

### [BE] Infraestructura del backend

- [X] T018 [BE] Crear `db/prisma/schema.prisma` con los enums (`verification_purpose`, `verification_status`, `session_end_reason`, `audit_event_type`, `email_template`, `outbox_status`), los 9 modelos con nombres de tabla y columna en `snake_case`, y los índices del modelo (incluido `Session.previous_refresh_token_hash`). Campos según data-model.md:
  - `User.id`, `User.email`, `User.full_name`, `User.password_hash`, `User.password_changed_at`, `User.created_at`, `User.updated_at`;
  - `DataConsent.user_id`, `DataConsent.policy_version`, `DataConsent.accepted_at`;
  - `VerificationFlow.purpose`, `VerificationFlow.email`, `VerificationFlow.flow_token_hash`, `VerificationFlow.status`, `VerificationFlow.code_hash`, `VerificationFlow.code_expires_at`, `VerificationFlow.code_attempts`, `VerificationFlow.last_code_sent_at`, `VerificationFlow.verified_at`, `VerificationFlow.complete_by`, `VerificationFlow.consent_policy_version`, `VerificationFlow.consent_accepted_at`, `VerificationFlow.created_at`, `VerificationFlow.expires_at`;
  - `CodeSend.email`, `CodeSend.purpose`, `CodeSend.created_at`;
  - `Session.user_id`, `Session.refresh_token_hash`, `Session.previous_refresh_token_hash`, `Session.rotated_at`, `Session.created_at`, `Session.last_activity_at`, `Session.absolute_expires_at`, `Session.revoked_at`, `Session.revoke_reason`;
  - `LoginAttempt.email`, `LoginAttempt.origin_key`, `LoginAttempt.created_at`;
  - `AuditEvent.type`, `AuditEvent.user_id`, `AuditEvent.email_hash`, `AuditEvent.request_id`, `AuditEvent.metadata`, `AuditEvent.created_at`;
  - `EmailOutbox.to_email`, `EmailOutbox.template`, `EmailOutbox.verification_flow_id`, `EmailOutbox.payload`, `EmailOutbox.status`, `EmailOutbox.attempts`, `EmailOutbox.next_attempt_at`, `EmailOutbox.last_error`, `EmailOutbox.created_at`, `EmailOutbox.sent_at`;
  - `RateLimitHit.key`, `RateLimitHit.hits`, `RateLimitHit.reset_at`.
- [X] T019 [BE] Generar la migración inicial en `db/prisma/migrations/<timestamp>_init/migration.sql` y agregarle a mano el SQL que Prisma no genera:
  - los triggers que rechazan `UPDATE`/`DELETE` (por fila) y `TRUNCATE` (por sentencia) sobre `audit_events` (data-model.md `AuditEvent`, research R13);
  - el índice parcial `sessions(user_id) WHERE revoked_at IS NULL` (data-model.md `Session.revoked_at`);
  - los `CHECK` de rangos: data-model.md `VerificationFlow.code_attempts` y `EmailOutbox.attempts`;
  - los `CHECK` de consentimiento obligatorio si el propósito es `registration`: data-model.md `VerificationFlow.consent_policy_version` y `VerificationFlow.consent_accepted_at`.
- [X] T020 [P] [BE] Crear `backend/src/config/env.ts`:
  - esquema Zod de todas las variables del plan;
  - `STUDENT_EMAIL_DOMAINS` se convierte en una lista en minúsculas;
  - `SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE` y `SESSION_IDLE_WARNING_SECONDS_OVERRIDE` se rechazan si `NODE_ENV=production`, y el aviso debe ser menor que la inactividad;
  - si la validación falla, el proceso termina con un mensaje claro.
- [X] T021 [P] [BE] Crear `backend/src/lib/logger.ts` con `pino`. Redacción de `password`, `code`, `*.password`, `*.code`, `*.token`, `req.headers.cookie`, `req.headers.authorization` y `res.headers["set-cookie"]` (FR-022).
- [X] T022 [P] [BE] Crear `backend/src/lib/errors.ts` (`AppError(code, status, details?)` con fábricas por código del contrato) y `backend/src/lib/clock.ts` (reloj inyectable para las pruebas).
- [X] T023 [P] [BE] Crear `backend/src/lib/crypto.ts`:
  - `randomToken()` de 32 bytes en base64url, `sha256Hex()`, `hmacSha256Hex()`, `safeEqualHex()` con `timingSafeEqual` y `randomCode()` de 6 dígitos con `crypto.randomInt`, todo con `node:crypto` (research R9).
- [X] T024 [BE] Crear `backend/src/middleware/request-id.ts` (UUID v4 por solicitud, en la cabecera `X-Request-Id`) y `backend/src/middleware/error-handler.ts`:
  - `AppError` → su estado y `ErrorResponse`;
  - `ZodError` → 400 `VALIDATION_ERROR` con `details.fields`;
  - cualquier otro error → 500 `INTERNAL_ERROR` opaco, con el detalle en `pino`;
  - siempre con `requestId`.
- [X] T025 [P] [BE] Crear `backend/src/middleware/require-json.ts`: en `POST`/`PUT`/`PATCH`/`DELETE`, un cuerpo no vacío debe ser `application/json`; si no, 400 `VALIDATION_ERROR`. **Ajuste al implementar**: se quitó la comparación de `Origin` con respuesta 403, porque el contrato congelado no tiene un código de error para 403. La protección contra CSRF la dan las cookies `SameSite=Strict` y el preflight CORS que exige el `Content-Type` JSON.
- [X] T026 [BE] Crear `backend/src/middleware/rate-limit/pg-store.ts`, que implementa la interfaz `Store` de `express-rate-limit`:
  - `increment` con `$executeRaw` y `INSERT … ON CONFLICT DO UPDATE` que reinicia según data-model.md `RateLimitHit.reset_at`, sobre `RateLimitHit.key` y `RateLimitHit.hits` (research R8);
  - `decrement` y `resetKey`;
  - `cleanupExpired()`, registrada con `registerCleanup`, que borra los contadores vencidos.

  Crear también `backend/src/middleware/rate-limit/limiters.ts` con los límites por IP de research R7 y la respuesta `RATE_LIMITED` con `Retry-After`.
- [X] T027 [P] [BE] Crear `backend/src/lib/audit/audit.repository.ts` (solo `insert`) y `backend/src/lib/audit/audit.service.ts`:
  - `record(type, { userId?, email?, requestId, metadata })`;
  - guarda data-model.md `AuditEvent.email_hash` como SHA-256 del correo normalizado;
  - valida que data-model.md `AuditEvent.metadata` no tenga claves `password`, `code` ni `token`.
- [X] T028 [BE] Crear la bandeja de salida de correos (research R6):
  - `backend/src/lib/mail/mail-provider.ts`: interfaz `MailProvider`;
  - `backend/src/lib/mail/smtp-provider.ts`: `nodemailer`;
  - `backend/src/lib/mail/outbox.repository.ts`: `enqueue(template, to, { flowId?, payload }, tx)` sobre data-model.md `EmailOutbox.verification_flow_id` y `EmailOutbox.payload`, rechazando claves `code`, `password` o `token` en el payload;
  - `backend/src/lib/mail/outbox-worker.ts`:
    - `registerPreparer(template, fn)`: cada módulo registra cómo preparar el contenido de su plantilla al enviar (research R6);
    - lote cada 2 s con `SELECT … FOR UPDATE SKIP LOCKED` (`$queryRaw`) sobre data-model.md `EmailOutbox.status` y `EmailOutbox.next_attempt_at`;
    - por cada fila, una transacción: prepara, envía y confirma; si el preparador descarta el correo, se marca `discarded` sin enviar; si el envío falla, se revierte;
    - espera exponencial en data-model.md `EmailOutbox.attempts` (10 s, 30 s, 1 min, 2 min, 5 min; luego `failed`);
    - al enviar, `sent_at`;
    - data-model.md `EmailOutbox.last_error` sin datos personales;
    - `discardPendingCodeEmails(flowId, tx)`: pasa a `discarded` los correos de código pendientes del flujo (data-model.md `EmailOutbox.verification_flow_id`, `EmailOutbox.status`);
    - una limpieza propia registrada con `registerCleanup`, que borra solo filas de `email_outbox` `sent`, `failed` y `discarded` de más de 7 días;
    - `start()`/`stop()`.
- [X] T029 [P] [BE] Crear las 4 plantillas en español (asunto, texto y HTML simple con la marca Nova) en `backend/src/lib/mail/templates/`: `verification-code.ts`, `already-registered.ts`, `password-reset-code.ts` y `password-changed.ts` (data-model.md `EmailOutbox.template`). **Ajuste al implementar**: quedaron en `templates/index.ts` (las 4 plantillas) y `templates/layout.ts` (HTML común), en vez de un archivo por plantilla.
- [X] T030 [BE] Crear la sesión base del módulo `auth` (research R1):
  - `backend/src/modules/auth/auth.cookies.ts`: nombres y opciones de `nova_at`, `nova_rt` y `nova_vf` según la descripción del contrato;
  - `backend/src/modules/auth/repositories/user.repository.ts`: búsqueda por correo normalizado y por id;
  - `backend/src/modules/auth/repositories/session.repository.ts`;
  - `backend/src/modules/auth/session.service.ts`:
    - `create(userId)` firma un JWT HS256 de 15 min con `sub`/`sid` y genera el refresh token; data-model.md `Session.refresh_token_hash` y `Session.absolute_expires_at`;
    - `validate(sid)` aplica la regla de vigencia de data-model.md `Session` sobre `Session.last_activity_at`, `Session.absolute_expires_at` y `Session.revoked_at`. Al vencer, marca `Session.revoke_reason` (`idle` o `absolute`) y audita `SESSION_ENDED`;
    - `touch()` actualiza `last_activity_at` como máximo cada 30 s;
    - `revokeAllForUser(userId, reason)`;
    - los tiempos de inactividad y de aviso salen de la configuración (overrides o 900 y 60) y se devuelven en `SessionInfo`.
- [X] T031 [BE] Crear `backend/src/middleware/require-auth.ts`:
  - verifica `nova_at`, llama a `sessionService.validate` y adjunta `req.auth = { userId, sessionId }`;
  - errores: `UNAUTHENTICATED`, `ACCESS_TOKEN_EXPIRED` o `SESSION_EXPIRED` con `details.reason`.
- [X] T032 [BE] Crear `backend/src/modules/auth/auth.routes.ts` y `backend/src/modules/auth/auth.controller.ts` con `GET /api/v1/auth/session` protegido por `require-auth`; responde `SessionResponseSchema` (operación `getSession` del contrato).
- [X] T033 [BE] Crear la aplicación y su arranque:
  - `backend/src/app.ts`: fábrica de la app con el orden de middlewares de [plan.md](plan.md) («Orden del pipeline de Express»), `GET /api/v1/health` y 404 JSON para `/api/*`;
  - `backend/src/static.ts`: con `SERVE_FRONTEND=true`, sirve `frontend/dist` con `express.static` y responde `index.html` en las rutas que no son API;
  - `backend/src/openapi/registry.ts`: registra los esquemas de `@nova/shared` con `@asteasolutions/zod-to-openapi` y publica `GET /api/v1/openapi.json`;
  - `backend/src/lib/maintenance.ts`: `registerCleanup(name, fn)` y ejecución horaria de las limpiezas registradas, con su propio `start()`/`stop()` (research R6);
  - `backend/src/server.ts`: registra los preparadores y las limpiezas de cada dueño antes de arrancar (el módulo `auth` expone `registerAuthJobs(worker, maintenance)`, que se completa en T050 y T060), luego `listen` en `PORT` y arranque y parada ordenada del `OutboxWorker` y del mantenimiento.
- [X] T034 [P] [BE] Crear los helpers de prueba en `backend/tests/helpers/`:
  - `test-db.ts`: reinicia `nova_test` con `prisma migrate reset --force --skip-seed` una vez por archivo de prueba (no se puede vaciar `audit_events` por sus triggers); dentro de un archivo, cada prueba usa correos únicos;
  - `memory-mail-provider.ts`: guarda los mensajes y permite leer el último código por correo;
  - `fake-clock.ts`;
  - `agent.ts`: agente Supertest con cookies y cabecera `Origin` correcta.
- [X] T035 [BE] Crear `backend/tests/contract/openapi.contract.test.ts`: lee [contracts/auth.openapi.json](contracts/auth.openapi.json) con `JSON.parse` y compara, para cada operación presente en `GET /api/v1/openapi.json`, el método, la ruta, los códigos de estado y los esquemas de request y response (research R12).
- [X] T036 [BE] Crear `backend/tests/integration/foundation.test.ts`. Debe comprobar:
  - `GET /health` y `X-Request-Id`;
  - el formato de error 400/404/500;
  - `require-json` rechaza un cuerpo que no es JSON;
  - `GET /auth/session` sin cookie da 401 `UNAUTHENTICATED`;
  - una sesión inactiva más de 15 min (reloj falso) da `SESSION_EXPIRED` con `reason=idle`;
  - pasadas 12 h da `reason=absolute`;
  - `UPDATE audit_events` falla por el trigger;
  - `PgRateLimitStore` cuenta y reinicia;
  - con `NODE_ENV=production`, una variable faltante o cualquiera de los overrides impiden arrancar; fuera de producción, un aviso mayor o igual a la inactividad también;
  - `TRUNCATE audit_events` falla.
- [X] T037 [P] [BE] Crear `backend/tests/unit/outbox-worker.test.ts`:
  - envío correcto con el preparador registrado;
  - un preparador que descarta marca `discarded` sin enviar;
  - encolar un código nuevo descarta los pendientes del mismo flujo, y un reintento atrasado no reemplaza el código más reciente;
  - cada limpieza registrada borra solo filas de su propia tabla;
  - un envío fallido revierte lo preparado; reintentos con espera y paso a `failed`;
  - dos workers a la vez no envían duplicados;
  - ninguna fila de `email_outbox` contiene un código.

  Crear también `backend/tests/unit/crypto.test.ts` para el HMAC, la comparación segura y `randomCode()`.

### [FE] Armazón del frontend

- [ ] T038 [P] [FE] Crear `frontend/src/styles/tokens.css` y `frontend/src/styles/index.css`:
  - Tailwind 4 con `@theme`;
  - tokens de color para el modo claro y oscuro (`prefers-color-scheme`), radios, sombras y desenfoque de vidrio;
  - fuente del sistema con respaldo `Inter`;
  - transiciones ≤ 400 ms y `prefers-reduced-motion` (constitución, Principio IV).
- [ ] T039 [P] [FE] Crear `frontend/src/lib/messages.ts`:
  - catálogo único en español con un mensaje accionable para cada `ErrorCode` de `@nova/shared`;
  - todos los textos de las pantallas de esta spec, incluidos los avisos de `?motivo=` (`inactividad`, `expirada`, `clave-cambiada`).
- [ ] T040 [FE] Crear `frontend/src/lib/api-client.ts`:
  - `fetch` con `credentials: 'same-origin'` y JSON;
  - expone `lastServerContactAt`, actualizado en cada respuesta 2xx, para programar el aviso de inactividad (research R3);
  - `ApiError` construido con `ErrorResponseSchema`, y errores de red como `ApiError('NETWORK')`;
  - ante `ACCESS_TOKEN_EXPIRED`, un solo reintento tras `POST /auth/refresh` dentro de `navigator.locks.request('nova-refresh')` (research R2);
  - ante `SESSION_EXPIRED`, un callback configurable.
- [ ] T041 [P] [FE] Crear `frontend/src/lib/safe-redirect.ts` (solo rutas que empiezan con `/` y no con `//` ni `/\`) y `frontend/tests/safe-redirect.test.ts`.
- [ ] T042 [P] [FE] Crear en `frontend/src/components/` los componentes base:
  - `Button.tsx` (estado de carga), `TextField.tsx`, `PasswordField.tsx` (mostrar/ocultar), `Alert.tsx` (`aria-live`), `GlassCard.tsx` y `Spinner.tsx`;
  - objetivo táctil ≥ 44 px, foco visible y errores con `aria-describedby`.
- [ ] T043 [FE] Crear `frontend/src/components/AuthLayout.tsx` (tarjeta de vidrio centrada, responsive desde 360 px), `frontend/src/components/AppHeader.tsx` (logo y espacio para acciones) y `frontend/src/components/NotFoundPage.tsx`.
- [ ] T044 [FE] Crear `frontend/src/features/auth/api.ts` (una función tipada por cada operación de [contracts/auth.openapi.json](contracts/auth.openapi.json), con tipos de `@nova/shared`) y `frontend/src/features/auth/hooks/useSession.ts` (consulta `['session']` a `GET /auth/session`; un 401 equivale a «sin sesión»).
- [ ] T045 [FE] Crear el enrutamiento y los proveedores:
  - `frontend/src/app/providers.tsx`: `QueryClient` y `SessionProvider`, que conecta el callback de `SESSION_EXPIRED`;
  - `frontend/src/app/RequireAuth.tsx`: redirige a `/ingresar?redirect=<ruta>`;
  - `frontend/src/app/PublicOnly.tsx`: con sesión, envía a `/inicio`;
  - `frontend/src/app/router.tsx`: rutas con carga diferida según la tabla «Rutas» de [plan.md](plan.md), incluidas `/` y `*`;
  - `frontend/src/main.tsx`: pantalla de arranque mientras se resuelve `['session']`, y error de red con «Reintentar».
- [ ] T046 [P] [FE] Crear `frontend/vitest.config.ts` (entorno `jsdom`, condición `development`), `frontend/tests/setup.ts`, `frontend/tests/api-client.test.ts` (parseo de errores, un solo reintento tras refrescar, error de red) y `frontend/tests/RequireAuth.test.tsx` (redirección con `redirect`).

**Checkpoint**: la base está lista; las historias de usuario pueden empezar.

---

## Phase 3: User Story 1 — Registro con correo institucional verificado (Priority: P1) 🎯 MVP

**Goal**: una persona con correo `@ucc.edu.co` se registra en tres pasos y termina dentro de Nova
con su nombre visible.

**Independent Test**: registrar un correo permitido, leer el código en la bandeja de prueba,
completar nombre y contraseña, y ver «Hola, {primer nombre}» en `/inicio`. Recargar en el paso del
código debe retomar ese paso.

### [BE] Backend de US1

- [X] T047 [P] [US1] [BE] Crear `backend/tests/integration/registration.test.ts` con los escenarios de aceptación 1–7 de US1 y los casos límite:
  - correo con mayúsculas y espacios;
  - subdominio no listado rechazado;
  - correo con cuenta: la misma respuesta 202 y el correo `already_registered` sin código (FR-008);
  - consentimiento faltante y versión desactualizada (`POLICY_VERSION_OUTDATED`);
  - un flujo nuevo marca el anterior como `superseded`;
  - dos `complete` simultáneos crean una sola cuenta (FR-009);
  - `complete` después de `complete_by` da `VERIFICATION_EXPIRED` (FR-007);
  - `GET /auth/verification` retoma el paso (FR-009a);
  - la cookie `nova_vf` tiene sus atributos;
  - eventos `REGISTRATION_STARTED`, `EMAIL_VERIFIED` y `ACCOUNT_CREATED`;
  - el `data_consents` guardado tiene la versión y la fecha.
- [X] T048 [P] [US1] [BE] Crear `backend/src/modules/auth/password-policy.ts`:
  - combina `validatePasswordRules` de `@nova/shared` con la lista común, y agrega la violación `common`;
  - la lista va en `backend/src/modules/auth/data/common-passwords.txt` (~10 000 contraseñas comunes en minúsculas, una por línea) y se carga una vez en un `Set`.

  Crear también `backend/tests/unit/password-policy.test.ts`.
- [X] T049 [US1] [BE] Crear los repositorios:
  - `backend/src/modules/auth/repositories/verification-flow.repository.ts`: incluye `lockByTokenHash()` con `SELECT … FOR UPDATE` (`$queryRaw`) y `supersedeActive(email, purpose)`; data-model.md `VerificationFlow.flow_token_hash` y `VerificationFlow.status`;
  - `backend/src/modules/auth/repositories/code-send.repository.ts`: `countLastHour(email)`, que suma todos los propósitos (FR-005); data-model.md `CodeSend.email`, `CodeSend.purpose` y `CodeSend.created_at`;
  - `backend/src/modules/auth/repositories/consent.repository.ts`: data-model.md `DataConsent.user_id`, `DataConsent.policy_version` y `DataConsent.accepted_at`.
- [X] T050 [US1] [BE] Crear `backend/src/modules/auth/verification.service.ts` (research R4, R5, R9):
  - `requestCode(flow, tx)`: fija data-model.md `VerificationFlow.last_code_sent_at`, un `VerificationFlow.code_expires_at` provisional y `VerificationFlow.expires_at = code_expires_at + 30 min` (margen para pedir otro código); pone `code_hash = NULL`; inserta en `code_sends` (también en flujos señuelo); y, si el flujo no es señuelo, llama a `discardPendingCodeEmails(flowId)` y encola la plantilla de código con `flowId`;
  - `prepareCodeEmail(flowId, tx)`: preparador registrado en el `OutboxWorker` para `verification_code` y `password_reset_code`. Bloquea el flujo; si ya no está en `awaiting_code`, venció, o la fila de la bandeja es anterior a data-model.md `VerificationFlow.last_code_sent_at`, descarta. Si no, genera el código con `randomCode()`, guarda su HMAC en data-model.md `VerificationFlow.code_hash`, fija `VerificationFlow.code_expires_at = now + 15 min` y `VerificationFlow.expires_at`, y devuelve el código para el correo (research R6). El código nunca se guarda en otro lugar;
  - en `backend/src/modules/auth/auth.jobs.ts`, `registerAuthJobs(worker, maintenance)` registra `prepareCodeEmail` para las dos plantillas de código y la limpieza de `auth`: flujos vencidos hace más de 24 h y `code_sends` de más de 24 h;
  - `getState(flowToken)`: arma `VerificationState` con el correo enmascarado y `attemptsLeft` según data-model.md `VerificationFlow.code_attempts`;
  - `verify(flowToken, code)`: transición de la máquina de estados de data-model.md sobre `VerificationFlow.status`, `VerificationFlow.verified_at` y `VerificationFlow.complete_by`; al verificar, `VerificationFlow.expires_at = complete_by` (H1). Un código erróneo incrementa los intentos y devuelve `CODE_INVALID` con `attemptsLeft`; además `CODE_EXPIRED` y `CODE_ATTEMPTS_EXHAUSTED`. Un `code_hash` nulo (señuelo) siempre falla como `CODE_INVALID`. Audita `EMAIL_VERIFIED`.
- [X] T051 [US1] [BE] Crear `backend/src/modules/auth/registration.service.ts`:
  - `start(email, acceptedPolicyVersion)`:
    - valida el dominio contra `STUDENT_EMAIL_DOMAINS`, con coincidencia exacta (FR-001);
    - exige `PRIVACY_POLICY_VERSION`;
    - aplica el límite de 5 envíos por correo y por hora (`countLastHour(email)`);
    - reemplaza los flujos activos del correo y propósito;
    - crea el flujo con data-model.md `VerificationFlow.consent_policy_version` y `VerificationFlow.consent_accepted_at`, y llama a `requestCode`;
    - si el correo tiene cuenta, el flujo es señuelo: `requestCode` registra el envío sin encolar código, y se encola `already_registered`; todo en la misma transacción;
    - audita `REGISTRATION_STARTED`.
  - `complete(flowToken, fullName, password)`:
    - exige `verified` y `now < complete_by`;
    - valida el nombre y la política de contraseña;
    - crea el usuario (data-model.md `User.email`, `User.full_name`, `User.password_hash` con Argon2id, `User.password_changed_at`) y el consentimiento en una transacción;
    - si viola la unicidad, responde `EMAIL_ALREADY_REGISTERED`;
    - marca el flujo `completed`, crea la sesión y audita `ACCOUNT_CREATED`.
- [X] T052 [US1] [BE] En `backend/src/modules/auth/auth.routes.ts` y `backend/src/modules/auth/auth.controller.ts`, agregar con los limitadores de research R7:
  - `POST /api/v1/auth/register` (202 y cookie `nova_vf`);
  - `GET /api/v1/auth/verification`;
  - `POST /api/v1/auth/verify-email`;
  - `POST /api/v1/auth/register/complete` (201, cookies de sesión y borrado de `nova_vf`).

  Registrar sus operaciones en `backend/src/openapi/registry.ts`.

### [FE] Frontend de US1

- [ ] T053 [P] [US1] [FE] Crear `frontend/tests/RegisterPage.test.tsx`. Debe comprobar:
  - retoma el paso según `GET /auth/verification` (404 → paso 1, `code` → código, `complete` → perfil);
  - `DOMAIN_NOT_ALLOWED` aparece en el campo;
  - sin aceptar la política no se puede continuar;
  - `CODE_INVALID` muestra los intentos restantes;
  - las reglas de contraseña se actualizan mientras se escribe;
  - el éxito navega a `/inicio`;
  - el foco se mueve al título de cada paso.
- [ ] T054 [P] [US1] [FE] Crear en `frontend/src/features/auth/components/`:
  - `CodeInput.tsx`: 6 casillas con `inputMode="numeric"` y `autoComplete="one-time-code"`, acepta pegar el código, se envía al completarse, errores con `aria-live`;
  - `PasswordRules.tsx`: lista en vivo de `validatePasswordRules`, más la regla `common` cuando la reporta el servidor;
  - `ConsentCheckbox.tsx`: enlace a `/privacidad`.
- [ ] T055 [P] [US1] [FE] Crear `frontend/src/features/legal/PrivacyPolicyPage.tsx`, con el texto de la política de tratamiento de datos (Ley 1581 de 2012) en `frontend/src/lib/messages.ts` y la versión `PRIVACY_POLICY_VERSION` visible.
- [ ] T056 [US1] [FE] Crear:
  - `frontend/src/features/auth/hooks/useVerification.ts`: consulta `['verification', purpose]` y mutaciones `start` / `verify`;
  - `frontend/src/features/auth/steps/EmailStep.tsx`: genérico por `purpose`; valida el formato del correo mientras se escribe con `InstitutionalEmailSchema` (FR-024); en registro muestra `ConsentCheckbox`;
  - `frontend/src/features/auth/steps/CodeStep.tsx`: correo enmascarado y «Usar otro correo»;
  - `frontend/src/features/auth/steps/ProfileStep.tsx`: nombre y `PasswordField` con `PasswordRules`.

  Los estados de carga y error siguen la tabla de [plan.md](plan.md).
- [ ] T057 [US1] [FE] Crear:
  - `frontend/src/features/auth/pages/RegisterPage.tsx`: orquesta los pasos y retoma tras recargar (FR-009a), envuelto en `PublicOnly`;
  - `frontend/src/features/auth/pages/WelcomePage.tsx`: «Hola, {primer nombre}» (primera palabra de `fullName`) con esqueleto de carga, dentro de `RequireAuth` (FR-019).

  Conectar ambas en `frontend/src/app/router.tsx`.

### [E2E] Extremo a extremo de US1

- [ ] T058 [US1] [E2E] Crear `e2e/helpers/mailpit.ts` (lee el último mensaje para un correo desde `http://localhost:8025/api/v1/messages` y extrae el código) y `e2e/auth.registration.spec.ts` con:
  - registro completo con `@nova-test.edu.co`;
  - recargar en el paso del código y retomarlo;
  - dominio no permitido sin correo enviado;
  - correo ya registrado: misma pantalla y correo de aviso;
  - ejecución también en el proyecto móvil de 360 px.

**Checkpoint**: US1 funciona y se puede demostrar por sí sola (MVP).

---

## Phase 4: User Story 2 — Inicio y cierre de sesión (Priority: P2)

**Goal**: entrar con correo y contraseña, cerrar sesión y cierre automático por inactividad con
aviso previo.

**Independent Test**: con una cuenta creada, iniciar sesión, ver `/inicio`, cerrar sesión y
comprobar que `/inicio` redirige a `/ingresar`. Sin actividad, a los 14 min aparece el aviso.

### [BE] Backend de US2

- [X] T059 [P] [US2] [BE] Crear `backend/tests/integration/session.test.ts`. Debe comprobar:
  - login correcto (cookies con sus atributos);
  - credenciales incorrectas y correo inexistente dan el mismo `INVALID_CREDENTIALS`;
  - 5 fallos desde el mismo origen dan `LOGIN_LOCKED` con `retryAfterSeconds`, mientras que otro `nova_dev` entra;
  - el bloqueo dura 15 min desde el quinto fallo (no desde el primero), comprobado con reloj falso, y los intentos durante el bloqueo no lo prolongan;
  - 20 fallos en una hora bloquean todos los orígenes durante 15 min desde el vigésimo;
  - un inicio de sesión exitoso borra los fallos de ese origen;
  - `refresh` rota los tokens;
  - el refresh token anterior antes de 10 s da 200 sin cookies, y después de 10 s revoca con `reuse_detected`;
  - la inactividad y las 12 h dan `SESSION_EXPIRED`;
  - `logout` es idempotente e invalida la sesión al instante;
  - eventos `LOGIN_SUCCEEDED`, `LOGIN_FAILED`, `LOGIN_LOCKED` y `SESSION_ENDED`.
- [X] T060 [US2] [BE] Crear `backend/src/modules/auth/repositories/login-attempt.repository.ts` (inserción de fallos, conteos por ventana, `deleteByEmail` y `deleteOlderThan(24 h)`; data-model.md `LoginAttempt.email`, `LoginAttempt.origin_key` y `LoginAttempt.created_at`), y agregar esa limpieza en `registerAuthJobs` (`backend/src/modules/auth/auth.jobs.ts`). Agregar la cookie `nova_dev` en `backend/src/modules/auth/auth.cookies.ts` y el cálculo de la clave de origen, que usa el hash del dispositivo o, si no hay cookie, el de la IP con `TRUST_PROXY` (research R7).
- [X] T061 [US2] [BE] Crear `backend/src/modules/auth/login.service.ts`:
  - comprueba el bloqueo por origen y el global antes de verificar, calculando su fin con las reglas de data-model.md `LoginAttempt` («el más reciente + 15 min» sobre los últimos 5 o 20 fallos, research R7) (FR-015); los intentos rechazados por bloqueo no se registran;
  - verifica con Argon2 incluso si el correo no existe, contra un hash ficticio (research R5);
  - registra el fallo y responde `INVALID_CREDENTIALS`, o `LOGIN_LOCKED` con `retryAfterSeconds` al activarse el bloqueo;
  - si es correcto, borra los fallos de ese origen en data-model.md `LoginAttempt.origin_key` y crea la sesión;
  - audita `LOGIN_SUCCEEDED`, `LOGIN_FAILED` y `LOGIN_LOCKED`.
- [X] T062 [US2] [BE] Extender `backend/src/modules/auth/session.service.ts` (research R2):
  - `refresh(refreshToken)`: rotación con data-model.md `Session.refresh_token_hash`, `Session.previous_refresh_token_hash` y `Session.rotated_at`; ventana de 10 s sin cookies nuevas; fuera de la ventana revoca con `reuse_detected`; actualiza la actividad;
  - `logout(refreshToken)`: data-model.md `Session.revoked_at` y `Session.revoke_reason = logout`; audita `SESSION_ENDED`.
- [X] T063 [US2] [BE] Agregar en las rutas y el controlador de `auth`:
  - `POST /api/v1/auth/login`, con su limitador;
  - `POST /api/v1/auth/refresh`;
  - `POST /api/v1/auth/logout`, que borra `nova_at` y `nova_rt` y responde 204.

  Registrar las operaciones en `backend/src/openapi/registry.ts`.

### [FE] Frontend de US2

- [ ] T064 [P] [US2] [FE] Crear:
  - `frontend/tests/LoginPage.test.tsx`: error genérico, bloqueo con los minutos restantes, redirección con `redirect`, avisos según `motivo`;
  - `frontend/tests/useIdleTimer.test.tsx`, con temporizadores falsos: el aviso aparece en `idleTimeoutSeconds − idleWarningSeconds` contados desde el último contacto exitoso con el servidor (no desde la última interacción local); «Seguir conectado» llama a `refresh`; al terminar la cuenta regresiva se llama a `logout`; con `BroadcastChannel` simulado, una interacción en otra pestaña reinicia el contador, y `keepalive` y `logout` cierran el aviso o la sesión en todas las pestañas.
- [ ] T065 [US2] [FE] Crear `frontend/src/features/auth/pages/LoginPage.tsx`, dentro de `PublicOnly`, y `frontend/src/features/auth/hooks/useLogin.ts`:
  - al entrar, navega a `safeRedirect(redirect)` o a `/inicio`;
  - muestra el aviso según `?motivo=`;
  - con `LOGIN_LOCKED`, muestra los minutos restantes.
- [ ] T066 [US2] [FE] Crear `frontend/src/features/auth/hooks/useIdleTimer.ts` y `frontend/src/features/auth/components/InactivityDialog.tsx` (modal accesible con foco atrapado y cuenta regresiva de 60 s). Integrarlos en `SessionProvider` (`frontend/src/app/providers.tsx`) (FR-016a, research R3):
  - escucha `pointerdown`, `keydown`, `scroll` y la navegación;
  - programa el aviso desde el último contacto exitoso con el servidor (lo registra `api-client` en cada respuesta 2xx), no desde la última interacción local (research R3);
  - sincroniza las pestañas con `BroadcastChannel('nova-session')`, difundiendo `activity`, `keepalive` y `logout`;
  - llama a `refresh` con un límite de una vez cada 60 s;
  - toma los tiempos de `SessionInfo`.
- [ ] T067 [US2] [FE] Agregar «Cerrar sesión» en `frontend/src/components/AppHeader.tsx` con `frontend/src/features/auth/hooks/useLogout.ts`: llama a `POST /auth/logout`, limpia la caché de consultas y navega a `/ingresar`. En `api-client` / `SessionProvider`, `SESSION_EXPIRED` redirige a `/ingresar?motivo=inactividad` o `?motivo=expirada` según `details.reason`, agregando `&redirect=<ruta actual>` para volver donde estaba (caso límite de la spec). El cierre de sesión se difunde a las demás pestañas.

### [E2E] Extremo a extremo de US2

- [ ] T068 [US2] [E2E] Crear `e2e/auth.session.spec.ts` con:
  - login y logout;
  - abrir `/inicio` sin sesión, que redirige a `/ingresar` y vuelve a `/inicio` tras entrar;
  - 5 fallos que bloquean, mientras otro contexto del navegador entra;
  - el aviso de inactividad con los overrides (20 s de inactividad y 8 s de aviso), tanto con «Seguir conectado» como dejando que venza;
  - con dos pestañas, «Seguir conectado» en una cierra el aviso en la otra;
  - tras vencer, volver a ingresar regresa a la pantalla anterior.

**Checkpoint**: US1 y US2 funcionan cada una por su cuenta.

---

## Phase 5: User Story 3 — Recuperar la contraseña olvidada (Priority: P3)

**Goal**: recuperar el acceso con un código al correo; se cierran todas las sesiones y se
levantan los bloqueos.

**Independent Test**: con una sesión abierta en el contexto A, recuperar la contraseña en el
contexto B. La contraseña anterior falla, la nueva funciona y la sesión de A se cierra.

### [BE] Backend de US3

- [X] T069 [P] [US3] [BE] Crear `backend/tests/integration/password-reset.test.ts`. Debe comprobar:
  - un correo inexistente recibe la misma respuesta sin correo encolado (FR-020a);
  - el sexto código en una hora da `CODE_SEND_LIMIT`, sumando los de registro (FR-005);
  - un segundo inicio de recuperación invalida el flujo anterior (`superseded`);
  - flujo completo de código y contraseña nueva;
  - todas las sesiones quedan revocadas con `password_reset`;
  - los intentos de login del correo se borran (FR-020c);
  - se encola `password_changed`;
  - la contraseña anterior falla;
  - eventos `PASSWORD_RESET_REQUESTED`, `EMAIL_VERIFIED` y `PASSWORD_RESET_COMPLETED`.
- [X] T070 [US3] [BE] Crear `backend/src/modules/auth/password-reset.service.ts`:
  - `start(email)`: aplica el límite de 5 envíos por correo y por hora (`countLastHour(email)`, FR-005); reemplaza los flujos de recuperación activos del correo; crea el flujo `password_reset` y llama a `requestCode`; si no hay cuenta, el flujo es señuelo y no se encola nada; audita `PASSWORD_RESET_REQUESTED`;
  - `complete(flowToken, password)`, en una transacción:
    - exige `verified` y `now < complete_by`;
    - aplica la política de contraseña;
    - actualiza data-model.md `User.password_hash` y `User.password_changed_at`;
    - `revokeAllForUser(userId, 'password_reset')`;
    - `deleteByEmail` sobre data-model.md `LoginAttempt.email`;
    - encola `password_changed`;
    - marca el flujo `completed` y audita `PASSWORD_RESET_COMPLETED`.
- [X] T071 [US3] [BE] Agregar las rutas `POST /api/v1/auth/password-reset` (202, `nova_vf`) y `POST /api/v1/auth/password-reset/complete` (204, borra `nova_vf`), con sus limitadores, y registrarlas en `backend/src/openapi/registry.ts`.

### [FE] Frontend de US3

- [ ] T072 [P] [US3] [FE] Crear `frontend/tests/PasswordResetPage.test.tsx`: retoma el paso, pasa por los tres pasos y al terminar navega a `/ingresar?motivo=clave-cambiada`.
- [ ] T073 [US3] [FE] Crear:
  - `frontend/src/features/auth/steps/NewPasswordStep.tsx`;
  - `frontend/src/features/auth/pages/PasswordResetPage.tsx`: reutiliza `EmailStep` y `CodeStep` con `purpose="password_reset"`, dentro de `PublicOnly`.

  Agregar el enlace «¿Olvidaste tu contraseña?» en `LoginPage.tsx` y la ruta `/recuperar` en `frontend/src/app/router.tsx`.

### [E2E] Extremo a extremo de US3

- [ ] T074 [US3] [E2E] Crear `e2e/auth.password-reset.spec.ts`: dos contextos; la recuperación en B cierra la sesión de A; la contraseña anterior falla y la nueva funciona.

**Checkpoint**: US1, US2 y US3 funcionan cada una por su cuenta.

---

## Phase 6: User Story 4 — Pedir un código nuevo (Priority: P4)

**Goal**: reenviar el código con espera de 60 s y un máximo de 5 por hora; el código anterior
deja de servir.

**Independent Test**: en el paso del código, esperar la cuenta regresiva, reenviar y comprobar
que el código anterior falla y el nuevo funciona.

### [BE] Backend de US4

- [X] T075 [P] [US4] [BE] Crear `backend/tests/integration/resend.test.ts`. Debe comprobar:
  - reenviar antes de 60 s da `RESEND_TOO_SOON` con `retryAfterSeconds` y `Retry-After`;
  - el sexto envío en una hora da `CODE_SEND_LIMIT`, también si se reinicia el flujo;
  - el código anterior queda inválido y los intentos se reinician;
  - si el envío anterior sigue pendiente o reintentando, se descarta y solo llega el código nuevo;
  - un flujo señuelo responde igual y cuenta para el límite; el de registro reenvía `already_registered` y el de recuperación no encola nada;
  - un flujo en `verified` da `VERIFICATION_STEP_INVALID`.
- [X] T076 [US4] [BE] Agregar `resend(flowToken)` en `backend/src/modules/auth/verification.service.ts`:
  - controla data-model.md `VerificationFlow.last_code_sent_at` y el límite por correo con `CodeSend.created_at`;
  - reinicia data-model.md `VerificationFlow.code_attempts` y llama a `requestCode`, que invalida el `VerificationFlow.code_hash` anterior y encola el código nuevo; el worker lo genera al enviar;
  - en un señuelo de registro reenvía `already_registered`; en uno de recuperación no encola nada.

  Agregar la ruta `POST /api/v1/auth/resend-verification` (202) con su limitador y registrarla en `backend/src/openapi/registry.ts`.

### [FE] Frontend de US4

- [ ] T077 [P] [US4] [FE] Crear `frontend/tests/ResendButton.test.tsx`: cuenta regresiva desde `resendAvailableAt`, deshabilitado mientras corre y manejo de `RESEND_TOO_SOON` y `CODE_SEND_LIMIT`.
- [ ] T078 [US4] [FE] Crear `frontend/src/features/auth/components/ResendButton.tsx` e integrarlo en `CodeStep.tsx`. Con `CODE_EXPIRED` o `CODE_ATTEMPTS_EXHAUSTED`, destacar «Pedir código nuevo».

### [E2E] Extremo a extremo de US4

- [ ] T079 [US4] [E2E] Crear `e2e/auth.resend.spec.ts`: esperar la cuenta regresiva, reenviar, y comprobar que el código anterior falla y el nuevo funciona.

**Checkpoint**: las cuatro historias funcionan.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T080 [BE] Ampliar `backend/tests/contract/openapi.contract.test.ts` para exigir que las 12 operaciones del contrato existan en el documento generado. Ninguna puede faltar ni sobrar; la única excepción es `GET /openapi.json`, que sirve el propio documento y no forma parte del contrato.
- [X] T081 [P] [BE] Crear `backend/tests/integration/logging.test.ts`: captura la salida de `pino` durante registro, login y recuperación, y comprueba que no aparecen contraseñas, códigos ni valores de cookies (SC-005).
- [X] T082 [P] [BE] Crear `docs/despliegue.md` (Render + Neon + Brevo según research R14: variables, `TRUST_PROXY=1`, `SERVE_FRONTEND=true`, `prisma migrate deploy`). Actualizar en `README.md` la sección «Primeros pasos» con los comandos de [quickstart.md](quickstart.md).
- [ ] T083 [P] [FE] Revisar la accesibilidad (SC-009): navegación solo con teclado, lector de pantalla en los cuatro flujos, contraste AA en los dos temas, 360 px y `prefers-reduced-motion`. Corregir lo que falle en `frontend/src/` y registrar el resultado en `specs/001-auth-onboarding/checklists/accessibility.md`.
- [ ] T084 [P] [FE] Revisar el rendimiento: carga diferida de cada ruta en el build, Lighthouse móvil de `/ingresar` con primera carga interactiva < 2,5 s, y menos de 2 s desde enviar el login hasta ver la bienvenida (SC-004). Registrar el resultado en `specs/001-auth-onboarding/checklists/accessibility.md`.
- [ ] T085 [E2E] Ejecutar la validación completa de [quickstart.md](quickstart.md), secciones 4–6, con la aplicación integrada en `main`, y anotar en el PR cualquier diferencia antes de `/speckit-converge`.

---

## Dependencies & Execution Order

### Phase Dependencies

| Fase | Depende de | Notas |
| :--- | :--- | :--- |
| Phase 1, tareas `[SH]` (T001–T006) | Nada | Primero. Van en la rama de definición |
| Phase 2, tareas `[SH]` (T012–T017) | T006 | Cierran la rama de definición (PR a `main`) |
| Phase 1 `[BE]`/`[FE]`/`[E2E]` (T007–T011) y Phase 2 `[BE]`/`[FE]` | Definición integrada en `main` | — |
| Phase 3–6 | Phase 2 de su misma capa | — |
| Phase 7 | Las historias que se quieran entregar | — |

### User Story Dependencies

- **US1 (P1)**: depende solo de Foundational.
- **US2 (P2)**: depende de Foundational. Se prueba con una cuenta creada por la BD de prueba o
  por US1.
- **US3 (P3)**: reutiliza `verification.service` (US1) y `session.service` (US2).
- **US4 (P4)**: extiende `verification.service` (US1); se integra en `CodeStep` (US1).

### Dependencias entre capas

| Tarea | Requiere que esté en `main` |
| :--- | :--- |
| `[FE]` | Solo el contrato (`@nova/shared`) para construir; los endpoints `[BE]` de la misma historia para conectar |
| `[E2E]` de cada historia | Las tareas `[BE]` y `[FE]` de esa historia |

### Within Each User Story

Pruebas primero (deben fallar) → repositorios → servicios → rutas → interfaz. Una historia se
cierra antes de pasar a la siguiente prioridad.

### Parallel Opportunities

- **Rama de definición**: T002–T005 en paralelo, después de T001; T012–T015 y T017 en paralelo,
  después de T006.
- **Las capas entre sí**: tras la definición, `[BE]` y `[FE]` avanzan a la vez en ramas distintas.
- **Dentro de `[BE]` Foundational**: T020–T023, T025, T027, T029, T034 y T037.
- **Dentro de `[FE]` Foundational**: T038, T039, T041, T042 y T046.
- **En cada historia**: las pruebas `[P]` junto con los componentes `[P]`.

---

## Parallel Example: User Story 1

```text
# Backend (rama 001-auth-onboarding-be), en paralelo:
T047 [US1] [BE] backend/tests/integration/registration.test.ts
T048 [US1] [BE] backend/src/modules/auth/password-policy.ts

# Frontend (rama 001-auth-onboarding-fe), en paralelo:
T053 [US1] [FE] frontend/tests/RegisterPage.test.tsx
T054 [US1] [FE] CodeInput.tsx, PasswordRules.tsx, ConsentCheckbox.tsx
T055 [US1] [FE] PrivacyPolicyPage.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Definición: T001–T006 y T012–T017 (`[SH]`) → PR → `main`.
2. Setup y Foundational de cada capa: `[BE]` T007–T009 y T018–T037; `[FE]` T010 y T038–T046;
   `[E2E]` T011.
3. US1: `[BE]` T047–T052 (PR) → `[FE]` T053–T057 → `[E2E]` T058.
4. **Validar** US1 con el escenario de [quickstart.md](quickstart.md) (§5, US1). Es la demo
   mínima.

### Incremental Delivery

Backend abre un PR por historia (US1 → US2 → US3 → US4). Frontend conecta cada historia cuando
su backend llega a `main` (`git pull origin main` en su rama).

### Parallel Team Strategy

| Quién | Qué hace |
| :--- | :--- |
| Backend (Claude Code) | `[SH]` en la definición; luego `[BE]` por historia |
| Frontend (Antigravity) | Revisa la definición; luego `[FE]` por historia y al final `[E2E]` |

---

## Notes

- Cada tarea cita data-model.md (`Entidad.campo`) como fuente de sus restricciones; no se
  duplican aquí.
- Marcar `[X]` solo las tareas propias en `tasks.md` (líneas distintas, así git combina sin
  conflictos).
- Commits por tarea o grupo lógico: `feat(001): …`, `test(001): …`.
- Si una tarea exige cambiar `contracts/` o `/shared` después de la definición: detenerse y
  seguir la sección 5 de la [guía](../../GUIA_COMANDOS_SDD.md).
