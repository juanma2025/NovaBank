# Despliegue de Nova (demo)

Guía para publicar la demo académica de Nova (research R14 de la spec 001). Todos los proveedores
tienen plan gratuito.

| Pieza | Proveedor | Por qué |
| :--- | :--- | :--- |
| API + frontend | [Render](https://render.com), *Web Service* Node | Un solo servicio: Express sirve el build del frontend |
| PostgreSQL 17 | [Neon](https://neon.tech) | PostgreSQL administrado gratuito |
| Correo (SMTP) | [Brevo](https://www.brevo.com) | 300 correos/día gratis por SMTP |

> **Por qué un solo servicio.** Las cookies de sesión son `SameSite=Strict`, así que el frontend y
> la API deben estar en el mismo *sitio*. Los subdominios de `onrender.com` cuentan como sitios
> distintos (Public Suffix List): si el frontend y la API fueran dos servicios, las cookies no
> viajarían. Por eso, en producción, Express sirve `frontend/dist` (`SERVE_FRONTEND=true`).

Los nombres de menús y opciones de cada proveedor pueden cambiar. Si algo no coincide, revisa su
documentación vigente.

---

## 1. Base de datos en Neon

1. Crea un proyecto con **PostgreSQL 17** y una base llamada `nova`.
2. Copia la cadena de conexión **directa** (no la *pooled*), con `sslmode=require`. Por ejemplo:
   `postgresql://usuario:clave@ep-xxxx.us-east-2.aws.neon.tech/nova?sslmode=require`
3. Guárdala: será `DATABASE_URL`. Las migraciones de Prisma (`prisma migrate deploy`) necesitan la
   conexión directa.

## 2. Correo en Brevo

1. Crea la cuenta y **verifica un remitente** (Senders): será el `MAIL_FROM`.
2. En *SMTP & API* genera una **clave SMTP**. Anota:

   | Dato | Valor |
   | :--- | :--- |
   | Servidor | `smtp-relay.brevo.com` |
   | Puerto | `587` (STARTTLS, `SMTP_SECURE=false`) |
   | Usuario | El login SMTP que muestra Brevo |
   | Clave | La clave SMTP generada |

## 3. Servicio en Render

Crea un **Web Service** conectado al repositorio de GitHub, rama `main`.

| Campo | Valor |
| :--- | :--- |
| Runtime | Node |
| Build Command | `npm ci --include=dev && npm run db:generate && npm run build` |
| Start Command | `npm run db:deploy && npm run start -w backend` |
| Health Check Path | `/api/v1/health` |

- `--include=dev` es necesario: con `NODE_ENV=production`, `npm ci` omite las dependencias de
  desarrollo, y ahí están `typescript`, `vite` y la CLI de `prisma`, que se usan para compilar y
  migrar.
- `npm run build` compila `shared`, `db`, `backend` y `frontend`, en ese orden.
- El *Start Command* aplica las migraciones pendientes antes de arrancar: en el plan gratuito no
  hay *pre-deploy command*, así que ese paso se hace al iniciar.

### Variables de entorno

Configúralas en *Environment*. La aplicación las valida al arrancar y no inicia si falta una.

| Variable | Valor |
| :--- | :--- |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `APP_ORIGIN` | `https://<tu-servicio>.onrender.com` (la URL que asigna Render) |
| `TRUST_PROXY` | `1` (Render pone un proxy delante: así se lee la IP real para límites y bloqueos) |
| `SERVE_FRONTEND` | `true` |
| `LOG_LEVEL` | `info` |
| `DATABASE_URL` | La cadena directa de Neon |
| `JWT_ACCESS_SECRET` | Secreto aleatorio nuevo (ver abajo) |
| `CODE_HMAC_SECRET` | Otro secreto aleatorio nuevo |
| `STUDENT_EMAIL_DOMAINS` | `ucc.edu.co` (separa con comas si agregas universidades) |
| `TOPUP_MIN_AMOUNT` | `1000` (recarga mínima en pesos) |
| `TOPUP_MAX_AMOUNT` | `500000` (recarga máxima en pesos) |
| `TOPUP_DAILY_LIMIT` | `2000000` (tope diario de recargas por estudiante, en hora de Colombia) |
| `TRANSFER_MIN_AMOUNT` | `1000` (transferencia mínima en pesos) |
| `TRANSFER_MAX_AMOUNT` | `500000` (transferencia máxima en pesos) |
| `TRANSFER_DAILY_LIMIT` | `1000000` (tope diario de lo enviado por estudiante, en hora de Colombia) |
| `TRANSFER_REAUTH_THRESHOLD` | `200000` (por encima de este monto se pide la contraseña; regla: mínimo ≤ umbral ≤ máximo ≤ tope) |
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | Login SMTP de Brevo |
| `SMTP_PASS` | Clave SMTP de Brevo |
| `MAIL_FROM` | `Nova <remitente-verificado@tu-dominio>` |

**No definas** `PORT`, porque Render la asigna. Tampoco definas
`SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE` ni `SESSION_IDLE_WARNING_SECONDS_OVERRIDE`: están
prohibidas en producción y la aplicación no arrancaría.

Genera cada secreto con:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Usa secretos **distintos** a los de tu `.env` local y nunca los subas a git.

---

## 4. Comprobar el despliegue

1. `https://<tu-servicio>.onrender.com/api/v1/health` → `{"status":"ok"}`.
2. Abre `https://<tu-servicio>.onrender.com/registro` y regístrate con un correo `@ucc.edu.co`
   real: el código llega desde Brevo.
3. En las herramientas del navegador (Application → Cookies), `nova_at`, `nova_rt` y `nova_vf` deben
   tener `HttpOnly`, `Secure` y `SameSite=Strict`.
4. Revisa los logs en Render: no deben aparecer contraseñas, códigos ni cookies.

## 5. Limitaciones del plan gratuito

- **El servicio se duerme** tras unos minutos sin tráfico, y la primera solicitud tarda en
  despertarlo (puede ser cerca de un minuto). Abre la página un rato antes de la demo.
- Mientras duerme, el worker de correos no corre. Los correos pendientes se envían al despertar,
  pero los códigos vencen a los 15 minutos: si uno no llega, usa «Reenviar código».
- Neon y Brevo tienen cuotas mensuales y diarias. Para una demo de clase sobran.

## 6. Actualizar la demo

Cada integración en `main` vuelve a desplegar si activas *Auto-Deploy* en Render. Las migraciones
nuevas se aplican solas al arrancar (`npm run db:deploy`).
