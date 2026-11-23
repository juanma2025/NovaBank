# Auditoría de Accesibilidad y Rendimiento — Spec 002 (`002-cuentas-ledger`)

**Fecha**: 2026-11-23  
**Alcance**: Pantallas `/inicio` (`HomePage`), `/recargar` (`TopupPage`), `/movimientos` (`MovementsPage`), navegación `AppShell` (escritorio + móvil 360 px), `BalanceCard`, `ComingSoonCard`, `MovementList`/`MovementItem`, `AmountInput` y `TopupConfirmDialog`.  
**Referencia**: Constitución v2.3.0 (Principio IV), `specs/002-cuentas-ledger/spec.md` (SC-001, SC-006).

---

## 1. Contraste WCAG 2.1 AA (≥ 4.5:1 texto normal)

Verificado por luminancia relativa WCAG 2.1 sobre `frontend/src/styles/tokens.css`.

### Modo Claro

| Uso | Primer plano | Fondo | Razón | Estado |
| :--- | :--- | :--- | ---: | :--- |
| Texto principal sobre lienzo | `#0B0D12` | `#F5F5F7` | **17.85:1** | Cumple (AAA) |
| Texto secundario sobre lienzo | `#434B59` | `#F5F5F7` | **8.07:1** | Cumple (AAA) |
| Texto atenuado / fechas | `#586170` | `#F5F5F7` | **5.74:1** | Cumple (AA) |
| Enlace / acento marca | `#005BB5` | `#FFFFFF` | **6.64:1** | Cumple (AA) |
| Botón primario «Recargar» / «Continuar» | `#FFFFFF` | `#0066CC` | **5.57:1** | Cumple (AA) |
| Estado éxito / abonos (`+`) | `#15803D` | `#ECFDF5` | **4.76:1** | Cumple (AA) |
| Estado error / egresos (`-`) | `#B91C1C` | `#FEF2F2` | **5.91:1** | Cumple (AA) |
| Estado advertencia (tope diario / pendiente) | `#9A3412` | `#FFF7ED` | **6.88:1** | Cumple (AA) |
| Aviso informativo «Dinero de demostración» | `#0369A1` | `#F0F9FF` | **5.57:1** | Cumple (AA) |

### Modo Oscuro (`prefers-color-scheme: dark`)

| Uso | Primer plano | Fondo | Razón | Estado |
| :--- | :--- | :--- | ---: | :--- |
| Texto principal sobre lienzo | `#F5F7FA` | `#07080C` | **18.65:1** | Cumple (AAA) |
| Texto secundario sobre superficie | `#B6BECB` | `#141720` | **9.56:1** | Cumple (AAA) |
| Texto atenuado / fechas | `#98A2B3` | `#141720` | **6.95:1** | Cumple (AA) |
| Enlace / acento azul hielo | `#7DD3FC` | `#141720` | **10.74:1** | Cumple (AAA) |
| Botón primario | `#05131F` | `#38BDF8` | **8.76:1** | Cumple (AAA) |
| Estado éxito / abonos (`+`) | `#86EFAC` | `#141720` | **12.75:1** | Cumple (AAA) |
| Estado error / egresos (`-`) | `#FCA5A5` | `#141720` | **9.43:1** | Cumple (AAA) |
| Estado advertencia | `#FDBA74` | `#141720` | **10.61:1** | Cumple (AAA) |

---

## 2. Teclado, lector de pantalla y objetivos táctiles

- [X] **Landmarks semánticos**: `AppShell` entrega `<header>` móvil / `<aside>` escritorio con `<nav aria-label="Navegación principal">`, `<main>` y `<nav aria-label="Navegación móvil">` con `aria-current="page"` en la ruta activa.
- [X] **Jerarquía de encabezados**: un único `<h1>` en `/inicio` («Hola, …»), `/recargar` («Recargar cuenta») y `/movimientos` («Movimientos»), seguido de `<h2>` sin saltos de nivel.
- [X] **Ocultar saldo accesible (`FR-016`)**: el botón alterna `aria-pressed={hidden}` y actualiza su texto visible («Ocultar saldo» / «Mostrar saldo»); las máscaras `••••••` anuncian «Saldo oculto» / «Monto oculto» para lectores de pantalla y persisten en `localStorage['nova:hide-balance']` dentro de `try/catch`.
- [X] **Signo además del color (`Principio IV` y `FR-018`)**: todo movimiento muestra signo explícito (`+` / `-`) y flecha direccional junto con color semántico, y fecha formateada en `America/Bogota` con `<time dateTime={...}>`.
- [X] **Diálogos accesibles (`ComingSoonCard`, `TopupConfirmDialog`)**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, foco atrapado con `Tab`/`Shift+Tab`, cierre con `Escape` y devolución del foco al control disparador.
- [X] **Entradas y errores (`AmountInput`, `Alert`)**: `inputMode="numeric"`, `aria-invalid`, `aria-describedby` y mensajes en `role="alert"` / `role="status"` (`aria-live="polite"`).
- [X] **Objetivos táctiles ≥ 44 px**: todos los enlaces, pestañas de navegación, botones sugeridos, botón ocultar saldo y botón «Cargar más» cumplen `min-h-11` (`44 px`).

---

## 3. Movimiento (`prefers-reduced-motion`) y diseño adaptable 360 px (`SC-006`)

- [X] **Transiciones CSS puras `t-*` ≤ 400 ms** (`transitions-dev`): `14-skeleton-reveal` (`350 ms`), `36-number-subtle-change` (`400 ms`), `34-text-swap-soft` (`200 ms`/`250 ms`), `16-tabs-sliding` (`250 ms`), `07-panel-reveal` (`400 ms`), `06-modal` (`250 ms`/`150 ms`) y `22-toast` (`350 ms`).
- [X] **Desactivación bajo `prefers-reduced-motion: reduce`**: todas las animaciones y transiciones se reducen a `0.01ms` / `none !important` sin pérdida de legibilidad ni funcionalidad.
- [X] **360 px sin desbordamiento horizontal**: verificado automáticamente en Playwright bajo el proyecto `movil-360` (`360×740`) en `/inicio`, `/recargar` y `/movimientos` (`document.documentElement.scrollWidth <= window.innerWidth`).

---

## 4. Presupuesto de rendimiento (`SC-001`: saldo visible < 2 s tras iniciar sesión)

- [X] **División de código por ruta (`React.lazy`)**:
  - `HomePage`: `11.17 kB` sin comprimir.
  - `TopupPage`: `13.11 kB` sin comprimir.
  - `MovementsPage`: `4.58 kB` sin comprimir.
- [X] **Medición E2E en `e2e/home.spec.ts`**: la aserción `Date.now() - startedAt < 2_000` desde `page.goto('/inicio')` hasta que `$ 0` es visible pasó en verde tanto en `chromium` como en `movil-360` contra el servidor compilado y PostgreSQL `nova_e2e`.
