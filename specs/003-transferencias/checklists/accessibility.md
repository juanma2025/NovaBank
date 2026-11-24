# Auditoría de Accesibilidad y Diseño Adaptable — Spec 003 (`003-transferencias`)

**Fecha**: 2026-11-23  
**Alcance**: `/enviar` (`SendPage`, `RecipientField`, `TransferConfirmDialog`), `/perfil` (`ProfilePage`), acceso «Enviar» en `BalanceCard`, navegación en `AppShell` y `MovementItem` (tipo `transfer` + nota).  
**Referencia**: Constitución v2.3.0 (Principio IV), `specs/003-transferencias/spec.md` (SC-006).

---

## 1. Contraste WCAG 2.1 AA (Dark OLED & Light blanco opaco)

- [X] Todas las superficies de `/enviar` y `/perfil` utilizan exclusivamente tokens semánticos de `frontend/src/styles/tokens.css` (Light porcelana `#EAEDF2`/`#F4F6F9`, Dark OLED `#000000`/`#0A0A0D`), con razón mínima `≥ 5.27:1` en modo claro y `≥ 7.27:1` en modo oscuro.
- [X] Variaciones de transferencia en `MovementItem` y comprobante muestran signo explícito (`-` / `+`) además del color semántico (`text-danger` / `text-success`).

## 2. Teclado, lector de pantalla y diálogos

- [X] `TransferConfirmDialog` y el diálogo de confirmación para quitar alias usan `ModalDialog` (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, foco atrapado con `Tab`/`Shift+Tab`, cierre con `Escape` y retorno de foco).
- [X] El campo de contraseña en `TransferConfirmDialog` solo se monta cuando el monto supera `reauthThreshold` y limpia su estado local al cerrar el diálogo (nunca se cachea ni persiste).
- [X] Errores inline (`RECIPIENT_NOT_FOUND`, `TRANSFER_TO_SELF`, `INSUFFICIENT_FUNDS`, `ALIAS_TAKEN`, `REAUTH_FAILED`, `REAUTH_LOCKED`) se vinculan con `aria-invalid`, `aria-describedby` o `role="alert"`.
- [X] Todos los botones y enlaces (`Buscar destinatario`, `Cambiar`, `Continuar`, `Guardar alias`, `Quitar alias`, enlace `Perfil` en barra móvil) cumplen objetivo táctil `≥ 44 px` (`min-h-11` / `h-11 w-11`).

## 3. Movimiento y diseño adaptable desde 360 px

- [X] Transiciones CSS puras `t-*` ≤ 400 ms (`t-surface-enter`, `06-modal`, `22-toast`, `16-tabs-sliding`) detenidas bajo `prefers-reduced-motion: reduce`.
- [X] Cero desbordamiento horizontal en `/enviar` y `/perfil` verificado en Playwright (`chromium` y `movil-360` `360×740`).
