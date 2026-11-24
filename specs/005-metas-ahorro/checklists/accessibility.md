# Checklist de accesibilidad y diseño adaptable — Spec `005-metas-ahorro` (`T027`)

Revisión verificada sobre `/metas` y `/metas/:id` (SC-006, WCAG 2.1 AA, Principio IV).

- [x] **Progreso accesible sin depender solo del color**: `GoalCard` usa `role="progressbar"` con `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label` con el nombre de la meta y porcentaje explícito en texto (`{progress.percent} %`).
- [x] **Estados con texto explícito**: badges «Cumplida», «Fecha vencida» y «Cerrada» además del color y la atenuación (`opacity-70`) en metas cerradas.
- [x] **Respeto a saldo oculto**: `totalSaved`, saldo de meta, objetivo, monto faltante, ahorro mensual sugerido e historial usan `useBalanceVisibility()` + `MovementPresenter` (`••••••`).
- [x] **Diálogos accesibles**: `GoalFormDialog`, `SavingsAmountDialog` y confirmación de cierre usan `ModalDialog` (`role="dialog"`, `aria-modal="true"`, foco inicial, trampa de Tab, cierre con Escape y retorno de foco).
- [x] **Confirmación explícita en cierre**: el diálogo de cierre muestra el monto exacto en pesos COP que vuelve a la cuenta principal antes de confirmar.
- [x] **Objetivos táctiles ≥ 44 px y diseño adaptable sin desborde**: botones y enlaces cumplen `min-h-11` (`44 px`); verificado automáticamente sin desbordamiento horizontal en `movil-360` (`360 × 740`) mediante `assertNoHorizontalOverflow` en `e2e/savings.spec.ts`.
- [x] **Navegación por teclado y contraste AA**: tema claro y oscuro validados con tokens constitucionales (`--color-brand`, `--color-brand-text`, `--color-danger`, `--color-success`).
