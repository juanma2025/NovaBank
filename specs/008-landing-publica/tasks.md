---
description: "Task list for 008-landing-publica"
---

# Tasks: Página de inicio pública y tema claro/oscuro

**Input**: Design documents from `/specs/008-landing-publica/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md)

**Tests**: Incluidas (pruebas de componentes y un E2E de la página y el tema).

## Format: `[ID] [P?] [Story?] [Capa] Description`

| Etiqueta | Rama |
| :--- | :--- |
| `[FE]` | `008-landing-publica-fe` |
| `[E2E]` | `008-landing-publica-fe` |

No hay tareas `[SH]` ni `[BE]`: la definición solo agrega los documentos de la spec.

**Punto de partida**: el commit `cc70c02` de `002-cuentas-ledger-fe` ya implementa la mayor parte.
Se lleva a `008-landing-publica-fe` (creada desde `main` cuando el frontend de la 001 esté
integrado) y se quita del PR de la 002.

---

## Phase 1: Setup

- [ ] T001 [FE] Crear `008-landing-publica-fe` desde `main` y traer los cambios del commit `cc70c02` (`git cherry-pick cc70c02`). Quitarlos de `002-cuentas-ledger-fe` (`git revert cc70c02` en esa rama) para que cada PR tenga solo su spec.

---

## Phase 2: User Story 1 — Conocer Nova antes de registrarme (Priority: P1) 🎯 MVP

**Independent Test**: sin sesión, `/` muestra la página con sus secciones y accesos; con sesión, `/`
lleva a `/inicio`.

- [ ] T002 [P] [US1] [FE] Revisar `frontend/tests/LandingPage.test.tsx` contra la spec: regiones navegables, accesos «Crear cuenta» e «Iniciar sesión» hacia las rutas de la spec 001, aviso académico visible (FR-003), cripto solo con «Muy pronto» y sin acciones (FR-004), enlace a la política de datos (FR-005) y redirección a `/inicio` con sesión (FR-001).
- [ ] T003 [US1] [FE] Ajustar `frontend/src/features/landing/` y `frontend/src/lib/landing-messages.ts` a lo que falte de T002. En particular:
  - que ninguna característica pendiente (por ejemplo, gastos compartidos) se presente como acción disponible;
  - que los datos de la vista previa digan que son ilustrativos (FR-006);
  - que con «reducir movimiento» no haya animaciones ni inclinación de tarjetas.

---

## Phase 3: User Story 2 — Elegir tema claro u oscuro (Priority: P2)

- [ ] T004 [P] [US2] [FE] Revisar `frontend/tests/ThemeController.test.ts` y la prueba del selector contra FR-007–FR-009: sigue al sistema sin preferencia, persiste la elección, funciona si `localStorage` falla, y el selector anuncia el tema al que cambiará.
- [ ] T005 [US2] [FE] Verificar que `ThemeToggle` esté en el encabezado de la página pública y en el de las pantallas con sesión (`AppHeader`), y que ambos temas cumplan el contraste de WCAG 2.1 AA con los tokens de `frontend/src/styles/tokens.css`.

---

## Phase 4: Polish

- [ ] T006 [E2E] Crear `e2e/landing.spec.ts`: sin sesión, `/` muestra la página y «Crear cuenta» lleva al registro; el selector cambia `data-theme` y la elección se mantiene al recargar; a 360 px no hay desbordamiento horizontal.
- [ ] T007 [P] [FE] Registrar la revisión de accesibilidad de la página y el selector en `specs/008-landing-publica/checklists/accessibility.md` (SC-004).

---

## Dependencies & Execution Order

| Tareas | Dependen de |
| :--- | :--- |
| T001 | Definición integrada y frontend de la 001 en `main` |
| T002–T007 | T001 |
| T006 | El workspace `e2e/` (PR #18) |
