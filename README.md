# Nova

Banca virtual para estudiantes universitarios en Colombia. Permite recibir dinero, enviarlo a
compañeros, pagar con una tarjeta virtual, ahorrar para metas y controlar los gastos.

> **Proyecto académico** de la materia Ingeniería Web. Es un MVP demostrativo: no maneja dinero
> real ni se conecta a bancos. Todo el saldo es un libro contable simulado en pesos colombianos
> (COP).

## Estado

Spec 001 (registro, inicio de sesión y recuperación) en implementación: el backend de las cuatro
historias está en `main`. Cada funcionalidad se define primero como spec y luego se implementa
(Spec-Driven Development con [GitHub Spec Kit](https://github.com/github/spec-kit)).

## Documentos clave

- [Constitución](.specify/memory/constitution.md): principios, stack, reglas de negocio y
  seguridad. Es la norma máxima del proyecto.
- [Guía de trabajo con Spec Kit](GUIA_COMANDOS_SDD.md): instalación, ciclo de cada
  funcionalidad y trabajo en equipo.
- `specs/`: especificaciones de cada funcionalidad (se crean con `/speckit-specify`).

## Stack

React 19 + Vite + Tailwind 4 · Node.js 24 + Express 5 · PostgreSQL 17 + Prisma 7 · Zod 4 ·
TypeScript estricto · Vitest, Supertest y Playwright · npm workspaces · Docker Compose ·
GitHub Actions.

El detalle y las librerías permitidas están en la constitución.

## Hoja de ruta de specs

Las specs se crean en este orden y con estos números. Cada una pasa por tres etapas
(definición, backend y frontend) descritas en la [guía](GUIA_COMANDOS_SDD.md#4-el-proceso-de-una-spec-paso-a-paso).
Al cerrar cada etapa, actualiza su columna: `Pendiente` → `En curso` → `Listo`.

| # | Spec | Alcance | Depende de | Definición | Backend | Frontend |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 001 | `001-auth-onboarding` | Registro con correo institucional, verificación por código, aceptación de Habeas Data, login, sesión y cierre de sesión. Incluye la base del proyecto (estructura, Docker Compose, CI). | — | Listo | Listo | En curso |
| 002 | `002-cuentas-ledger` | Cuenta en COP, libro contable de doble entrada, recarga simulada, pantalla de inicio con saldo y movimientos, tarjeta «Muy pronto» de cripto. | 001 | Listo | Listo | Pendiente |
| 003 | `003-transferencias` | Envíos entre estudiantes verificados por correo o alias, idempotencia y límites. | 002 | Listo | Pendiente | Pendiente |
| 004 | `004-tarjeta-virtual` | Emitir, congelar, ver datos con reautenticación y pagos simulados. | 002 | Pendiente | Pendiente | Pendiente |
| 005 | `005-metas-ahorro` | Crear metas, aportar y retirar. | 002 | Pendiente | Pendiente | Pendiente |
| 006 | `006-presupuesto` | Presupuesto mensual por categorías con alertas. | 002 | Pendiente | Pendiente | Pendiente |
| 007 | `007-gastos-compartidos` | Dividir un gasto entre compañeros y pagar cada parte con una transferencia. | 003 | Pendiente | Pendiente | Pendiente |

**Fase 2 («Muy pronto»)**: wallet de criptoactivos. No se especifica hasta que la constitución se
enmiende para incluirla.

## Primeros pasos

1. Instala los prerrequisitos de la [guía](GUIA_COMANDOS_SDD.md#1-prerrequisitos-una-vez-por-computador):
   Node.js 24, Docker Desktop (con WSL 2) y Git.
2. Clona el repositorio y abre la carpeta en Claude Code o Antigravity.
3. Prepara el entorno (una vez):

   ```powershell
   Copy-Item .env.example .env   # completa JWT_ACCESS_SECRET y CODE_HMAC_SECRET (ver comentarios)
   npm install
   docker compose up -d          # PostgreSQL 17 (puerto 5433) y Mailpit (http://localhost:8025)
   npm run db:migrate
   ```

4. Levanta la aplicación:

   | Quién | Terminal 1 | Terminal 2 |
   | :--- | :--- | :--- |
   | Backend | `npm run dev:backend` (API en http://localhost:3000) | — |
   | Frontend | `npm run dev:backend` | `npm run dev:frontend` (app en http://localhost:5173) |

5. Verifica antes de abrir un PR: `npm run lint`, `npm run typecheck`, `npm run format:check`,
   `npm test` y `npm run build`.

Los correos de desarrollo llegan a Mailpit (http://localhost:8025), nunca a buzones reales. La
validación completa por historia está en el
[quickstart de la spec 001](specs/001-auth-onboarding/quickstart.md).

> Si las pruebas del backend fallan con errores de conexión a la base de datos, revisa que Docker
> Desktop esté abierto y ejecuta `docker compose up -d`.

## Despliegue

La demo se publica en Render + Neon + Brevo. Ver [docs/despliegue.md](docs/despliegue.md).

## Equipo

| Rol | Responsabilidad | Agente |
| :--- | :--- | :--- |
| Backend | `/backend`, `/db` y tareas `[BE]` | Claude Code |
| Frontend | `/frontend` y tareas `[FE]` y `[E2E]` | Google Antigravity |

Las specs, los contratos y el paquete `/shared` se definen entre los dos. Toda contribución entra
por PR hacia `main` con aprobación del otro integrante.
