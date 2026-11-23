# Research: Presupuesto mensual por categorías

**Feature**: `006-presupuesto` · **Date**: 2026-11-23 · **Plan**: [plan.md](plan.md)

Se reutiliza lo de las specs 001–005: sesión, formato de error, cursor de paginación, bandeja de
salida de correos (`lib/mail`), directorio de `auth`, `accounts` y `ledger`.

---

## R1. Módulo `budgets` y fronteras (Principio VI)

| Módulo | Dueño de | Lo que expone a `budgets` |
| :--- | :--- | :--- |
| `budgets` (nuevo) | `budget_limits`, `transfer_categories`, `budget_alerts` | Endpoints de `/budgets` |
| `cards` (004) | `cards`, `card_payments` | **Nuevo**: `payments.spendingByCategory(db, userId, desde, hasta)` |
| `ledger` (002) | `ledger_transactions` | **Nuevo**: `completedTransactions(db, accountId, 'transfer', desde, hasta)` y su versión paginada |
| `auth` (001) | `users` | `directory.findById` (correo para la alerta) |
| `lib/mail` | `email_outbox` | `outboxRepository.enqueue` con la plantilla nueva `budget_alert` |

`budgets` no lee tablas ajenas: pide los gastos a `cards` y a `ledger`.

## R2. Cómo se entera `budgets` de un gasto: evento en proceso

**Decision**: `lib/events.ts` define un bus en proceso con un solo evento,
`spending.recorded { userId }`. `transfers.create` y `payments.pay` lo emiten **después** de que su
transacción se confirma, y solo si la operación no fue una repetición idempotente. `budgets` se
suscribe en la composición (`banking.module.ts`) y evalúa las alertas del mes actual.

- El bus atrapa y registra en el log cualquier error del suscriptor: el gasto ya está confirmado y
  la respuesta no cambia (FR-008, regla de dominio 10).
- `emit` espera a los suscriptores: así, cuando el frontend consulta las alertas justo después del
  gasto, ya existen, y las pruebas son deterministas. La evaluación es una consulta agregada y una
  inserción; su costo se acota con SC-006 (95 % de las respuestas en menos de 1 s con 7 topes).
- Los contratos de la 003 y la 004 no cambian.

**Alternatives considered**: que `transfers` y `cards` llamen directamente a `budgets` (los módulos
antiguos dependerían del nuevo); evaluar al consultar el presupuesto (el correo llegaría solo cuando
la estudiante abra Nova); un worker que revise periódicamente (más infraestructura y retraso).

## R3. Cálculo del gasto de un mes

Para el mes `AAAA-MM` en Bogotá (`desde` = día 1 a las 00:00 −05:00, `hasta` = día 1 del mes
siguiente):

1. **Pagos con tarjeta**: `cards.payments.spendingByCategory` suma `card_payments.amount` agrupado
   por `category` para las tarjetas de la estudiante (SQL explícito con `GROUP BY`).
2. **Transferencias enviadas**: `ledger.completedTransactions(cuenta principal, 'transfer', …)`
   devuelve id y monto de las operaciones completadas cuya `account_id` es la de la estudiante (solo
   las enviadas: las recibidas pertenecen a otra cuenta, spec 003 R5). Cada una suma en la categoría
   de `transfer_categories` o, si no tiene fila, en `transfers`.
3. Las 5 categorías de comercio de la spec 004 se mapean 1 a 1 a las del presupuesto.

Recargas, metas y operaciones fallidas quedan fuera porque no son de tipo `transfer` ni filas de
`card_payments` (FR-004).

## R4. Topes que se repiten cada mes (FR-005, FR-007)

**Decision**: `budget_limits` guarda **versiones** por categoría con `effective_month` (`AAAA-MM`):
el tope de una categoría en el mes `M` es la fila con el mayor `effective_month ≤ M`. Poner o cambiar
un tope hace *upsert* de la fila del mes actual; quitarlo hace *upsert* con `monthly_limit = NULL`.
Así cada mes del historial muestra el tope que tenía, sin copiar filas cada mes.

## R5. Alertas una sola vez (FR-009, FR-010)

**Decision**:
- `budget_alerts` tiene `UNIQUE (user_id, month, category, threshold)`.
- La evaluación calcula el resumen del mes actual y, para cada categoría con tope, los umbrales
  alcanzados: 80 si `percent ≥ 80`, 100 si `spent > limit`. Inserta con
  `INSERT … ON CONFLICT DO NOTHING RETURNING id` y, **solo para las filas nuevas**, encola el correo
  en la misma transacción. Dos gastos simultáneos que cruzan el mismo umbral producen una sola alerta
  y un solo correo.
- Se evalúa: tras `spending.recorded`, al poner o bajar un tope y al reclasificar una transferencia
  del mes actual (FR-012). Solo el mes actual genera alertas.

## R6. Correo de alerta

Plantilla nueva `budget_alert` (valor del enum `email_template`). El payload lleva solo datos ya
formateados y sin secretos: `categoryName`, `percent`, `spent`, `limit` y `kind`
(`warning` | `exceeded`). No necesita preparador: el worker de la spec 001 renderiza el payload
directamente. Asuntos: «Te estás acercando a tu presupuesto de {categoría}» y «Superaste tu
presupuesto de {categoría}».

## R7. Estado y porcentaje

- `percent = floor(spent × 100 / limit)`; null sin tope.
- `status`: `none` (sin tope), `ok` (< 80 %), `warning` (≥ 80 % y `spent ≤ limit`), `exceeded`
  (`spent > limit`). Llegar exactamente al tope es `warning` (spec, edge cases).

## R8. Meses consultables

`GET /budgets?month=AAAA-MM`: el mes actual (por defecto) o uno de los 6 anteriores; cualquier otro
responde 400 `VALIDATION_ERROR` con `fields.month = 'out_of_range'`. `@nova/shared` exporta
`bogotaMonth(now)` y `addMonths(month, n)` para que el frontend construya el selector con la misma
regla.

## R9. Sin códigos de error nuevos

Los errores posibles ya existen: `VALIDATION_ERROR` (tope fuera de rango, mes inválido, categoría
inválida) y `NOT_FOUND` (transferencia o alerta ajena o inexistente). No hay cambios en
`ERROR_CODES`.

## R10. Sin límites de tasa ni idempotencia nuevos

Ninguna operación mueve dinero (spec, supuestos). Los cambios de tope y de clasificación son
idempotentes por naturaleza (*upsert*).
