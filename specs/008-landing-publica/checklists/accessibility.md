# Auditoría de Accesibilidad WCAG 2.1 AA — Spec 008 (Experiencia pública y tema)

**Fecha**: 2026-11-23  
**Alcance**: Rutas públicas (`/`, `/caracteristicas`, `/estudiantes`), `PublicLayout`, `ThemeToggle`, sistema visual Dark OLED & Light blanco opaco (`tokens.css`, `index.css`, `transitions-landing.css`) y vistas de acceso/autenticadas que incorporan `ThemeToggle`.  
**Referencia**: Constitución v2.3.0 (Principio IV), `specs/008-landing-publica/spec.md` (SC-004).

---

## 1. Contraste cromático (WCAG 2.1 AA ≥ 4.5:1 texto normal)

Todas las razones de contraste fueron calculadas por luminancia relativa WCAG 2.1 sobre los tokens reales de `frontend/src/styles/tokens.css`.

### Modo Claro — Blanco opaco / porcelana suave (`#EAEDF2` lienzo, `#F4F6F9` tarjetas)

| Uso | Primer plano | Fondo | Razón | Estado |
| :--- | :--- | :--- | ---: | :--- |
| Texto principal sobre lienzo | `#0B0D12` | `#EAEDF2` | **16.56:1** | Cumple (AAA) |
| Texto principal sobre tarjeta | `#0B0D12` | `#F4F6F9` | **17.95:1** | Cumple (AAA) |
| Texto secundario sobre lienzo | `#374151` | `#EAEDF2` | **8.78:1** | Cumple (AAA) |
| Texto secundario sobre tarjeta | `#374151` | `#F4F6F9` | **9.52:1** | Cumple (AAA) |
| Texto atenuado sobre lienzo | `#4B5563` | `#EAEDF2` | **6.44:1** | Cumple (AA) |
| Texto atenuado sobre tarjeta | `#4B5563` | `#F4F6F9` | **6.98:1** | Cumple (AA) |
| Enlace / acento marca sobre lienzo | `#0052A3` | `#EAEDF2` | **6.54:1** | Cumple (AA) |
| Enlace / acento marca sobre tarjeta | `#0052A3` | `#F4F6F9` | **7.09:1** | Cumple (AAA) |
| Botón primario «Crear cuenta» | `#F8FAFC` | `#005BB5` | **6.34:1** | Cumple (AA) |
| Acento violeta sobre tarjeta | `#6D28D9` | `#F4F6F9` | **6.56:1** | Cumple (AA) |
| Estado éxito (saldo verificado / abonos) | `#166534` | `#E7F6EC` | **6.37:1** | Cumple (AA) |
| Estado informativo | `#0369A1` | `#E8F3FB` | **5.27:1** | Cumple (AA) |

> Sin fondo `#FFFFFF` puro ni efecto neón en modo claro: las tarjetas emplean superficie opaca `#F4F6F9` con contorno estático sólido de marca (`rgba(0, 91, 181, 0.34)`).

### Modo Oscuro — Negro OLED sólido (`#000000` lienzo, `#0A0A0D` / `#111116` tarjetas)

| Uso | Primer plano | Fondo | Razón | Estado |
| :--- | :--- | :--- | ---: | :--- |
| Texto principal sobre lienzo OLED | `#F5F7FA` | `#000000` | **19.57:1** | Cumple (AAA) |
| Texto principal sobre tarjeta | `#F5F7FA` | `#0A0A0D` | **18.42:1** | Cumple (AAA) |
| Texto secundario sobre tarjeta | `#B8C0CE` | `#0A0A0D` | **10.80:1** | Cumple (AAA) |
| Texto atenuado sobre tarjeta | `#98A2B3` | `#0A0A0D` | **7.68:1** | Cumple (AAA) |
| Texto atenuado sobre superficie `#111116` | `#98A2B3` | `#111116` | **7.31:1** | Cumple (AAA) |
| Enlace / acento azul hielo sobre tarjeta | `#7DD3FC` | `#0A0A0D` | **11.86:1** | Cumple (AAA) |
| Botón primario «Crear cuenta» | `#03111C` | `#38BDF8` | **8.90:1** | Cumple (AAA) |
| Acento violeta sobre tarjeta | `#A78BFA` | `#0A0A0D` | **7.27:1** | Cumple (AAA) |
| Estado éxito sobre tarjeta | `#86EFAC` | `#0A0A0D` | **14.08:1** | Cumple (AAA) |
| Estado error crítico (solo errores) | `#FCA5A5` | `#0A0A0D` | **10.42:1** | Cumple (AAA) |

> La paleta de marca usa exclusivamente azul hielo (`#38BDF8` / `#005BB5`) y violeta (`#A78BFA` / `#6D28D9`). El rojo (`--color-danger`) se reserva únicamente para errores y alertas críticas (retirado de los movimientos de ejemplo de `HeroPreview`).

---

## 2. Semántica, landmarks y teclado

- [X] **Landmarks presentes en todas las rutas públicas**: `<header>` (`banner`), `<nav aria-label="Navegación principal">` (`navigation`), `<main>` (`main`) y `<footer>` (`contentinfo`).
- [X] **Jerarquía de encabezados limpia**: exactamente un `<h1>` por ruta (`/`, `/caracteristicas`, `/estudiantes`), seguido de `<h2>` y `<h3>` sin saltos de nivel.
- [X] **Estado activo anunciado**: los enlaces de la barra superior marcan `aria-current="page"` en la ruta activa.
- [X] **Selector de tema accesible (`ThemeToggle`)**: botón nativo `type="button"` con `aria-pressed={isDark}`, `aria-label` descriptivo del tema objetivo («Cambiar a modo oscuro» / «Cambiar a modo claro»), presente en `PublicLayout`, `AuthLayout`, `AppHeader` y `AppShell`.
- [X] **Foco visible**: `:focus-visible` global con contorno de `2px solid var(--color-focus-ring)` y `outline-offset: 2px` de alto contraste en ambos temas.
- [X] **Objetivos táctiles ≥ 44 px**: todos los enlaces del navbar, pestañas de navegación, `ThemeToggle` (`h-11 w-11`), enlaces «Leer política de datos» y enlace del footer cumplen `min-h-11` (`44 px`).

---

## 3. Movimiento y `prefers-reduced-motion`

- [X] **Transiciones interactivas ≤ 400 ms** (`transitions-dev`):
  - `18-texts-reveal` (`.t-stagger`): `400 ms` (`--duration-slow`) + paso `40 ms`.
  - `t-surface-enter` (cambio de ruta pública): `250 ms` (`--duration-fast`).
  - `16-tabs-sliding` (`.t-tabs-pill` en navbar): `250 ms` (`--duration-fast`).
  - `09-icon-swap` (`ThemeToggle`): `250 ms` (`--duration-fast`).
  - `24-learn-more-hover` (`LearnMoreChevron`): `350 ms` (`--duration-medium`).
- [X] **Contorno iluminado en modo oscuro**: animación CSS pura (`@property --nova-border-angle` + `conic-gradient` + `mask-composite: exclude`, cero JS) solo sobre tarjetas `.nova-glass` en modo oscuro.
- [X] **Desactivación completa bajo `prefers-reduced-motion: reduce`**: todas las animaciones y transiciones quedan deshabilitadas (`0.01ms` / `animation: none !important`), y `.nova-glass::before` pasa a un contorno estático limpio `linear-gradient(135deg, var(--color-brand-ice), var(--color-brand-violet))`.

---

## 4. Diseño adaptable desde 360 px

- [X] **Navbar adaptativo sin desbordamiento horizontal**: en `360 px` la fila superior ubica marca + `ThemeToggle` + «Iniciar sesión» + «Crear cuenta» (`≤ 336 px` internos) y la barra de pestañas (`Inicio`, `Características`, `Estudiantes`) se alinea en una segunda fila centrada dentro de un único `<nav>`; en `≥ 768 px` (`md:`) colapsa en una única barra horizontal.
- [X] **Verificación automatizada**: cubierta en `e2e/landing.spec.ts` bajo el proyecto `movil-360` (`360×740`) verificando `scrollWidth <= innerWidth` en `/`, `/caracteristicas` y `/estudiantes`.
