---
description: "Task list for 008-landing-publica"
---

# Tasks: Página de inicio pública y tema claro/oscuro

**Input**: Design documents from `/specs/008-landing-publica/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md)

**Tests**: Incluidas (pruebas unitarias/componentes en Vitest y E2E en Playwright).

## Format: `[ID] [P?] [Story?] [Capa] Description`

| Etiqueta | Rama |
| :--- | :--- |
| `[FE]` | `008-landing-publica-fe` |
| `[E2E]` | `008-landing-publica-fe` |

No hay tareas `[SH]` ni `[BE]`: es una funcionalidad 100 % frontend.

---

## Phase 1: Setup

- [X] T001 [FE] Crear `008-landing-publica-fe` trayendo los cambios base del commit `cc70c02` (`git cherry-pick cc70c02`) y mantenerlos quitados de `002-cuentas-ledger-fe` (`git revert cc70c02`) para que cada PR corresponda solo a su spec.

---

## Phase 2: User Story 1 — Conocer Nova antes de registrarme (Priority: P1) 🎯 MVP

**Independent Test**: sin sesión, `/` muestra la portada minimalista y el navbar permite navegar a
`/caracteristicas` y `/estudiantes` con accesos únicos a «Iniciar sesión» y «Crear cuenta»; con
sesión, `/` redirige a `/inicio`.

- [X] T002 [P] [US1] [FE] Actualizar `frontend/tests/LandingPage.test.tsx` contra la spec multipágina:
  - navegación por rutas `/`, `/caracteristicas` y `/estudiantes` desde el navbar;
  - «Iniciar sesión» (`/ingresar`) y «Crear cuenta» (`/registro`) presentes únicamente en el navbar (sin duplicación al cierre ni en el footer);
  - landmarks semánticos (`banner`, `navigation`, `main`, `contentinfo`), aviso académico visible (FR-003), vista previa ilustrativa (FR-006), «Wallet cripto · Muy pronto» sin acciones (FR-004), enlace a `/privacidad` (FR-005) y redirección `/` → `/inicio` con sesión (FR-001).
- [X] T003 [US1] [FE] Rediseñar la experiencia pública multipágina en `frontend/src/features/landing/` y `frontend/src/lib/landing-messages.ts`:
  - crear `PublicLayout.tsx` (navbar superior fijo con menú de rutas `16-tabs-sliding`, `ThemeToggle`, botones únicos «Iniciar sesión» / «Crear cuenta» y footer minimalista con `/privacidad`);
  - despejar `LandingPage.tsx` (`/`) dejando titular corto, subtítulo 1–2 líneas, una card de vista previa ilustrativa en COP y 2 accesos breves hacia `/caracteristicas` y `/estudiantes`;
  - crear `FeaturesPage.tsx` (`/caracteristicas`) con capacidades de hoja de ruta (sin acciones falsas) + «Wallet cripto · Muy pronto»;
  - crear `StudentsPage.tsx` (`/estudiantes`) con público objetivo, pilares de seguridad y carácter académico;
  - registrar las rutas lazy `/`, `/caracteristicas` y `/estudiantes` en `frontend/src/app/router.tsx`.

---

## Phase 3: User Story 2 — Elegir tema claro u oscuro (Priority: P2)

- [X] T004 [P] [US2] [FE] Verificar `frontend/tests/ThemeController.test.ts` y pruebas del selector contra FR-007–FR-009: sigue al sistema sin preferencia, persiste la elección en `localStorage['nova:theme']`, tolera fallos de `localStorage` y anuncia el tema objetivo con ARIA.
- [X] T005 [US2] [FE] Refinar el sistema visual Dark & Light en `frontend/src/styles/tokens.css`, `index.css` y `transitions-landing.css` y asegurar `ThemeToggle` en `PublicLayout`, `AuthLayout`, `AppHeader` y `AppShell`:
  - Dark: fondo negro sólido `#000000`, cards `#0A0A0D`/`#111116`, contorno iluminado azul hielo → violeta con animación CSS pura (`@property` + `conic-gradient` + `mask`), detenida por completo bajo `prefers-reduced-motion: reduce`;
  - Light: fondo blanco opaco/porcelana (`#EAEDF2`), cards blanco humo opaco (`#F4F6F9`) y contornos sólidos estáticos de marca (sin blanco `#FFFFFF` puro como lienzo ni efecto neón);
  - contraste WCAG 2.1 AA (≥ 4.5:1) en ambos temas.

---

## Phase 4: Polish

- [X] T006 [E2E] Crear `e2e/landing.spec.ts`: sin sesión, `/` muestra la portada minimalista, el navbar navega a `/caracteristicas` y `/estudiantes`, «Crear cuenta» lleva al registro, el selector cambia `data-theme` y persiste al recargar, y a 360 px no hay desbordamiento horizontal.
- [X] T007 [P] [FE] Registrar la auditoría WCAG 2.1 AA (contrastes Dark OLED + Light blanco opaco, teclado, `prefers-reduced-motion` y 360 px) en `specs/008-landing-publica/checklists/accessibility.md` (SC-004).

---

## Dependencies & Execution Order

| Tareas | Dependen de |
| :--- | :--- |
| T001 | Definición de 008 integrada y base frontend disponible |
| T002–T007 | T001 |
| T006 | Workspace `e2e/` |
