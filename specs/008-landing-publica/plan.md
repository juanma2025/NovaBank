# Implementation Plan: Página de inicio pública y tema claro/oscuro

**Branch**: `008-landing-publica` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-landing-publica/spec.md`

## Summary

La dirección principal muestra una página de presentación a quien no tiene sesión y lleva al inicio de
la cuenta a quien sí. Un selector de tema permite elegir claro u oscuro; sin elección, se sigue la
preferencia del sistema. Es una funcionalidad **solo de frontend**: no hay endpoints, contratos,
tablas ni cambios en `@nova/shared`, así que no hay `research.md`, `data-model.md` ni `contracts/`.

## Technical Context

**Language/Version**: igual que la spec 001 (TypeScript 6.0, React 19, Vite, Tailwind 4).

**Primary Dependencies**: **ninguna nueva.**

**Storage**: solo la preferencia de tema en `localStorage['nova:theme']` (`light` | `dark`), leída y
escrita dentro de `try/catch`. No es un token ni un dato personal (Principio III prohíbe guardar tokens
en `localStorage`, no preferencias visuales).

**Testing**: Vitest + Testing Library en `frontend/tests`, y Playwright en `e2e/`.

**Scale/Scope**: 1 página, 1 control de tema, 0 endpoints.

## Constitution Check

| Principio / regla | Verificación | Estado |
| :--- | :--- | :--- |
| II. SDD | La implementación existente se formaliza en esta spec antes de integrarse | ✅ |
| III. Sin tokens en `localStorage` | Solo se guarda la preferencia de tema | ✅ |
| IV. Estética y temas | Tokens CSS para claro y oscuro; por defecto, la preferencia del sistema; transiciones ≤ 400 ms y `prefers-reduced-motion` | ✅ |
| IV. Patrón «Muy pronto» | La wallet cripto aparece solo como tarjeta informativa con esa etiqueta (FR-004) | ✅ |
| IV. Accesibilidad | WCAG 2.1 AA (FR-010) | ✅ |
| V. Simulación segura | Aviso visible de proyecto académico con dinero simulado (FR-003); datos de ejemplo estáticos (FR-006) | ✅ |
| VI. Monolito modular | `features/landing/` en el frontend; sin backend | ✅ |

**Estado del gate**: ✅ aprobado, sin violaciones ni enmiendas.

## Project Structure

```text
specs/008-landing-publica/
├── spec.md · plan.md · tasks.md
└── checklists/requirements.md

frontend/src/                                  # [FE]
├── app/router.tsx                             # "/" → LandingPage sin sesión; /inicio con sesión
├── features/landing/pages/LandingPage.tsx
├── features/landing/components/HeroPreview.tsx · FeaturesBento.tsx
├── components/ThemeToggle.tsx · TiltCard.tsx · LearnMoreChevron.tsx
├── lib/theme-controller.ts · use-theme.ts · landing-messages.ts
└── styles/tokens.css · transitions-landing.css

frontend/tests/LandingPage.test.tsx · ThemeController.test.ts
e2e/landing.spec.ts                            # [E2E]
```

## Diseño del frontend

| Ruta | Pantalla | Notas |
| :--- | :--- | :--- |
| `/` sin sesión | `LandingPage`: encabezado (navegación por anclas, `ThemeToggle`, accesos), presentación con vista previa ilustrativa, «Qué hace Nova», características, «Para estudiantes», cierre y pie con el aviso académico y el enlace a la política de datos | Carga diferida; textos en `landing-messages.ts` |
| `/` con sesión | Redirección a `/inicio` | Spec 002 |
| Todas | `ThemeToggle` en el encabezado | `ThemeController`: sistema por defecto, preferencia explícita persistida, `data-theme` en `<html>` |

## Guía para `/speckit-tasks`

Solo `[FE]` y `[E2E]`. Como el código ya existe, las tareas describen qué verificar y ajustar al
moverlo a `008-landing-publica-fe`.
