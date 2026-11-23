# Checklist de Accesibilidad y Rendimiento — Spec `001-auth-onboarding`

**Fecha de auditoría**: 2026-11-22 · **Rama**: `001-auth-onboarding-fe` · **Tareas**: T083 y T084 · **Criterios**: SC-004, SC-009, FR-025, Constitución Principio IV

---

## 1. Accesibilidad (T083 · SC-009 · WCAG 2.1 AA)

### 1.1 Navegación solo con teclado
- [x] **Orden de tabulación lógico** en los 4 flujos (registro en 3 pasos, inicio/cierre de sesión, recuperación en 3 pasos y reenvío de código).
- [x] **Foco visible (`:focus-visible`)** con contorno de 2 px en `--color-focus-ring` (azul hielo de alto contraste en modo claro y oscuro) sobre todos los botones, enlaces, casillas y campos.
- [x] **Foco programático al cambiar de paso**: `RegisterPage` y `PasswordResetPage` mueven el foco al `<h1>` (`tabIndex={-1}`) de cada paso al avanzar (cubierto en `RegisterPage.test.tsx` y `PasswordResetPage.test.tsx`).
- [x] **`CodeInput` navegable por teclado**: soporta `Backspace`, `ArrowLeft`, `ArrowRight`, `Home`, `End` y pegado completo del código de 6 dígitos.
- [x] **Trampa de foco en `InactivityDialog`**: `Tab` y `Shift+Tab` ciclan dentro del modal, el foco inicial entra en «Seguir conectado», se bloquea el scroll del fondo y se restaura el foco previo al cerrar (cubierto en `accessibility.test.tsx`).

### 1.2 Lector de pantalla y semántica ARIA
- [x] **Landmarks semánticos completos**: `<header>`, `<main>` y `<footer>` en `AuthLayout`, y `<header>` (`AppHeader`) + `<main>` en `WelcomePage` (cubierto en `accessibility.test.tsx`).
- [x] **Etiquetas y asociaciones en formularios**: todos los `<input>` tienen `<label htmlFor>` explícito; hints y errores conectados vía `aria-describedby` y `aria-invalid`.
- [x] **Anuncios vivos (`aria-live`)**: `Alert` usa `role="alert"` / `aria-live="assertive"` para errores y `role="status"` / `aria-live="polite"` para avisos; `CodeInput` anuncia errores con `aria-live="assertive"`.
- [x] **Indicadores no dependientes del color**: errores, éxitos, advertencias y reglas de contraseña combinan icono Lucide + texto en español + texto `sr-only` («Cumplida:» / «No cumplida:») en `PasswordRules`.
- [x] **Cuenta regresiva accesible en `InactivityDialog`**: al abrir, `aria-describedby` anuncia el tiempo inicial; el `sr-only` live region anuncia hitos (`30 s`, `10 s` y últimos `5 s`) sin saturar lectores de pantalla ni duplicar el anuncio inicial.

### 1.3 Contraste WCAG 2.1 AA en ambos temas (calculado sobre `tokens.css`)

| Par de tokens | Tema | Ratio medido | Mínimo AA | Resultado |
| :--- | :---: | :---: | :---: | :---: |
| `text` (`#0B0D12`) sobre `surface-glass` | Claro | **19.12:1** | 4.5:1 | ✅ Pasa (AAA) |
| `text-secondary` (`#434B59`) sobre `surface-glass` | Claro | **8.65:1** | 4.5:1 | ✅ Pasa (AAA) |
| `text-muted` (`#586170`) sobre `surface-glass` | Claro | **6.15:1** | 4.5:1 | ✅ Pasa |
| `on-brand` (`#FFFFFF`) sobre `brand` (`#0066CC`) | Claro | **5.57:1** | 4.5:1 | ✅ Pasa |
| `on-brand` (`#FFFFFF`) sobre `brand-hover` (`#0052A3`) | Claro | **7.68:1** | 4.5:1 | ✅ Pasa (AAA) |
| `brand-text` (`#005BB5`) sobre `surface-glass` | Claro | **6.53:1** | 4.5:1 | ✅ Pasa |
| `danger` (`#B91C1C`) sobre `danger-bg` (`#FEF2F2`) | Claro | **5.91:1** | 4.5:1 | ✅ Pasa |
| `success` (`#15803D`) sobre `success-bg` (`#ECFDF5`) | Claro | **4.76:1** | 4.5:1 | ✅ Pasa |
| `warning` (`#9A3412`) sobre `warning-bg` (`#FFF7ED`) | Claro | **6.88:1** | 4.5:1 | ✅ Pasa |
| `info` (`#0369A1`) sobre `info-bg` (`#F0F9FF`) | Claro | **5.57:1** | 4.5:1 | ✅ Pasa |
| `text` (`#F5F7FA`) sobre `surface-glass` | Oscuro | **16.96:1** | 4.5:1 | ✅ Pasa (AAA) |
| `text-secondary` (`#B6BECB`) sobre `surface-glass` | Oscuro | **9.72:1** | 4.5:1 | ✅ Pasa (AAA) |
| `text-muted` (`#98A2B3`) sobre `surface-glass` | Oscuro | **7.07:1** | 4.5:1 | ✅ Pasa (AAA) |
| `on-brand` (`#05131F`) sobre `brand` (`#38BDF8`) | Oscuro | **8.76:1** | 4.5:1 | ✅ Pasa (AAA) |
| `brand-text` (`#7DD3FC`) sobre `surface-glass` | Oscuro | **10.92:1** | 4.5:1 | ✅ Pasa (AAA) |
| `danger` (`#FCA5A5`) sobre `danger-bg` | Oscuro | **8.15:1** | 4.5:1 | ✅ Pasa (AAA) |
| `success` (`#86EFAC`) sobre `success-bg` | Oscuro | **10.45:1** | 4.5:1 | ✅ Pasa (AAA) |
| `warning` (`#FDBA74`) sobre `warning-bg` | Oscuro | **8.73:1** | 4.5:1 | ✅ Pasa (AAA) |
| `info` (`#7DD3FC`) sobre `info-bg` | Oscuro | **8.74:1** | 4.5:1 | ✅ Pasa (AAA) |

### 1.4 Diseño adaptativo desde 360 px y objetivos táctiles ≥ 44 px
- [x] `overflow-x: clip` en `body` y contenedor `w-full max-w-[440px]` en `AuthLayout` (`px-4`), sin desborde horizontal a 360 px.
- [x] Todos los botones, campos, toggles de visibilidad de contraseña, checkbox de consentimiento y enlaces de navegación cumplen altura/objetivo táctil ≥ 44 px (`min-h-11`).
- [x] `CodeInput` (6 casillas en `grid-cols-6 gap-1` dentro de `GlassCard` con `p-5` en móvil): ancho calculado a 360 px = `(360 − 32 − 40 − 20) / 6 = 44.67 px` × `48 px` de alto (≥ 44 × 44 px sin desborde).

### 1.5 Movimiento y `prefers-reduced-motion`
- [x] Todas las transiciones y animaciones CSS están acotadas a ≤ 400 ms (`--duration-quick: 150ms`, `--duration-fast: 250ms`, `--duration-medium: 350ms`, `--duration-slow: 400ms`).
- [x] `@media (prefers-reduced-motion: reduce)` en `frontend/src/styles/index.css` desactiva animaciones y colapsa transiciones manteniendo intacta la retroalimentación visual y de texto (`loadingLabel`, `role="status"`).

### 1.6 Correcciones aplicadas durante T083
1. **`CodeInput.tsx`**: se eliminó `key={errorKey}` del contenedor de casillas (evitaba perder el foco al desmontar/remontar los `<input>` ante `CODE_INVALID`) y se reemplazó por una clase controlada con temporizador de 350 ms.
2. **`PasswordRules.tsx`**: se añadió texto `sr-only` («Cumplida:» / «No cumplida:») en cada regla para lectores de pantalla.
3. **`InactivityDialog.tsx`**: se añadió bloqueo de scroll de `document.body` mientras el modal está abierto y anuncios `aria-live` por hitos en vez de cada segundo.
4. **`AuthLayout.tsx`**: el encabezado de marca pasó de `<div>` a `<header>` para completar los landmarks semánticos.
5. **`LoginPage.tsx`, `RegisterPage.tsx` y `PasswordResetPage.tsx`**: los enlaces del pie se ajustaron a `min-h-11` (≥ 44 px).

---

## 2. Rendimiento (T084 · SC-004)

### 2.1 Carga diferida de rutas en el build de producción (`vite build`)

Verificado con `npm run build` (tiempo de build del frontend: **1.01 s**):

| Chunk generado | Tamaño bruto | Gzip | Carga |
| :--- | ---: | ---: | :--- |
| `dist/index.html` | 0.53 kB | 0.29 kB | Inicial |
| `dist/assets/index-*.css` | 29.10 kB | 6.69 kB | Inicial |
| `dist/assets/index-*.js` | 395.94 kB | 122.21 kB | Inicial (runtime React 19 + Router 7 + TanStack Query 5 + Zod 4) |
| `dist/assets/LoginPage-*.js` | 3.52 kB | 1.54 kB | Diferida (`React.lazy`) |
| `dist/assets/RegisterPage-*.js` | 5.23 kB | 2.18 kB | Diferida (`React.lazy`) |
| `dist/assets/PasswordResetPage-*.js` | 4.30 kB | 1.89 kB | Diferida (`React.lazy`) |
| `dist/assets/PrivacyPolicyPage-*.js` | 1.90 kB | 0.81 kB | Diferida (`React.lazy`) |
| `dist/assets/WelcomePage-*.js` | 3.14 kB | 1.29 kB | Diferida (`React.lazy`) |
| `dist/assets/NotFoundPage-*.js` | 0.95 kB | 0.48 kB | Diferida (`React.lazy`) |
| `dist/assets/InactivityDialog-*.js` | 2.60 kB | 1.23 kB | Diferida (`React.lazy`, solo al abrir aviso) |

### 2.2 Optimizaciones aplicadas durante T084
1. **Extracción de `NovaMark.tsx`**: desacopló el logotipo de `AppHeader.tsx`, evitando que `/ingresar` descargue `AppHeader`, `useLogout` y el icono `LogOut` en el paquete inicial.
2. **Carga diferida de `InactivityDialog`**: se cargó con `React.lazy` dentro de `SessionProvider` solo cuando `warningOpen === true`.
3. **Reducción medida del chunk inicial**: de `418.74 kB` (`129.69 kB` gzip) a `395.94 kB` (`122.21 kB` gzip) — ahorro de **22.8 kB** brutos (**7.48 kB** gzip).
4. **Cero fuentes externas bloqueantes**: usa la pila de fuentes de sistema con respaldo `Inter` definida en la constitución (sin peticiones de red a Google Fonts), eliminando bloqueo de renderizado.

### 2.3 Presupuesto 4G y verificación en vivo (SC-004)
- **Transferencia inicial de `/ingresar`** (`index.html` + `index.css` + `index.js` + `AuthLayout` + `TextField` + `LoginPage` + `messages`): **~139 kB gzip** en total (~0.7 s en 4G típico de 1.6 Mbps, con amplio margen por debajo del umbral constitucional de **2.5 s**).
- **Auditoría Lighthouse móvil y latencia end-to-end de login → `/inicio` (< 2 s)**: pendiente de correr contra el servidor local completo (`SERVE_FRONTEND=true`) una vez Docker Desktop y PostgreSQL estén activos (se valida junto con T085 / pruebas E2E):
  ```powershell
  docker compose up -d
  npm run db:deploy
  npm run build
  $env:SERVE_FRONTEND="true"; npm run start -w backend
  npx lighthouse http://localhost:3000/ingresar --preset=perf --form-factor=mobile --view
  ```
