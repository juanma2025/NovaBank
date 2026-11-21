# Research: Registro e inicio de sesión de estudiantes

**Feature**: `001-auth-onboarding` · **Date**: 2026-11-20 · **Plan**: [plan.md](plan.md)

Cada sección resuelve una incógnita del contexto técnico. Formato: decisión, justificación y
alternativas consideradas.

---

## R1. Sesión: JWT corto + sesión en base de datos

**Decision**: La sesión es una fila en la tabla `sessions`. El cliente recibe dos cookies:

| Cookie | Contenido | Path | Vida |
| :--- | :--- | :--- | :--- |
| `nova_at` | JWT de acceso firmado (HS256) con `sub` (usuario) y `sid` (sesión) | `/api` | 15 min |
| `nova_rt` | Refresh token opaco (32 bytes aleatorios); en la BD solo su hash SHA-256 | `/api/v1/auth` | hasta el vencimiento absoluto (12 h) |

Todas las cookies son `HttpOnly`, `Secure` y `SameSite=Strict`.

En cada solicitud autenticada, el middleware verifica la firma del JWT **y** que la sesión `sid`
siga activa en la BD: no revocada, sin superar 15 minutos de inactividad ni las 12 horas
absolutas. Si está activa, actualiza `last_activity_at`, como máximo una vez cada 30 segundos
para no escribir en cada solicitud.

**Rationale**:
- La constitución exige JWT ≤ 15 min y refresh token rotativo en cookies.
- La spec exige cosas que un JWT por sí solo no puede garantizar:
  - cierre inmediato al cerrar sesión (FR-017);
  - cierre de todas las sesiones al recuperar la contraseña (FR-020c);
  - inactividad de 15 minutos medida en el servidor (FR-016).

  Consultar la sesión por clave primaria cuesta poco y mantiene la API sin estado en memoria
  (Principio VI).

**Alternatives considered**:
- *Solo JWT sin consulta a la BD*: no permite revocar al instante; descartado.
- *Sesión opaca sin JWT*: más simple, pero contradice la constitución.

## R2. Rotación del refresh token y varias pestañas

**Decision**:
- `POST /auth/refresh` rota el refresh token y guarda el hash anterior en
  `previous_refresh_token_hash`, con `rotated_at`.
- Si llega el hash anterior **más de 10 segundos** después de la rotación, se considera reuso: la
  sesión se revoca (`reuse_detected`) y se audita.
- Dentro de esos 10 segundos se responde 200 sin emitir cookies nuevas, porque la otra pestaña ya
  las recibió.
- En el frontend, solo una pestaña refresca a la vez, coordinada con la Web Locks API
  (`navigator.locks`, nativa del navegador).

**Rationale**: dos pestañas que refrescan al mismo tiempo no deben cerrar la sesión por un falso
positivo de reuso. La ventana corta junto con el bloqueo en el cliente elimina la carrera sin
debilitar la detección.

**Alternatives considered**: no detectar reuso (contradice «rotación obligatoria para detectar
reutilizaciones», sección Seguridad); refrescar sin coordinar (falsos positivos).

## R3. Inactividad y aviso de «Seguir conectado»

**Decision**:

| Responsable | Comportamiento |
| :--- | :--- |
| Servidor | La sesión vence si `now − last_activity_at > idleTimeout` o si `now > absolute_expires_at`. `last_activity_at` se actualiza en cada solicitud autenticada y en cada `POST /auth/refresh`. |
| Frontend (`useIdleTimer`) | Escucha interacciones (`pointerdown`, `keydown`, `scroll`, navegación) y las sincroniza entre pestañas con `BroadcastChannel('nova-session')`. |
| Frontend, al detectar interacción | Si pasó más de 60 s desde el último contacto exitoso con el servidor, llama a `POST /auth/refresh`. |
| Frontend, programación del aviso | El aviso se programa en `lastServerContactAt + idleTimeout − idleWarning`, contando desde el **último contacto exitoso con el servidor** (cualquier respuesta 2xx de la API), no desde la última interacción local. Así el aviso nunca llega después de que el servidor ya cerró la sesión. |
| Frontend, «Seguir conectado» | Llama a `POST /auth/refresh` y difunde `keepalive` a las demás pestañas, que cierran su aviso. |
| Frontend, al terminar la cuenta regresiva | Llama a `POST /auth/logout`, difunde `logout` a las demás pestañas y redirige a `/ingresar?motivo=inactividad&redirect=<ruta actual>`. |

Los tiempos (`idleTimeoutSeconds`, `idleWarningSeconds`) vienen siempre de `SessionInfo`:
- en producción, 900 y 60;
- en desarrollo y E2E se pueden reducir con `SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE` y `SESSION_IDLE_WARNING_SECONDS_OVERRIDE`. El esquema de entorno exige que el aviso sea menor que el tiempo de inactividad y rechaza ambos en producción.

Al cumplirse las 12 horas no hay aviso (FR-016a y el caso límite): el siguiente 401 con
`SESSION_EXPIRED` y `reason=absolute` redirige al inicio de sesión con su mensaje.

**Rationale**: el servidor solo ve solicitudes, no clics. Como las interacciones se envían como
mucho una vez por minuto, el reloj del servidor puede ir hasta 60 s «adelantado» respecto a la
última interacción. Programar el aviso desde el último contacto con el servidor elimina esa
carrera; a lo sumo, el aviso aparece unos segundos antes de lo estrictamente necesario.

**Alternatives considered**: *solo temporizador en el cliente* (no es seguro: una pestaña
manipulada nunca cerraría la sesión); *solo en el servidor* (no puede avisar a tiempo); *contar
desde la última interacción local* (el servidor podía cerrar la sesión antes de que terminara la
cuenta regresiva).

## R4. Flujo de verificación por código y retomar en el mismo navegador

**Decision**:
- El registro y la recuperación comparten la entidad `verification_flows`, con propósito
  `registration` o `password_reset`.
- El navegador se identifica con la cookie `nova_vf`: token opaco, solo su hash en la BD,
  `Path=/api/v1/auth`, `Max-Age` fijo de 2 horas.
- La **validez real** la decide el servidor con `verification_flows.expires_at`, que es variable
  (ver [data-model.md](data-model.md)):
  - al crear el flujo o reenviar el código, `expires_at = code_expires_at`;
  - al verificar, `expires_at = complete_by`.

  Así el flujo dura lo que el proceso legítimo necesite: hasta 5 reenvíos en una hora más 30
  minutos para completar. Las 2 horas de la cookie son solo un tope superior.
- `GET /auth/verification` devuelve el paso actual (`code` o `complete`), el correo enmascarado,
  los vencimientos y los intentos restantes. Así el frontend retoma el paso tras recargar
  (FR-009a).
- En otro navegador no existe la cookie y se empieza de nuevo.

**Rationale**: cumple FR-009a sin guardar estado en el cliente. La cookie `HttpOnly` evita que un
script lea el token.

**Alternatives considered**: guardar el paso en `sessionStorage` (no sirve tras cerrar la pestaña
y obliga a exponer un identificador al JavaScript); retomar escribiendo el correo (descartado por
el equipo en el clarify).

## R5. Respuestas que no revelan si un correo tiene cuenta

**Decision**:

| Caso | Comportamiento |
| :--- | :--- |
| `POST /auth/register` con un correo que **ya tiene cuenta** | Crea igualmente un flujo con `code_hash = NULL` y encola el correo «ya tienes cuenta». La respuesta es idéntica (202 con el mismo estado). Cualquier código ingresado falla como `CODE_INVALID`. |
| `POST /auth/password-reset` con un correo **sin cuenta** | Crea un flujo señuelo sin encolar ningún correo. |
| Envío de correos en general | Siempre asíncrono, por la bandeja de salida (R6), para que el tiempo de respuesta no delate nada. |
| Login de un correo inexistente | Se ejecuta igualmente una verificación Argon2 contra un hash ficticio, para igualar tiempos. |

**Rationale**: cumple FR-008, FR-014, FR-020a y SC-006.

**Alternatives considered**: responder distinto según el caso (revela cuentas); enviar el correo
de forma síncrona (el tiempo de respuesta revela si se envió).

## R6. Envío de correos y manejo de fallas del servicio de correo

**Decision**: patrón *outbox* en PostgreSQL, **sin guardar nunca el código en la bandeja**.

1. **Encolar**: el servicio de negocio inserta una fila en `email_outbox`, en la misma transacción
   que crea o actualiza el flujo. La fila guarda solo la plantilla, el destinatario, una
   referencia lógica al flujo (`verification_flow_id`) y un `payload` sin datos secretos. Al
   encolar un código nuevo, los correos de código aún pendientes del mismo flujo pasan a
   `discarded`, para que un reintento atrasado no reemplace el código más reciente.
2. **Preparar al enviar**: cada módulo registra en el worker un *preparador* por plantilla
   (`outbox.registerPreparer(template, fn)`). Para `verification_code` y `password_reset_code`,
   el módulo `auth` registra `verificationService.prepareCodeEmail(flowId, tx)`, que:
   - bloquea el flujo (`FOR UPDATE`);
   - si ya no está en `awaiting_code`, o si la fila de la bandeja se creó antes de
     `last_code_sent_at` (hay un código más reciente pedido), descarta el correo;
   - genera el código, guarda solo su HMAC en `code_hash`, fija `code_expires_at = now + 15 min`
     y `expires_at`, y devuelve el código para el cuerpo del correo.

   Así el código solo existe en memoria durante el envío, y el worker no toca tablas de `auth`
   directamente (Principio VI).
3. **Enviar**: un worker dentro del proceso de la API toma lotes cada 2 s con
   `SELECT … FOR UPDATE SKIP LOCKED`. Por cada fila abre una transacción: prepara, envía por
   SMTP con `nodemailer` (interfaz `MailProvider`) y confirma.
   - Si el envío falla, la transacción se revierte y el código preparado se descarta.
   - Si la confirmación falla después de enviar (muy raro), el código del correo no coincide;
     el estudiante usa «Reenviar código».
4. **Reintentar**: hasta 5 intentos con espera exponencial (10 s, 30 s, 1 min, 2 min, 5 min).
   Cada reintento genera un código nuevo. Después queda `failed`, se registra con `pino` y deja
   de reintentarse.
5. **Qué ve el usuario**: la API responde 202 aunque el servicio de correo esté caído. Si el
   código no llega, el usuario lo pide de nuevo con «Reenviar código» (historia de usuario 4).
6. **Limpieza**: un programador de mantenimiento (`backend/src/lib/maintenance.ts`) ejecuta cada
   hora las tareas de limpieza que **cada dueño registra para sus propias tablas**
   (`registerCleanup(name, fn)`), respetando el Principio VI:
   - `auth`: flujos vencidos hace más de 24 h, `code_sends` e intentos de login de más de 24 h;
   - middleware de límites: contadores de `rate_limit_hits` vencidos;
   - `lib/mail`: filas `sent`, `failed` y `discarded` de más de 7 días.

   Los preparadores y las limpiezas se registran al arrancar, en `server.ts`, antes de iniciar el
   worker y el programador.

**Rationale**:
- Cumple el Principio III: el código solo se guarda como hash, nunca cifrado ni en claro.
- Una falla de SMTP no rompe el registro.
- El tiempo de respuesta no revela si se envió un correo (R5).
- `SKIP LOCKED` permite varias instancias de la API sin enviar duplicados (Principio VI).
- Ni el worker ni el programador acceden a tablas de otro módulo: solo ejecutan funciones que
  cada dueño registró (Principio VI).

**Alternatives considered**:
- *Envío síncrono en la solicitud*: una falla de SMTP devolvería 500 y el tiempo delataría cuentas.
- *Guardar el código cifrado en la bandeja y borrarlo al enviar*: diseño anterior, descartado en
  `/speckit-analyze` porque el código quedaba guardado de forma reversible (contradice el
  Principio III).
- *Cola externa (Redis/BullMQ)*: dependencia nueva, innecesaria para el volumen del MVP.
- *Mantener la transacción abierta durante el envío SMTP*: aceptado. Dura unos segundos por fila
  y el volumen del MVP es bajo; si creciera, se separa la preparación del envío.

## R7. Bloqueo por intentos fallidos: «correo + dispositivo o red»

**Decision**:
- **Clave de origen**: el hash de la cookie `nova_dev` (UUID aleatorio, `HttpOnly`, 1 año,
  `Path=/api/v1/auth`). Si no hay cookie, el hash de la IP del cliente, con `trust proxy`
  configurado por la variable de entorno `TRUST_PROXY`.
- **Tabla `login_attempts`**: guarda solo los intentos fallidos.
- **Reglas (FR-015)**:
  - Por origen: 5 fallos del mismo correo y origen en 15 min → bloqueo de 15 min para ese par.
  - Global: 20 fallos del mismo correo en 1 hora → bloqueo de 15 min para todos los orígenes.
  - Cómo se calcula el fin del bloqueo:
    - por origen, si los últimos 5 fallos de `(email, origen)` ocurrieron en un lapso de
      15 min, el bloqueo dura hasta el último de esos fallos + 15 min;
    - global, si los últimos 20 fallos del correo ocurrieron en un lapso de 60 min, dura hasta el
      último + 15 min.

    Los intentos rechazados por bloqueo no se registran como fallos.
  - Un inicio de sesión exitoso borra los fallos de ese `(email, origen)`.
  - Al recuperar la contraseña se borran todos los intentos de ese correo (FR-020c).
- **Capa adicional**: `express-rate-limit` con store en PostgreSQL limita además por IP:
  - 30 solicitudes / 15 min en `/auth/login`;
  - 20 / hora en `/auth/register` y `/auth/password-reset`;
  - 60 / 15 min en `/auth/verify-email` y `/auth/resend-verification`.

  Esto frena a quien rota cookies desde una misma red.

**Rationale**: el bloqueo es una regla de negocio con efectos de dominio (se levanta al recuperar
la contraseña, cuenta solo fallos), así que vive en el módulo `auth`. El límite por IP es una
defensa genérica de infraestructura.

**Alternatives considered**: implementar el bloqueo solo con `express-rate-limit` (no distingue
fallos de aciertos con la semántica exacta ni permite levantarlo por dominio); solo IP (bloquearía
a todo el campus detrás del mismo NAT).

## R8. Store de `express-rate-limit` en PostgreSQL

**Decision**: store propio (`PgRateLimitStore`) que implementa la interfaz `Store` de
`express-rate-limit`:
- tabla `rate_limit_hits (key PK, hits, reset_at)`;
- `increment` con un `INSERT … ON CONFLICT DO UPDATE` atómico que reinicia el contador si
  `reset_at` ya pasó;
- `decrement` y `resetKey` con `UPDATE`/`DELETE`;
- implementado con `$queryRaw` con plantillas etiquetadas.

**Rationale**: lo exige el Principio VI (v2.1.0) sin agregar dependencias.

**Alternatives considered**: el store en memoria por defecto (contradice el Principio VI); un
paquete de terceros (no listado en la constitución).

## R9. Códigos de verificación

**Decision**:
- **Generación**: `crypto.randomInt(0, 1_000_000)`, rellenado a 6 dígitos, en el momento
  del envío (R6).
- **Almacenamiento**: `HMAC-SHA256(CODE_HMAC_SECRET, flowId + ":" + code)`; la comparación usa
  `timingSafeEqual`.
- **Reglas**:
  - vence a los 15 min;
  - máximo 5 intentos;
  - 60 s entre envíos;
  - máximo 5 envíos por correo por hora, sumando registro y recuperación (FR-005), contados en
    la tabla `code_sends`, que cubre también los reinicios del flujo y los flujos señuelo.

  Un código nuevo reemplaza al anterior en el mismo flujo, y un flujo nuevo del mismo correo y
  propósito marca los anteriores como `superseded`.

**Rationale**: con 5 intentos y 10⁶ combinaciones, la probabilidad de acertar es 5×10⁻⁶ por
código. El HMAC con clave impide recuperar el código desde la BD.

**Alternatives considered**: Argon2 para los códigos (innecesario con intentos limitados, y lento
en un hot path); enlace mágico (la spec pide código).

## R10. Contraseñas

**Decision**:
- **Hash**: Argon2id con `argon2` y los parámetros por defecto de la librería (m = 64 MiB, t = 3,
  p = 4), ajustables por entorno.
- **Reglas en `@nova/shared`**: `validatePasswordRules(password, email)` comprueba la longitud
  (10–128) y que no contenga el correo ni su parte local. El frontend las usa para validar
  mientras se escribe (FR-024).
- **Regla solo en el backend**: la lista de contraseñas comunes, un archivo de ~10 000 entradas
  en `backend/src/modules/auth/data/common-passwords.txt`. Es un recurso de datos, no una
  dependencia.

**Rationale**: no se manda una lista grande al navegador; el servidor tiene la última palabra.

## R11. Paquete `@nova/shared` sin paso de compilación en desarrollo

**Decision**: el `package.json` de `shared` expone condiciones de exportación:

```json
"exports": { ".": { "types": "./src/index.ts", "development": "./src/index.ts", "default": "./dist/index.js" } }
```

| Entorno | Cómo resuelve `@nova/shared` |
| :--- | :--- |
| Vite (desarrollo) | Fuente TS, por la condición `development` que Vite ya usa |
| Backend en desarrollo | Fuente TS, con `tsx watch --conditions=development` |
| TypeScript | `customConditions: ["development"]` en `tsconfig.base.json` |
| Producción | `shared` se compila con `tsc -b` y se usa `dist/` |

**Rationale**: cada integrante levanta solo su capa sin un proceso de vigilancia adicional ni
dependencias como `concurrently`. Node 24 no aplica *type stripping* dentro de `node_modules`,
así que en producción se usa la versión compilada.

**Alternatives considered**: compilar siempre `shared` en modo vigilancia (requiere orquestar
procesos); copiar los tipos a cada capa (rompe la única fuente del contrato).

## R12. OpenAPI generado desde Zod

**Decision**:
- Se usa `@asteasolutions/zod-to-openapi`, versión compatible con Zod 4.
- Los esquemas de `@nova/shared` se registran en `backend/src/openapi/registry.ts`.
- El documento se sirve en `GET /api/v1/openapi.json`.
- Una prueba de contrato (Vitest) compara las rutas, métodos, códigos de estado y esquemas
  generados con [contracts/auth.openapi.json](contracts/auth.openapi.json), que es la fuente de
  diseño. El contrato está en JSON (formato OpenAPI válido) para que la prueba lo lea con
  `JSON.parse`, sin agregar una librería de YAML.

**Rationale**: lo exige el Principio VI y evita que el contrato y el código se separen.

**Verificar al implementar**: la versión exacta de `zod-to-openapi` compatible con Zod 4. Si no
existe, se registra como enmienda PATCH antes de seguir.

## R13. Prisma 7 y el paquete `/db`

**Decision**:
- `db/` es el workspace `@nova/db`: contiene `prisma/schema.prisma`, las migraciones,
  `prisma.config.ts`, `seed.ts` y exporta el cliente generado.
- Prisma 7 usa el generador `prisma-client` y requiere un *driver adapter*: se usa el adaptador
  oficial de PostgreSQL (`@prisma/adapter-pg` con el controlador `pg`).
- Solo los repositorios de cada módulo del backend importan el cliente.
- La inmutabilidad de `audit_events` se garantiza con un trigger SQL dentro de la migración, que
  rechaza `UPDATE` y `DELETE`.

**Rationale**: es la forma soportada de Prisma 7. El trigger convierte «registro inmutable» en
una garantía de la BD y no solo una convención.

**Requiere enmienda**: `pg` y `@prisma/adapter-pg` no figuran en la constitución (ver la
Constitution Check del plan).

**Verificar al implementar**: la configuración exacta de Prisma 7 (generador, `prisma.config.ts`,
adaptador) según su documentación vigente.

## R14. Despliegue

**Decision**: **un solo origen**. En producción, Express sirve el build estático del frontend
(`frontend/dist`) con `express.static` y responde `index.html` para cualquier ruta que no sea
`/api/*`.

| Pieza | Proveedor recomendado para la demo |
| :--- | :--- |
| API + frontend | Render, *Web Service* Node (build `npm ci && npm run build`, start `npm run start -w backend`) |
| PostgreSQL 17 | Neon, plan gratuito |
| SMTP | Brevo, plan gratuito de 300 correos/día |

Variables en el panel del proveedor; `TRUST_PROXY=1` para leer la IP real.

**Rationale**: las cookies `SameSite=Strict` exigen que el frontend y la API estén en el mismo
*sitio*. Los subdominios de `onrender.com` son sitios distintos (Public Suffix List), así que
separar frontend y API en dos servicios rompería las cookies. Un solo servicio además simplifica
la demo y no necesita Docker en producción.

**Alternatives considered**: frontend estático y API en servicios separados con dominio propio
(requiere comprar un dominio); proxy reescrito en el hosting estático (depende del proveedor).
El despliegue en sí es una tarea de la fase final, no bloquea el desarrollo local.

## R15. Infraestructura de desarrollo y CI

**Decision**:
- **`docker-compose.yml`**:
  - `postgres:17` en el puerto 5432, con un script de inicio que crea las bases `nova`
    (desarrollo), `nova_test` (integración del backend) y `nova_e2e` (Playwright), para que las
    pruebas no choquen entre sí ni con los datos de desarrollo;
  - `axllent/mailpit` con SMTP en el puerto 1025 y la interfaz web y API en el 8025.
- **GitHub Actions (`.github/workflows/ci.yml`)**, con dos trabajos:
  - `quality`: `npm ci` → `prisma generate` → `prisma migrate deploy` (contra el servicio
    `postgres:17`) → `lint` → `typecheck` → `test` → `build`;
  - `e2e`: servicios `postgres:17` y `mailpit` → build → API en segundo plano → Playwright.
- **Pruebas**:

  | Tipo | Herramienta | Correo |
  | :--- | :--- | :--- |
  | Integración del backend | Supertest contra `nova_test` | `MailProvider` en memoria |
  | E2E | Playwright contra `nova_e2e` | Lee los códigos desde la API de Mailpit (`GET /api/v1/messages`) |

**Rationale**: entorno reproducible (Principio VI) y nunca se envían correos reales en pruebas.

## R16. Frontend: formularios, estado y pruebas

**Decision**:
- **Formularios**: hooks propios con validación de los esquemas Zod de `@nova/shared`, sin
  librería de formularios.
- **Estado del servidor**: TanStack Query. `['session']` es la consulta de sesión y
  `['verification', purpose]` la del flujo.
- **Pruebas de componentes**: Vitest + Testing Library con entorno `jsdom`.
- **Tailwind 4**: plugin oficial `@tailwindcss/vite`; tokens en `@theme` con variables CSS para
  el modo claro y oscuro.

**Requiere enmienda**: `jsdom`, `@testing-library/*`, `@vitejs/plugin-react` y
`@tailwindcss/vite` no figuran en la constitución. Son complementos necesarios de tecnologías ya
permitidas (ver la Constitution Check del plan).
