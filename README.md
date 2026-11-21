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

React 19 + Vite + Tailwind · Node.js 24 + Express · PostgreSQL 16 + Prisma · TypeScript estricto ·
Vitest, Supertest y Playwright · Docker Compose · GitHub Actions.

El detalle y las librerías permitidas están en la constitución.

## Hoja de ruta de specs

Antes de ejecutar `/speckit-specify`, reserva aquí el número y el responsable en un commit a
`main`. Las specs se pueden escribir en paralelo, pero se implementan respetando las dependencias.

| # | Spec | Alcance | Depende de | Responsable | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 001 | `001-auth-onboarding` | Registro con correo institucional, verificación por código, aceptación de Habeas Data, login, sesión y cierre de sesión. Incluye la base del proyecto (estructura, Docker Compose, CI). | — | Por asignar | Pendiente |
| 002 | `002-cuentas-ledger` | Cuenta en COP, libro contable de doble entrada, recarga simulada, pantalla de inicio con saldo y movimientos, tarjeta «Muy pronto» de cripto. | 001 | Por asignar | Pendiente |
| 003 | `003-transferencias` | Envíos entre estudiantes verificados por correo o alias, idempotencia y límites. | 002 | Por asignar | Pendiente |
| 004 | `004-tarjeta-virtual` | Emitir, congelar, ver datos con reautenticación y pagos simulados. | 002 | Por asignar | Pendiente |
| 005 | `005-metas-ahorro` | Crear metas, aportar y retirar. | 002 | Por asignar | Pendiente |
| 006 | `006-presupuesto` | Presupuesto mensual por categorías con alertas. | 002 | Por asignar | Pendiente |
| 007 | `007-gastos-compartidos` | Dividir un gasto entre compañeros y pagar cada parte con una transferencia. | 003 | Por asignar | Pendiente |

**Fase 2 («Muy pronto»)**: wallet de criptoactivos. No se especifica hasta que la constitución se
enmiende para incluirla.

## Primeros pasos

1. Instala los prerrequisitos de la [guía](GUIA_COMANDOS_SDD.md#1-prerrequisitos-una-vez-por-computador).
2. Clona el repositorio y abre la carpeta en Claude Code o Antigravity.
3. Reserva una spec en la tabla de arriba y sigue el ciclo de la guía.

Las instrucciones para levantar la aplicación (`docker compose up`, `npm install`,
`npm run dev`) se agregarán cuando se implemente la spec 001.

## Equipo

Dos integrantes. Toda contribución entra por PR hacia `main` con aprobación del otro integrante.
