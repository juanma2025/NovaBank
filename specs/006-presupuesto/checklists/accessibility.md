# Checklist de accesibilidad y diseño adaptable — Spec `006-presupuesto` (`T025`)

Revisión verificada sobre `/presupuesto`, `BudgetAlertBanner` en `/inicio` y `BudgetAlertToast` en `/tienda` y `/enviar` (SC-005, WCAG 2.1 AA, Principio IV).

- [x] **Estados con icono y texto explícito (no solo color)**: `BudgetCategoryRow`, `BudgetAlertBanner` y `BudgetAlertToast` muestran etiquetas «Sin tope», «Normal», «Cerca del tope» y «Superado» junto a iconos semánticos (`CheckCircle2`, `AlertTriangle`, `OctagonAlert`, `MinusCircle`) y porcentajes numéricos exactos (`85 %`, `110 %`).
- [x] **Barras y gráfico accesibles**: cada categoría expone `role="progressbar"` con `aria-label`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`; el anillo SVG decorativo usa `aria-hidden="true"` con leyenda en texto y cifras exactas en pesos COP.
- [x] **Respeto a saldo oculto**: el total gastado, cada categoría, exceso/faltante y las transferencias del mes respetan `useBalanceVisibility()` (`••••••`).
- [x] **Regiones vivas y modales accesibles**: `BudgetAlertToast` anuncia alertas mediante `role="status"` y `aria-live="polite"`; `BudgetLimitDialog` usa `ModalDialog` con foco atrapado, Escape y retorno de foco.
- [x] **Modo solo lectura en historial**: al consultar cualquiera de los 6 meses anteriores se oculta la edición de topes y se muestra un aviso claro.
- [x] **Objetivos táctiles ≥ 44 px y diseño adaptable sin desborde**: botones, selectores `<select>` y enlaces cumplen `min-h-11` (`44 px`); verificado sin desbordamiento horizontal en `movil-360` (`360 × 740`) mediante `e2e/budgets.spec.ts`.
