# Checklist de accesibilidad y diseño adaptable — Spec `007-gastos-compartidos` (`T021`)

Revisión verificada sobre `/compartidos`, `/compartidos/nueva`, `/compartidos/:id` y `SplitsSummaryCard` en `/inicio` (SC-005, WCAG 2.1 AA, Principio IV).

- [x] **Privacidad en la UI (FR-013)**: participantes y creadores muestran siempre nombre parcial y correo enmascarado de la vista previa de `003`; nunca se expone el correo completo.
- [x] **Estados con icono y texto explícito (no solo color)**: `SplitStatusBadge` y `ShareStatusBadge` muestran icono + texto («Abierta», «Completada», «Cancelada», «Pendiente», «Pagada», «Pagada por fuera», «Rechazada», «Cancelada»).
- [x] **Respeto a saldo oculto**: totales, partes y el resumen «Te deben» / «Debes» respetan `useBalanceVisibility()` (`••••••`).
- [x] **Confirmación y seguridad en acciones financieras/destructivas**: «Pagar mi parte» abre `PayShareDialog` con destinatario, monto, nota y contraseña obligatoria sobre el umbral + `Idempotency-Key`; «Rechazar» y «Cancelar división» requieren confirmación explícita en `ConfirmActionDialog` (`ModalDialog` con foco atrapado y Escape).
- [x] **Objetivos táctiles ≥ 44 px y diseño adaptable sin desborde**: todos los controles cumplen `min-h-11` (`44 px`); verificado automáticamente en `movil-360` (`360 × 740`) sin desbordamiento horizontal mediante `e2e/splits.spec.ts`.
