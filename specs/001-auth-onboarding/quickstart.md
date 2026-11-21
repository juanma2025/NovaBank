# Quickstart: Registro e inicio de sesión de estudiantes

**Feature**: `001-auth-onboarding` · **Plan**: [plan.md](plan.md)

Guía para levantar el entorno y comprobar que la funcionalidad cumple la spec. Los comandos son
para PowerShell en Windows.

## 1. Prerrequisitos

- Node.js 24 LTS, npm 11, Git.
- Docker Desktop con WSL 2, en ejecución.
- Prerrequisitos de Spec Kit: ver la [guía](../../GUIA_COMANDOS_SDD.md).

## 2. Preparar el entorno (una vez)

```powershell
git clone https://github.com/juanma2025/NovaBank.git
cd NovaBank
Copy-Item .env.example .env        # completar los secretos locales (ver comentarios del archivo)
npm install
docker compose up -d               # PostgreSQL 17 (5432) y Mailpit (SMTP 1025, web 8025)
npm run db:migrate                 # aplica las migraciones a la base nova
```

Para generar secretos locales, por ejemplo el de `OUTBOX_ENCRYPTION_KEY`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 3. Levantar la aplicación

| Quién | Terminal 1 | Terminal 2 |
| :--- | :--- | :--- |
| Backend | `npm run dev:backend` (API en `http://localhost:3000`) | — |
| Frontend | `npm run dev:backend` | `npm run dev:frontend` (app en `http://localhost:5173`) |

- Bandeja de correo de desarrollo: `http://localhost:8025`.
- Documento OpenAPI generado: `http://localhost:3000/api/v1/openapi.json`.

## 4. Pruebas automáticas

```powershell
npm run lint
npm run typecheck
npm test               # unitarias, componentes, integración (BD nova_test) y contrato
npm run test:e2e       # Playwright; requiere docker compose levantado
```

**Resultado esperado**: todo en verde. La prueba de contrato falla si el OpenAPI generado difiere
de [contracts/auth.openapi.yaml](contracts/auth.openapi.yaml).

## 5. Validación manual por historia de usuario

Usa un correo `@ucc.edu.co` inventado: los correos llegan a Mailpit, no a un buzón real.

### US1 — Registro (P1)

1. Abre `/registro`, escribe `ana.prueba@ucc.edu.co`, marca la política y continúa.
   → Pasas al paso del código; en Mailpit aparece un correo con 6 dígitos.
2. **Recarga la página** → sigues en el paso del código (FR-009a).
3. Escribe un código incorrecto → mensaje con los intentos restantes.
4. Escribe el código correcto → pasas al paso de nombre y contraseña.
5. Escribe una contraseña de 8 caracteres → la regla de longitud se marca en rojo mientras
   escribes.
6. Completa el nombre y una contraseña válida → ves «Hola, Ana» en `/inicio`.
7. Repite el paso 1 con `ana@gmail.com` → «Solo se aceptan correos institucionales…», y en Mailpit
   no llega nada.
8. Repite el paso 1 con `ana.prueba@ucc.edu.co` (ya registrado) → misma pantalla del código; en
   Mailpit llega el aviso «ya tienes cuenta» en lugar del código (FR-008).

### US2 — Inicio y cierre de sesión (P2)

1. Cierra sesión → vuelves a `/ingresar`. Abre `/inicio` → te devuelve a `/ingresar`.
2. Ingresa con una contraseña incorrecta → «Correo o contraseña incorrectos».
3. Haz 5 intentos fallidos → bloqueo con los minutos restantes. En **otro navegador**, ingresa con
   la contraseña correcta → entras (bloqueo por origen, FR-015).
4. Ingresa y no toques nada durante 14 min → aparece el aviso con cuenta regresiva. Pulsa «Seguir
   conectado» → sigues dentro. Repite sin pulsar → vuelves a `/ingresar` con el mensaje de
   inactividad.

   Para no esperar 14 minutos, define temporalmente `SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE` en
   `.env` (solo desarrollo y E2E; ver `.env.example`).
5. Abre `/inicio` en dos pestañas; interactúa solo en una → ninguna muestra el aviso.

### US3 — Recuperar la contraseña (P3)

1. Con una sesión abierta en el navegador A, en el navegador B abre `/recuperar` y escribe el
   correo → código en Mailpit.
2. Ingresa el código y una contraseña nueva → vas a `/ingresar` con el aviso de contraseña
   cambiada; en Mailpit llega el aviso de cambio.
3. En el navegador A, interactúa → la sesión se cerró (FR-020c).
4. Ingresa con la contraseña anterior → rechazada. Con la nueva → entras.
5. Pide recuperación para `nadie@ucc.edu.co` → misma pantalla, y en Mailpit no llega nada
   (FR-020a).

### US4 — Código nuevo (P4)

1. En el paso del código, el botón «Reenviar código» muestra una cuenta regresiva de 60 s.
2. Al terminar, reenvía → llega un código nuevo; el anterior ya no funciona.
3. Pide 5 códigos en una hora → el sexto se rechaza con el tiempo de espera.

## 6. Comprobaciones de seguridad (SC-005, SC-006)

- Revisa la salida de `npm run dev:backend` durante las pruebas anteriores: no deben aparecer
  contraseñas, códigos ni valores de cookies.
- En la BD (`docker compose exec postgres psql -U nova nova`):
  - `SELECT password_hash FROM users;` → empieza con `$argon2id$`;
  - `SELECT code_hash FROM verification_flows;` → hashes hexadecimales de 64 caracteres;
  - `SELECT payload_encrypted FROM email_outbox WHERE status='sent';` → todos `NULL`;
  - `UPDATE audit_events SET type='LOGOUT';` → error del trigger de inmutabilidad.
- En las herramientas del navegador (Application → Cookies): `nova_at`, `nova_rt` y `nova_vf`
  tienen `HttpOnly`, `Secure` y `SameSite=Strict`; `localStorage` no tiene tokens.
