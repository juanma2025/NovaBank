# Feature Specification: Presupuesto mensual por categorías

**Feature Branch**: `006-presupuesto`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Presupuesto mensual por categorías con alertas."

## Clarifications

### Session 2026-11-23

- Q: ¿Qué gastos cuentan para el presupuesto? → A: Los pagos con tarjeta, clasificados solos por la
  categoría del comercio, y las transferencias enviadas, que caen en «Transferencias» y el estudiante
  puede reclasificar una por una.
- Q: ¿Cuándo se alerta? → A: Al llegar al 80 % del tope de una categoría («Te estás acercando») y al
  pasar el 100 % («Superaste el presupuesto»). Mismo umbral para todas las categorías.
- Q: ¿Dónde ve el estudiante las alertas? → A: Dentro de Nova (inicio, pantalla de presupuesto y un
  mensaje justo después del gasto que cruzó el umbral) y por correo, la primera vez que cruza cada
  umbral en el mes.
- Q: ¿Cómo funciona cada mes? → A: Los topes se definen una vez y se repiten todos los meses hasta
  que se cambien. Se puede ver el resultado de los 6 meses anteriores.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Poner topes y ver cuánto llevo (Priority: P1)

Una estudiante quiere controlar sus gastos. En «Presupuesto» pone $200.000 al mes para Comida y
$80.000 para Transporte. Nova le muestra, para cada categoría, cuánto lleva gastado este mes, el tope
y el porcentaje, además del total gastado en el mes. Las categorías sin tope también aparecen con lo
gastado, para que sepa en qué se le va el dinero.

**Why this priority**: Sin topes y sin ver lo gastado no hay presupuesto.

**Independent Test**: Con un tope de $200.000 en Comida y pagos con tarjeta por $50.000 en la
Cafetería Central, la pantalla muestra Comida con $50.000 de $200.000 (25 %).

**Acceptance Scenarios**:

1. **Given** una estudiante sin presupuesto, **When** pone un tope mensual válido a una categoría,
   **Then** la categoría muestra lo gastado este mes, el tope y el porcentaje.
2. **Given** pagos con tarjeta en comercios de distintas categorías, **When** abre el presupuesto,
   **Then** cada pago suma en la categoría de su comercio.
3. **Given** transferencias enviadas este mes, **When** abre el presupuesto, **Then** suman en
   «Transferencias»; las recibidas no cuentan.
4. **Given** un tope, **When** lo cambia o lo quita, **Then** se aplica desde este mes y los
   siguientes; los meses anteriores conservan el tope que tenían.
5. **Given** cualquier gasto, **When** supera el tope, **Then** la operación se realiza igual: el
   presupuesto nunca bloquea.

---

### User Story 2 - Recibir alertas (Priority: P2)

La estudiante paga $40.000 en el Restaurante La U y con eso llega a $165.000 de $200.000 en Comida.
Justo después del pago, Nova le muestra «Te estás acercando a tu presupuesto de Comida (82 %)» y le
llega un correo. Cuando pasa de $200.000, recibe «Superaste tu presupuesto de Comida». En el inicio
ve un aviso con las categorías en alerta.

**Why this priority**: Las alertas son el valor del presupuesto, pero dependen de US1.

**Independent Test**: Con un tope de $10.000, un pago de $8.000 genera una alerta del 80 % (en Nova y
por correo) y otro de $3.000 genera la del 100 %; un tercer pago no genera más alertas ese mes.

**Acceptance Scenarios**:

1. **Given** una categoría con tope, **When** un gasto la lleva al 80 % o más por primera vez en el
   mes, **Then** Nova crea una alerta «Te estás acercando», la muestra justo después del gasto y envía
   un correo.
2. **Given** una categoría con tope, **When** un gasto la lleva a más del 100 % por primera vez en el
   mes, **Then** Nova crea una alerta «Superaste el presupuesto» y envía un correo.
3. **Given** un umbral ya alertado este mes, **When** siguen los gastos, **Then** no se repiten la
   alerta ni el correo hasta el mes siguiente.
4. **Given** un gasto que salta del 50 % al 120 %, **When** se registra, **Then** se crean las dos
   alertas (80 % y 100 %).
5. **Given** un tope que se baja por debajo de lo ya gastado, **When** se guarda, **Then** se generan
   las alertas que correspondan.
6. **Given** alertas sin ver, **When** la estudiante las ve, **Then** quedan marcadas como vistas y el
   mensaje no vuelve a aparecer.

---

### User Story 3 - Reclasificar transferencias y ver meses anteriores (Priority: P3)

Una transferencia de $150.000 a un compañero fue para pagar la parte del arriendo. La estudiante la
pasa de «Transferencias» a «Otros» y el presupuesto se recalcula. También revisa cómo le fue los
meses anteriores: por cada mes ve lo gastado por categoría contra el tope que tenía.

**Why this priority**: Mejora la precisión y el análisis, pero el presupuesto funciona sin esto.

**Independent Test**: Una transferencia reclasificada a «Comida» deja de sumar en «Transferencias» y
suma en «Comida»; el mes anterior muestra sus propios gastos y topes.

**Acceptance Scenarios**:

1. **Given** una transferencia enviada, **When** la reclasifica a otra categoría, **Then** deja de
   sumar en la anterior y suma en la nueva, en el mes en que se hizo.
2. **Given** una reclasificación que lleva una categoría a un umbral, **When** se guarda, **Then** se
   generan las alertas del mes de esa transferencia, si es el mes actual.
3. **Given** el historial, **When** elige uno de los 6 meses anteriores, **Then** ve lo gastado por
   categoría y el tope que tenía cada una ese mes.

---

### Edge Cases

- **Mes**: el mes calendario de Colombia; se reinicia a la medianoche de Bogotá del día 1.
- **Sin tope**: la categoría muestra lo gastado, sin porcentaje ni alertas.
- **Porcentaje**: entero redondeado hacia abajo; puede pasar de 100 % (la barra se llena y se muestra
  el exceso).
- **Exactamente el tope**: llegar a 100 % exacto genera la alerta del 80 %, no la de «Superaste»
  (esa es al pasar el 100 %).
- **Tope que se sube**: las alertas ya enviadas en el mes se mantienen; no se envían de nuevo.
- **Qué no cuenta**: recargas, aportes y retiros de metas, transferencias recibidas y pagos
  rechazados.
- **Reclasificar**: solo transferencias enviadas por la propia estudiante; los pagos con tarjeta
  siempre usan la categoría del comercio.
- **Si fallan las alertas**: el gasto ya se realizó; Nova lo registra y la alerta se generará con el
  siguiente gasto o cambio del presupuesto en la categoría.
- **Montos**: los topes son enteros entre $1.000 y $50.000.000.

## Requirements *(mandatory)*

### Functional Requirements

**Categorías y gastos**

- **FR-001**: Las categorías del presupuesto DEBEN ser: Comida, Libros, Transporte, Papelería y
  Entretenimiento (las de los comercios de la spec 004), Transferencias y Otros.
- **FR-002**: Cada pago con tarjeta aprobado DEBE sumar en la categoría de su comercio.
- **FR-003**: Cada transferencia enviada DEBE sumar en «Transferencias» salvo que la estudiante la
  reclasifique a otra categoría.
- **FR-004**: Recargas, movimientos de metas, transferencias recibidas y operaciones rechazadas NO
  DEBEN contar como gasto.

**Topes y resumen**

- **FR-005**: La estudiante DEBE poder poner, cambiar y quitar un tope mensual por categoría (entero
  entre $1.000 y $50.000.000). El cambio aplica desde el mes actual y se repite los meses siguientes.
- **FR-006**: El resumen de un mes DEBE mostrar, por cada categoría, lo gastado, el tope de ese mes (si
  tiene), el porcentaje y su estado (sin tope, normal, cerca del tope o superado), además del total
  gastado.
- **FR-007**: La estudiante DEBE poder ver el resumen del mes actual y de los 6 meses anteriores, con
  el tope que tenía cada categoría en cada mes.
- **FR-008**: El presupuesto NUNCA DEBE bloquear, demorar visiblemente ni revertir un pago o una
  transferencia (regla de dominio 10).

**Alertas**

- **FR-009**: Al llegar una categoría con tope al 80 % o más, y al pasar el 100 %, el sistema DEBE
  crear una alerta por umbral, una sola vez por categoría y mes.
- **FR-010**: Cada alerta nueva DEBE enviarse por correo al correo institucional de la estudiante.
- **FR-011**: La estudiante DEBE poder ver sus alertas del mes y marcarlas como vistas; las no vistas se
  muestran justo después del gasto que las generó.
- **FR-012**: Bajar un tope o reclasificar una transferencia del mes actual DEBE evaluar de nuevo las
  alertas de la categoría afectada.

**Reclasificación**

- **FR-013**: La estudiante DEBE poder ver las transferencias que envió en un mes con su categoría y
  cambiarla. Las transferencias de otra persona DEBEN responder como inexistentes.

### Key Entities

- **Tope de categoría**: monto mensual de una categoría, vigente desde un mes hasta que se cambie.
- **Clasificación de transferencia**: la categoría elegida para una transferencia enviada.
- **Alerta**: aviso de que una categoría cruzó el 80 % o el 100 % de su tope en un mes, con su estado
  de vista.
- **Resumen mensual** (vista): gasto, tope, porcentaje y estado por categoría para un mes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una estudiante pone su primer tope y ve cuánto lleva gastado en menos de 30 segundos.
- **SC-002**: El 100 % de los gastos que cruzan un umbral generan su alerta en Nova y su correo, una
  sola vez por umbral, categoría y mes.
- **SC-003**: El resumen coincide al peso con la suma de los pagos con tarjeta y transferencias
  enviadas del mes.
- **SC-004**: Ningún pago ni transferencia se rechaza o se revierte por el presupuesto, ni siquiera si
  fallan las alertas.
- **SC-005**: Las pantallas cumplen WCAG 2.1 AA y funcionan desde 360 px de ancho.

## Assumptions

- Depende de las specs 001 (sesión y correo), 002 (libro contable), 003 (transferencias) y 004
  (pagos con tarjeta y categorías de comercios).
- El presupuesto es solo informativo (regla de dominio 10): no mueve dinero, así que no usa el libro
  contable ni idempotencia.
- Quedan fuera: categorías personalizadas, presupuesto total del mes, presupuestos semanales,
  recomendaciones automáticas, notificaciones push y reclasificar pagos con tarjeta.
