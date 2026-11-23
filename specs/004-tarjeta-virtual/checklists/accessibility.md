# Auditoría de Accesibilidad y Seguridad UI — Spec 004 (`004-tarjeta-virtual`)

**Fecha**: 2026-11-23  
**Alcance**: `/tarjetas` (`CardsPage`, `VirtualCard`, `CardNicknameDialog`), `/tarjetas/:id` (`CardDetailPage`, `RevealCardDialog`) y `/tienda` (`StorePage`, `StoreSuccessView`).  
**Referencia**: Constitución v2.3.0 (Principios III y IV, Regla de dominio 8), `specs/004-tarjeta-virtual/spec.md` (SC-005, SC-006).

---

## 1. Protección de datos sensibles (Regla de dominio 8 y SC-005)

- [X] **Vistas estándar**: `VirtualCard` y listas muestran únicamente `maskCardNumber(card.last4)` («•••• 1234»).
- [X] **Revelación efímera (`RevealCardDialog`)**: número completo y CVV viven únicamente en `useState` local, nunca entran en TanStack Query ni `localStorage`, y se limpian automáticamente a los 60 s, al cerrar el diálogo o al desmontar. Verificado por `RevealCardDialog.test.tsx`.
- [X] **Idempotencia sin secretos**: `useCreateCardPayment` construye la huella de intento solo con `{ merchantId, amount }` (excluyendo número, vencimiento y CVV).

## 2. Accesibilidad WCAG 2.1 AA y diseño adaptable 360 px (SC-006)

- [X] **Estado en texto (no solo color)**: `VirtualCard` muestra siempre texto explícito («Activa», «Congelada», «Vencida» en hora `America/Bogota` o «Cancelada»).
- [X] **Contraste WCAG 2.1 AA**: todos los controles y tarjetas usan los tokens Light porcelana / Dark OLED (`≥ 5.27:1` claro, `≥ 7.27:1` oscuro); la superficie de `VirtualCard` usa texto blanco (`#FFFFFF` / `white/90`) sobre fondo oscuro de alto contraste (`> 10:1`).
- [X] **Diálogos accesibles**: emisión, renombrado, revelación y cancelación usan `ModalDialog` con `aria-modal="true"`, foco atrapado y retorno al cerrar.
- [X] **Objetivos táctiles ≥ 44 px y 360 px sin desborde**: verificado en Playwright (`chromium` y `movil-360`) en `/tarjetas`, `/tarjetas/:id` y `/tienda`, con menú móvil escalable «Más» en `AppShell`.
- [X] **Movimiento**: `prefers-reduced-motion` detiene todas las transiciones (`06-modal`, `22-toast`, `t-surface-enter`, hover de `VirtualCard`).
