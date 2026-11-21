# Implementation Plan: Registro e inicio de sesión de estudiantes

**Branch**: `001-auth-onboarding` | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-auth-onboarding/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Registro en tres pasos con correo institucional verificado por código, inicio y cierre de sesión
con cierre por inactividad, recuperación de contraseña y reenvío de códigos. Como es la primera
spec, también crea la base del repositorio: npm workspaces, paquete `@nova/shared`, Docker
Compose con PostgreSQL y Mailpit, y CI en GitHub Actions.

**Enfoque técnico** (detalle en [research.md](research.md)):

| Tema | Decisión |
| :--- | :--- |
| Sesión | Fila en PostgreSQL más un JWT de acceso de 15 min y un refresh token rotativo, ambos en cookies `HttpOnly` (R1, R2) |
| Inactividad | Medida en el servidor; el frontend avisa a los 14 min (R3) |
| Verificación por código | Flujo compartido entre registro y recuperación, identificado por la cookie `nova_vf`, que permite retomar el paso tras recargar (R4) |
| Privacidad de cuentas | Respuestas idénticas exista o no la cuenta (R5) |
| Correos | Bandeja de salida en PostgreSQL con reintentos (R6) |
| Bloqueo por intentos | Por correo + dispositivo o red, con un tope global por correo (R7) |
| Despliegue | Un solo origen: Express sirve el frontend compilado (R14) |

## Technical Context

**Language/Version**: TypeScript 5 (estricto) sobre Node.js 24 LTS; React 19 en el navegador.

**Primary Dependencies**:

| Capa | Dependencias |
| :--- | :--- |
| Backend | Express 5, Zod 4, `@asteasolutions/zod-to-openapi`, `jsonwebtoken`, `cookie-parser`, `argon2`, `helmet`, `cors`, `express-rate-limit`, `pino`, `pino-http`, `nodemailer`, Prisma 7 (con `@prisma/adapter-pg` + `pg`, ver Constitution Check) |
| Frontend | React 19, Vite, React Router 7 (SPA), TanStack Query 5, Tailwind CSS 4, `lucide-react` |

**Storage**: PostgreSQL 17 (Neon en la demo, Docker en desarrollo). Modelo en
[data-model.md](data-model.md).

**Testing**:

| Tipo | Herramientas |
| :--- | :--- |
| Unitarias y de componentes | Vitest; Testing Library + jsdom en el frontend |
| Integración de la API | Supertest contra la BD `nova_test` |
| Contrato | Vitest: el OpenAPI generado debe coincidir con [contracts/](contracts/) |
| E2E | Playwright con Mailpit |

**Target Platform**:
- Navegadores modernos: Chrome, Edge, Firefox y Safari en sus dos últimas versiones, en móvil
  desde 360 px y en escritorio.
- Servidor Linux (Render) en producción; Windows 11 con Docker Desktop (WSL 2) en desarrollo.

**Project Type**: aplicación web (SPA + API REST) en un monorepo con npm workspaces.

**Performance Goals**:
- La pantalla de bienvenida aparece en menos de 2 s después de iniciar sesión (SC-004).
- La primera carga interactiva tarda menos de 2,5 s en 4G (constitución).
- El 95 % de los correos se entregan en menos de 1 min (SC-002): el worker de la bandeja de
  salida revisa cada 2 s.

**Constraints**:
- Sin estado en memoria; contadores y sesiones en PostgreSQL (Principio VI).
- Cookies `SameSite=Strict`, lo que obliga a un solo origen (R14).
- Nada de contraseñas, códigos ni tokens en claro (FR-022).
- WCAG 2.1 AA.

**Scale/Scope**:
- Demo académica: decenas de usuarios, una instancia.
- El diseño admite varias instancias (outbox con `SKIP LOCKED`, contadores en la BD).
- 7 pantallas, 12 endpoints y 9 tablas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / sección | Verificación | Estado |
| :--- | :--- | :--- |
| I. Dinero exacto | La funcionalidad no maneja dinero | N/A |
| II. SDD y cero código sombra | Todo el diseño se rastrea a requisitos de la spec. Extras justificados: `GET /auth/verification` (FR-009a), `nova_dev` (FR-015), `/privacidad` (FR-002, ver el texto aceptado) | ✅ |
| III. Correo institucional | Lista por la variable de entorno `STUDENT_EMAIL_DOMAINS`; código de un solo uso con HMAC, 15 min, 5 intentos y reenvío limitado (R9) | ✅ |
| III. Credenciales | Argon2id (R10) | ✅ |
| III. Sesiones | JWT de 15 min y refresh rotativo en cookies `HttpOnly`/`Secure`/`Strict`, sin `localStorage` (R1, R2) | ✅ |
| III. Mínimo privilegio | Solo `GET /auth/session` devuelve datos del usuario y siempre los propios | ✅ |
| III. Habeas Data | Se guardan la versión y la fecha de la política aceptada (`data_consents`) | ✅ |
| III. Secretos | `.env` + `.env.example`; redacción en `pino` de contraseñas, códigos, cookies y cabeceras de autorización | ✅ |
| IV. Estética y accesibilidad | Tokens CSS claro/oscuro, vidrio esmerilado, ≥ 44 px, foco visible, `prefers-reduced-motion` | ✅ |
| V. Simulación segura | Correos a Mailpit en desarrollo y pruebas; SMTP real solo en la demo desplegada | ✅ |
| VI. Monolito modular | El módulo `auth` es dueño de sus tablas; la auditoría y el correo son servicios de `lib/` | ✅ |
| VI. API sin estado | Sesiones, flujos, intentos, contadores y bandeja de salida en PostgreSQL (R8) | ✅ |
| VI. Contratos primero | [contracts/auth.openapi.yaml](contracts/auth.openapi.yaml) + OpenAPI generado desde Zod con prueba de contrato (R12) | ✅ |
| VI. Configuración y reproducibilidad | Variables validadas con Zod al arrancar; `docker compose up` + `npm install && npm run dev` | ✅ |
| Stack | Solo tecnologías listadas, **excepto V3** | ⚠️ |
| Regla de dominio 12 (rutas públicas) | La lista de la constitución no incluye las rutas nuevas de la spec, **ver V1** | ❌ |
| Formato de error | Se necesita un campo opcional `details`, **ver V2** | ⚠️ |
| Flujo de equipo (etiquetas) | La configuración raíz no encaja en ninguna etiqueta, **ver V4** | ⚠️ |
| Estructura y estilo | `/frontend`, `/backend`, `/db`, `/shared`; archivos de menos de 300 líneas; nombres según la convención | ✅ |
| Errores y validación | Zod en todas las entradas; middleware central con `requestId`; mensajes en español en un catálogo | ✅ |
| Seguridad | `helmet`, CORS al origen propio, límites de tasa en las rutas de autenticación, auditoría inmutable con trigger | ✅ |

### Violaciones que requieren la enmienda v2.3.0 (MINOR)

| # | Conflicto | Enmienda propuesta |
| :--- | :--- | :--- |
| **V1** | La regla 12 enumera `/auth/register`, `/auth/login`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/refresh` y `/health`. La spec (clarificada) también necesita `/auth/register/complete`, `/auth/verification`, `/auth/password-reset`, `/auth/password-reset/complete` y `/auth/logout`, y el Principio VI pide publicar `/openapi.json`. | Agregar esas rutas a la lista de rutas públicas. |
| **V2** | El formato de error solo define `code`, `message` y `requestId`. La interfaz necesita los intentos restantes, los segundos de espera, el motivo del cierre de sesión y las reglas de contraseña incumplidas. | Agregar un objeto opcional `details`, sin datos sensibles. |
| **V3** | Faltan en el stack: `pg` y `@prisma/adapter-pg` (obligatorios en Prisma 7); `jsdom`, `@testing-library/react` y `@testing-library/user-event` (los exige Testing Library); `@vitejs/plugin-react` y `@tailwindcss/vite` (plugins oficiales); y herramientas: `typescript`, `typescript-eslint`, `eslint-plugin-react-hooks`, `@types/*` y la CLI `prisma`. | Cláusula general: «se permiten los complementos oficiales, adaptadores, tipos y herramientas de desarrollo necesarios para usar una tecnología ya listada». Además, nombrar explícitamente `pg`, `@prisma/adapter-pg` y `jsdom`. |
| **V4** | La etiqueta `[SH]` cubre solo `/shared`, pero la configuración raíz (workspaces, `tsconfig.base.json`, ESLint/Prettier, CI) la necesitan las dos capas antes de empezar. | `[SH]`: «paquete `/shared` y configuración raíz compartida». |

**Estado del gate**: el diseño está completo y puede revisarse, pero **la implementación queda
bloqueada** hasta integrar la enmienda v2.3.0 a `main` en su propio PR (Gobernanza §2).

**Re-check post-diseño**: tras la Fase 1 no aparecieron violaciones nuevas. V1 a V4 siguen
pendientes de enmienda.

## Project Structure

### Documentation (this feature)

```text
specs/001-auth-onboarding/
├── spec.md
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones R1–R16
├── data-model.md        # Fase 1: 9 tablas y máquinas de estado
├── quickstart.md        # Fase 1: cómo levantar y validar
├── contracts/
│   └── auth.openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
package.json                 # [SH] npm workspaces: shared, db, backend, frontend
tsconfig.base.json           # [SH] strict, customConditions ["development"]
eslint.config.js             # [SH]
.prettierrc                  # [SH]
.env.example                 # [SH] todas las variables (sin secretos reales)
.github/workflows/ci.yml     # [SH] quality + e2e
docker-compose.yml           # [BE] postgres:17 + mailpit
docker/postgres/init.sql     # [BE] crea las bases nova y nova_test

shared/                      # [SH] @nova/shared — sin Express, React ni Prisma
└── src/
    ├── index.ts
    ├── constants.ts         # PRIVACY_POLICY_VERSION, CODE_LENGTH, SESSION_IDLE_TIMEOUT_SECONDS…
    ├── errors.ts            # ErrorCode, ErrorResponseSchema
    ├── email.ts             # InstitutionalEmailSchema, normalizeEmail()
    ├── password.ts          # PasswordSchema, validatePasswordRules()
    ├── auth.schemas.ts      # requests y responses de la API (lista abajo)
    └── *.test.ts

db/                          # [BE] @nova/db
├── prisma/schema.prisma
├── prisma/migrations/       # incluye el trigger de inmutabilidad de audit_events
├── prisma.config.ts
├── seed.ts                  # vacío en 001 (no hay datos semilla necesarios)
└── src/index.ts             # exporta el cliente con el adaptador pg

backend/                     # [BE]
├── src/
│   ├── server.ts            # arranque: HTTP + worker de la bandeja de salida
│   ├── app.ts               # fábrica de la app Express (sin listen, para Supertest)
│   ├── config/env.ts        # esquema Zod de las variables; falla al arrancar si falta alguna
│   ├── lib/
│   │   ├── logger.ts        # pino con redacción
│   │   ├── errors.ts        # AppError(code, status, details)
│   │   ├── crypto.ts        # tokens aleatorios, sha256, hmac, AES-GCM
│   │   ├── clock.ts         # reloj inyectable para pruebas
│   │   ├── audit/           # audit.service.ts, audit.repository.ts
│   │   └── mail/            # mail-provider.ts, smtp-provider.ts, outbox.repository.ts,
│   │                        # outbox-worker.ts, templates/ (4 plantillas en español)
│   ├── middleware/
│   │   ├── request-id.ts
│   │   ├── error-handler.ts
│   │   ├── require-auth.ts  # JWT + sesión vigente + last_activity
│   │   ├── same-origin.ts   # exige Content-Type JSON y Origin = APP_ORIGIN en mutaciones
│   │   └── rate-limit/      # pg-store.ts, limiters.ts
│   ├── modules/auth/
│   │   ├── auth.routes.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.cookies.ts           # opciones y nombres de cookies
│   │   ├── registration.service.ts
│   │   ├── verification.service.ts   # verificar, reenviar, estado
│   │   ├── password-reset.service.ts
│   │   ├── login.service.ts          # credenciales + bloqueos
│   │   ├── session.service.ts        # crear, validar, refrescar, revocar
│   │   ├── password-policy.ts        # reglas compartidas + lista común
│   │   ├── repositories/             # user, consent, verification-flow, code-send,
│   │   │                             # session, login-attempt
│   │   └── data/common-passwords.txt
│   ├── openapi/registry.ts
│   └── static.ts            # en producción sirve frontend/dist + fallback a index.html
└── tests/
    ├── integration/         # Supertest por historia de usuario
    ├── contract/            # OpenAPI generado vs contracts/auth.openapi.yaml
    └── helpers/             # BD de prueba, MailProvider en memoria, reloj falso

frontend/                    # [FE]
├── index.html
├── vite.config.ts           # proxy /api → http://localhost:3000
└── src/
    ├── main.tsx
    ├── app/
    │   ├── router.tsx       # rutas con carga diferida
    │   ├── providers.tsx    # QueryClient + SessionProvider
    │   ├── RequireAuth.tsx
    │   └── PublicOnly.tsx
    ├── features/auth/
    │   ├── pages/           # LoginPage, RegisterPage, PasswordResetPage, WelcomePage
    │   ├── steps/           # EmailStep, CodeStep, ProfileStep, NewPasswordStep
    │   ├── components/      # CodeInput, PasswordRules, ResendButton, ConsentCheckbox,
    │   │                    # InactivityDialog
    │   ├── hooks/           # useSession, useVerification, useIdleTimer, useLogin…
    │   └── api.ts           # llamadas tipadas con @nova/shared
    ├── features/legal/PrivacyPolicyPage.tsx
    ├── components/          # Button, TextField, PasswordField, Alert, GlassCard, Spinner,
    │                        # AuthLayout, AppHeader, NotFoundPage
    ├── lib/
    │   ├── api-client.ts    # fetch + ApiError + refresh automático con navigator.locks
    │   ├── messages.ts      # catálogo único de textos en español
    │   └── safe-redirect.ts # solo rutas internas en ?redirect=
    └── styles/
        ├── tokens.css       # @theme + variables claro/oscuro
        └── index.css
    tests/                   # Vitest + Testing Library

e2e/                         # [E2E] Playwright
├── playwright.config.ts
├── helpers/mailpit.ts       # lee el último código desde la API de Mailpit
└── auth.spec.ts             # registro, login/logout, recuperación, inactividad
```

**Structure Decision**: monorepo con los cuatro workspaces que define la constitución (v2.1.0),
más `e2e/` para Playwright en la raíz. Playwright prueba la aplicación completa, por lo que no
pertenece a una sola capa.

## Diseño del backend

### Módulos y responsabilidades

| Pieza | Responsabilidad |
| :--- | :--- |
| `modules/auth` | Dueño de `users`, `data_consents`, `verification_flows`, `code_sends`, `sessions` y `login_attempts`. Expone `sessionService.validate()` para el middleware y para futuros módulos. |
| `lib/audit` | `audit.record(type, { userId?, email?, requestId, metadata })`. Solo inserta. |
| `lib/mail` | `mail.enqueue(template, to, payload, tx)` dentro de la transacción de negocio; `OutboxWorker` envía y limpia (R6). |
| `middleware/rate-limit` | Límites por IP con `PgRateLimitStore` (R7, R8). |

### Endpoints

Detalle completo en [contracts/auth.openapi.yaml](contracts/auth.openapi.yaml).

| Método y ruta | Historia | Requisitos |
| :--- | :--- | :--- |
| `POST /auth/register` | US1 | FR-001, FR-002, FR-003, FR-008 |
| `GET /auth/verification` | US1, US3, US4 | FR-009a |
| `POST /auth/verify-email` | US1, US3 | FR-003, FR-004 |
| `POST /auth/resend-verification` | US4 | FR-005 |
| `POST /auth/register/complete` | US1 | FR-006, FR-007, FR-009 a FR-012 |
| `POST /auth/login` | US2 | FR-013, FR-014, FR-015 |
| `POST /auth/refresh` | US2 | FR-016, FR-016a |
| `POST /auth/logout` | US2 | FR-017 |
| `GET /auth/session` | US2 | FR-018, FR-019 |
| `POST /auth/password-reset` | US3 | FR-020, FR-020a |
| `POST /auth/password-reset/complete` | US3 | FR-020b, FR-020c |
| `GET /health`, `GET /openapi.json` | — | Constitución |

### Orden del pipeline de Express

1. `request-id`
2. `pino-http` (con redacción)
3. `helmet`
4. `cors` (solo `APP_ORIGIN`, con credenciales)
5. `express.json` (límite de 10 kb)
6. `cookie-parser`
7. `same-origin`, en métodos que modifican datos
8. Rutas `/api/v1`, con limitadores por ruta
9. `static.ts`, solo en producción
10. 404 en JSON para `/api/*`
11. `error-handler`

### Variables de entorno (`.env.example`)

| Grupo | Variables |
| :--- | :--- |
| Servidor | `NODE_ENV`, `PORT`, `APP_ORIGIN`, `TRUST_PROXY`, `LOG_LEVEL`, `SERVE_FRONTEND` |
| Base de datos | `DATABASE_URL` |
| Secretos | `JWT_ACCESS_SECRET`, `CODE_HMAC_SECRET`, `OUTBOX_ENCRYPTION_KEY` (32 bytes en base64) |
| Registro | `STUDENT_EMAIL_DOMAINS` (`ucc.edu.co` en la demo; `nova-test.edu.co` solo en `.env.test`) |
| Correo | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` |
| Solo desarrollo y E2E | `SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE`: reduce la inactividad (ej. 20 s) para probar el aviso sin esperar 14 min. El esquema de entorno la rechaza si `NODE_ENV=production`. El frontend usa los valores de `SessionInfo`, nunca constantes fijas. |

## Diseño del frontend

### Rutas

Todas se cargan de forma diferida y las de la misma familia comparten `AuthLayout`.

| Ruta | Pantalla | Acceso | Notas |
| :--- | :--- | :--- | :--- |
| `/` | — | — | Redirige a `/inicio` si hay sesión, si no a `/ingresar` |
| `/ingresar` | `LoginPage` | Solo sin sesión | Lee `?redirect=` (validado) y `?motivo=inactividad\|expirada\|clave-cambiada` para el aviso |
| `/registro` | `RegisterPage` | Solo sin sesión | Pasos `EmailStep` → `CodeStep` → `ProfileStep`, según `GET /auth/verification` |
| `/recuperar` | `PasswordResetPage` | Solo sin sesión | Pasos `EmailStep` → `CodeStep` → `NewPasswordStep` |
| `/privacidad` | `PrivacyPolicyPage` | Pública | Texto de la política, versión `PRIVACY_POLICY_VERSION` |
| `/inicio` | `WelcomePage` | `RequireAuth` | «Hola, {nombre}» y «Cerrar sesión»; se reemplaza en la 002 |
| `*` | `NotFoundPage` | Pública | — |

### Pantallas, componentes y estados

| Vista | Carga | Vacío | Error |
| :--- | :--- | :--- | :--- |
| Arranque de la app (consulta `['session']`) | Pantalla de bienvenida con logo y spinner, máximo hasta la respuesta | — | Sin conexión: `Alert` con «Reintentar» |
| `LoginPage` | Botón «Ingresar» con spinner y deshabilitado | No aplica (formulario) | `INVALID_CREDENTIALS` y `LOGIN_LOCKED` (con minutos restantes) en `Alert`; errores de campo junto al campo; red caída en `Alert` |
| `EmailStep` (registro y recuperación) | Botón con spinner | No aplica | `DOMAIN_NOT_ALLOWED` en el campo; consentimiento sin marcar en el checkbox; `CODE_SEND_LIMIT` con el tiempo de espera |
| `CodeStep` | Comprobando el código (spinner en el botón; las casillas se bloquean) | No aplica | `CODE_INVALID` con intentos restantes; `CODE_EXPIRED` y `CODE_ATTEMPTS_EXHAUSTED` con el botón «Pedir código nuevo» destacado |
| `ResendButton` | Enviando | — | `RESEND_TOO_SOON`: cuenta regresiva desde `resendAvailableAt` |
| `ProfileStep` / `NewPasswordStep` | Botón con spinner | No aplica | `PASSWORD_WEAK` marca la regla en `PasswordRules`; `VERIFICATION_EXPIRED` explica y vuelve al paso 1 |
| `WelcomePage` | Esqueleto del nombre | No aplica (siempre hay usuario) | Si la sesión expiró, redirige a `/ingresar?motivo=expirada` |
| `InactivityDialog` | «Seguir conectado» con spinner | — | Si falla el refresh, cierra y redirige a `/ingresar?motivo=expirada` |

El estado «vacío» no aplica a esta funcionalidad porque ninguna vista lista colecciones. Las
vistas con listas aparecen en la 002.

### Comportamientos clave

- **Retomar tras recargar** (FR-009a): `RegisterPage` y `PasswordResetPage` consultan
  `GET /auth/verification` al montar.
  - `404` muestra el paso 1.
  - `step=code` muestra el código.
  - `step=complete` muestra el paso 3.
  - Si el `purpose` no coincide con la página, muestra el paso 1.

  El enlace «Usar otro correo» vuelve al paso 1, y un nuevo `POST` reemplaza el flujo anterior.
- **`CodeInput`**: 6 casillas con `inputMode="numeric"` y `autoComplete="one-time-code"`. Acepta
  pegar el código completo y se envía solo al completar los 6 dígitos. Tiene una etiqueta
  accesible única y anuncia los errores con `aria-live`.
- **`PasswordRules`**: lista en vivo de las reglas de `validatePasswordRules()` (FR-024). La regla
  de «contraseña común» solo aparece si el servidor la reporta.
- **Inactividad** (R3): `useIdleTimer` en `SessionProvider` y `BroadcastChannel('nova-session')`
  para sincronizar las pestañas.
- **Refresh automático**: `api-client` reintenta una sola vez tras `ACCESS_TOKEN_EXPIRED`, con
  `navigator.locks.request('nova-refresh')`. Con `SESSION_EXPIRED` limpia la caché y redirige
  según `details.reason`.
- **Redirección tras login** (FR-018): `RequireAuth` envía a `/ingresar?redirect=<ruta>`, y
  `safe-redirect` acepta solo rutas que empiezan con `/` y no con `//`.
- **Accesibilidad**:
  - el foco se mueve al título de cada paso al cambiar;
  - errores asociados con `aria-describedby`;
  - contraste AA en ambos temas;
  - objetivos táctiles ≥ 44 px;
  - animaciones ≤ 400 ms, desactivadas con `prefers-reduced-motion`.

## Paquete `@nova/shared`: esquemas Zod

| Esquema / exportación | Uso |
| :--- | :--- |
| `InstitutionalEmailSchema`, `normalizeEmail()` | Correo: trim, minúsculas, formato, máximo 254 |
| `PasswordSchema`, `validatePasswordRules(password, email)` → `PasswordRuleViolation[]` | Reglas `too_short`, `too_long` y `contains_email` (la regla `common` solo en el backend) |
| `FullNameSchema` | 2–100 caracteres, letras Unicode, espacio, `-` y `'` |
| `VerificationCodeSchema` | `^\d{6}$` |
| `StartRegistrationRequestSchema` | `{ email, acceptedPolicyVersion }` |
| `StartPasswordResetRequestSchema` | `{ email }` |
| `VerifyCodeRequestSchema` | `{ code }` |
| `CompleteRegistrationRequestSchema` | `{ fullName, password }` |
| `CompletePasswordResetRequestSchema` | `{ password }` |
| `LoginRequestSchema` | `{ email, password }` (sin reglas de fortaleza, solo longitud) |
| `VerificationStateSchema` | Respuesta de los endpoints de verificación |
| `UserSchema`, `SessionInfoSchema`, `SessionResponseSchema` | Respuestas de sesión |
| `ErrorCodeSchema`, `ErrorResponseSchema`, `ErrorDetailsSchema` | Formato de error (V2) |
| `PRIVACY_POLICY_VERSION`, `CODE_LENGTH`, `SESSION_IDLE_TIMEOUT_SECONDS` (900), `SESSION_IDLE_WARNING_SECONDS` (60) | Constantes compartidas |

Todos los tipos TypeScript se derivan con `z.infer`. Las utilidades de dinero llegarán con la
spec 002; no se agregan ahora (Principio II).

## Base del proyecto, despliegue y fallas de correo

- **Workspaces y scripts raíz** (compatibles con Windows):

  | Script | Qué hace |
  | :--- | :--- |
  | `npm run dev:backend` | `tsx watch` del backend |
  | `npm run dev:frontend` | Vite |
  | `npm run db:migrate` | Migraciones de Prisma |
  | `npm run lint` | ESLint en todos los workspaces |
  | `npm run typecheck` | `tsc -b` |
  | `npm test` | Pruebas de todos los workspaces |
  | `npm run test:e2e` | Playwright |
  | `npm run build` | `shared` → `db` → `backend` → `frontend` |

  Cada integrante levanta solo lo que necesita: Backend usa `dev:backend`; Frontend usa
  `dev:backend` y `dev:frontend` en dos terminales.
- **Docker Compose y CI**: según R15.
- **Despliegue**: según R14, con Render, Neon y Brevo, en una tarea final de documentación y
  configuración. No bloquea el desarrollo.
- **Fallas del servicio de correo**: según R6. La API responde 202 siempre; la bandeja de salida
  reintenta 5 veces con espera exponencial. Si aun así el código no llega, el estudiante usa
  «Reenviar código».

## Guía para `/speckit-tasks`: etiquetas por capa

| Etiqueta | Alcance en esta spec | Rama |
| :--- | :--- | :--- |
| `[SH]` | Configuración raíz (workspaces, `tsconfig.base.json`, ESLint/Prettier, `.env.example`, CI) y `shared/` con sus pruebas. **Requiere V4.** | `001-auth-onboarding` |
| `[BE]` | `docker-compose.yml`, `db/`, `backend/`, pruebas de integración y de contrato, documentación de despliegue | `001-auth-onboarding-be` |
| `[FE]` | `frontend/` y sus pruebas de componentes | `001-auth-onboarding-fe` |
| `[E2E]` | `e2e/`: registro completo, login/logout, recuperación e inactividad (con reloj acelerado) | `001-auth-onboarding-fe` |

Orden sugerido de las historias para los PR incrementales del backend: US1 → US2 → US3 → US4.

## Complexity Tracking

| Decisión | Por qué se necesita | Alternativa más simple descartada porque |
| :--- | :--- | :--- |
| Bandeja de salida con el contenido cifrado (incluye el código) | Reintentar correos sin perderlos y sin que el tiempo de respuesta delate cuentas (R5, R6) | El envío síncrono rompe el registro si falla SMTP y revela cuentas; guardar el código en claro contradice el Principio III, por eso se cifra con AES-GCM y se borra al enviar |
| Sesión en BD además del JWT | Revocar al instante (FR-017, FR-020c) y medir la inactividad en el servidor (FR-016) | Solo JWT no permite revocar; solo sesión opaca contradice la constitución |
| Ventana de 10 s ante reuso del refresh token | Evitar cierres falsos con varias pestañas (R2) | Sin ventana, dos pestañas que refrescan a la vez cerrarían la sesión |
| Express sirve el frontend en producción | `SameSite=Strict` exige un solo sitio (R14) | Dos servicios en `onrender.com` son sitios distintos y las cookies no viajarían |
