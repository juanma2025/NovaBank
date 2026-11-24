# Implementation Plan: Página de inicio pública y tema claro/oscuro

**Branch**: `008-landing-publica-fe` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-landing-publica/spec.md`

## Summary

Experiencia pública multipágina minimalista (`/`, `/caracteristicas`, `/estudiantes`) compartiendo
un `PublicLayout` con navbar fijo de vidrio esmerilado, indicador deslizante de pestaña activa y
accesos únicos a «Iniciar sesión» y «Crear cuenta» en la barra superior (sin repeticiones al final).
El sistema visual ofrece modo oscuro OLED (`#000000` + cards carbón profundo con contornos iluminados
azul hielo → violeta animados en CSS puro con `@property` + `conic-gradient` + `mask`, detenidos bajo
`prefers-reduced-motion`) y modo claro porcelana/blanco opaco (`#EAEDF2` / `#F4F6F9` con bordes
sólidos estáticos de marca). Es una funcionalidad **100 % frontend**: sin endpoints, tablas,
contratos ni librerías nuevas.

## Technical Context

**Language/Version**: TypeScript ~6.0.3 estricto (cero `any`), React 19, Vite, Tailwind CSS 4 (`@theme`).

**Primary Dependencies**: **ninguna nueva** (solo el stack cerrado de la constitución v2.3.0).

**Storage**: preferencia visual no sensible en `localStorage['nova:theme']` (`light` | `dark`),
encapsulada en la clase POO `ThemeController` dentro de `try/catch`.

**Testing**: Vitest + Testing Library + jsdom en `frontend/tests`, y Playwright en `e2e/`.

**Scale/Scope**: 3 rutas públicas lazy (`/`, `/caracteristicas`, `/estudiantes`), 1 layout compartido
(`PublicLayout`), 1 controlador POO (`ThemeController`) y 1 selector accesible (`ThemeToggle`).

## Constitution Check

| Principio / regla | Verificación | Estado |
| :--- | :--- | :--- |
| II. SDD | Spec, plan y tareas actualizados antes de modificar el código | ✅ |
| III. Sin tokens en `localStorage` | `ThemeController` guarda únicamente `'light' \| 'dark'` con `try/catch` | ✅ |
| IV. Paleta y estética Apple-grade | Azul hielo y violeta para marca/contornos; rojo reservado a errores; Dark OLED `#000000` y Light blanco opaco `#EAEDF2`/`#F4F6F9` | ✅ |
| IV. Fluidez y movimiento | Transiciones interactivas y entradas `t-*` ≤ 400 ms; contorno luminoso ambiental en modo oscuro detenido por completo bajo `prefers-reduced-motion: reduce` | ✅ |
| IV. Patrón «Muy pronto» | «Wallet cripto» solo informativa en `/caracteristicas`, sin acciones ni backend (FR-004) | ✅ |
| IV. Accesibilidad | WCAG 2.1 AA (contraste ≥ 4.5:1 en ambos temas, foco visible, ≥ 44 px, 360 px sin desborde) | ✅ |
| V. Simulación segura | Aviso académico visible; vista previa estática marcada como ilustrativa (FR-003, FR-006) | ✅ |
| VI. Arquitectura modular | `features/landing/` en frontend con chunks `React.lazy` por página; sin tocar backend/db/shared | ✅ |

**Estado del gate**: ✅ aprobado, sin violaciones ni enmiendas.

## Project Structure

```text
specs/008-landing-publica/
├── spec.md · plan.md · tasks.md
└── checklists/
    ├── requirements.md
    └── accessibility.md          # [FE] T007

frontend/src/                     # [FE]
├── app/router.tsx                # "/", "/caracteristicas", "/estudiantes" (React.lazy)
├── components/
│   ├── ThemeToggle.tsx           # 09-icon-swap (Moon ↔ Sun), ≥ 44 px
│   ├── LearnMoreChevron.tsx      # 24-learn-more-hover
│   ├── AppHeader.tsx · AppShell.tsx · AuthLayout.tsx  # incluyen ThemeToggle
├── features/landing/
│   ├── components/
│   │   ├── PublicLayout.tsx      # Navbar fijo (16-tabs-sliding) + footer minimalista sin CTAs repetidos
│   │   ├── HeroPreview.tsx       # Card ilustrativa COP en vidrio/OLED con borde iluminado
│   │   └── FeaturesBento.tsx     # Cards de hoja de ruta + Wallet cripto «Muy pronto»
│   └── pages/
│       ├── LandingPage.tsx       # "/" minimalista (18-texts-reveal + HeroPreview + 2 accesos breves)
│       ├── FeaturesPage.tsx      # "/caracteristicas"
│       └── StudentsPage.tsx      # "/estudiantes"
├── lib/
│   ├── theme-controller.ts       # Clase POO ThemeController
│   ├── use-theme.ts              # Hook React useTheme()
│   └── landing-messages.ts       # Textos es-CO centralizados (reexportado por messages.ts)
└── styles/
    ├── tokens.css                # Dark #000000 + Light blanco opaco #EAEDF2/#F4F6F9
    ├── index.css                 # .nova-card-border (conic-gradient animado en dark, sólido en light)
    └── transitions-landing.css   # t-* (18-texts-reveal, 24-learn-more-hover, @property borde dark)

frontend/tests/LandingPage.test.tsx · ThemeController.test.ts
e2e/landing.spec.ts               # [E2E] T006
```

## Diseño del frontend

| Ruta | Pantalla (`React.lazy`) | Contenido principal |
| :--- | :--- | :--- |
| `/` (sin sesión) | `LandingPage` | Primera vista despejada: titular corto, subtítulo 1–2 líneas, una card de vista previa ilustrativa en COP y 2 accesos breves hacia `/caracteristicas` y `/estudiantes`. Sin botones de acceso repetidos al final. |
| `/` (con sesión) | Redirección a `/inicio` | Dashboard de la cuenta (spec 002). |
| `/caracteristicas` | `FeaturesPage` | «Qué hace Nova» + cards escaneables de la hoja de ruta (sin acciones falsas) + «Wallet cripto · Muy pronto». |
| `/estudiantes` | `StudentsPage` | Público universitario en Colombia, pilares de seguridad (`HttpOnly`, código de 6 dígitos, Ley 1581 → `/privacidad`) y carácter académico simulado. |
| Todas | `ThemeToggle` | Disponible en `PublicLayout`, `AuthLayout`, `AppHeader` y `AppShell`. |

### Notas técnicas del contorno iluminado (Dark vs. Light)

- En **modo oscuro** (`:root[data-theme='dark']` y `@media (prefers-color-scheme: dark)` cuando no
  hay override `light`), `.nova-surface-card` aplica un pseudo-elemento `::before` con `mask-composite: exclude`
  y `@property --nova-border-angle` rotando un `conic-gradient` con `--color-brand-ice` y `--color-brand-violet`,
  acompañado de un halo sutil OLED. Bajo `@media (prefers-reduced-motion: reduce)`, la animación se
  anula (`animation: none`) dejando un borde estático azul hielo/violeta limpio.
- En **modo claro** (`:root` base y `:root[data-theme='light']`), `.nova-surface-card` renderiza
  fondo blanco humo opaco (`#F4F6F9`) sobre lienzo porcelana (`#EAEDF2`) con borde sólido estático
  en acento de marca (`--color-card-border-light`), sin pseudo-elemento animado ni resplandor neón.
