# Nova

Banca virtual para estudiantes universitarios en Colombia. Permite recibir dinero, enviarlo a
compañeros, pagar con una tarjeta virtual, ahorrar para metas y controlar los gastos.

> **Proyecto académico** de la materia Ingeniería Web. Es un MVP demostrativo: no maneja dinero
> real ni se conecta a bancos. Todo el saldo es un libro contable simulado en pesos colombianos
> (COP).

## Estado

En fase de especificación. Todavía no hay código: cada funcionalidad se define primero como spec
y luego se implementa (Spec-Driven Development con
[GitHub Spec Kit](https://github.com/github/spec-kit)).

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
| 001 | `001-auth-onboarding` | Registro con correo institucional, verificación por código, aceptación de Habeas Data, login, sesión y cierre de sesión. Incluye la base del proyecto (estructura, Docker Compose, CI). | — | Listo | En curso | Pendiente |
| 002 | `002-cuentas-ledger` | Cuenta en COP, libro contable de doble entrada, recarga simulada, pantalla de inicio con saldo y movimientos, tarjeta «Muy pronto» de cripto. | 001 | Pendiente | Pendiente | Pendiente |
| 003 | `003-transferencias` | Envíos entre estudiantes verificados por correo o alias, idempotencia y límites. | 002 | Pendiente | Pendiente | Pendiente |
| 004 | `004-tarjeta-virtual` | Emitir, congelar, ver datos con reautenticación y pagos simulados. | 002 | Pendiente | Pendiente | Pendiente |
| 005 | `005-metas-ahorro` | Crear metas, aportar y retirar. | 002 | Pendiente | Pendiente | Pendiente |
| 006 | `006-presupuesto` | Presupuesto mensual por categorías con alertas. | 002 | Pendiente | Pendiente | Pendiente |
| 007 | `007-gastos-compartidos` | Dividir un gasto entre compañeros y pagar cada parte con una transferencia. | 003 | Pendiente | Pendiente | Pendiente |

**Fase 2 («Muy pronto»)**: wallet de criptoactivos. No se especifica hasta que la constitución se
enmiende para incluirla.

## Primeros pasos

1. Instala los prerrequisitos de la [guía](GUIA_COMANDOS_SDD.md#1-prerrequisitos-una-vez-por-computador).
2. Clona el repositorio y abre la carpeta en Claude Code o Antigravity.
3. Toma la siguiente spec pendiente de la hoja de ruta y sigue el proceso de la guía.

Las instrucciones para levantar la aplicación (`docker compose up`, `npm install`,
`npm run dev`) se agregarán cuando se implemente la spec 001.

## Equipo

| Rol | Responsabilidad | Agente |
| :--- | :--- | :--- |
| Backend | `/backend`, `/db` y tareas `[BE]` | Claude Code |
| Frontend | `/frontend` y tareas `[FE]` y `[E2E]` | Google Antigravity |

Las specs, los contratos y el paquete `/shared` se definen entre los dos. Toda contribución entra
por PR hacia `main` con aprobación del otro integrante.
