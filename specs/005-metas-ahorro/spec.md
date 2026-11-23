# Feature Specification: Metas de ahorro

**Feature Branch**: `005-metas-ahorro`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Crear metas, aportar y retirar."

## Clarifications

### Session 2026-11-23

- Q: ¿Cuántas metas puede tener un estudiante y qué datos tiene cada una? → A: Hasta 5 metas
  activas, cada una con nombre, monto objetivo y una fecha límite opcional.
- Q: ¿Qué pasa al cerrar una meta que todavía tiene dinero? → A: Nova devuelve todo el saldo a la
  cuenta principal en el mismo paso y la meta queda cerrada.
- Q: ¿Se puede aportar más allá del monto objetivo? → A: Sí. Al alcanzar el objetivo la meta se
  muestra como «Cumplida», y se puede seguir aportando.
- Q: ¿Qué límites tienen los aportes y retiros? → A: Entre $1.000 y $2.000.000 por aporte o retiro,
  y hasta $5.000.000 movidos por día entre la cuenta y las metas. Configurables.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear una meta y aportarle (Priority: P1)

Un estudiante quiere ahorrar $600.000 para un viaje en junio. En «Metas» crea la meta «Viaje a
Santa Marta» con el objetivo de $600.000 y la fecha 15 de junio. Le aporta $50.000: el dinero sale de
su saldo disponible y entra a la meta. Ve el progreso (8 %), cuánto le falta y, como puso fecha,
cuánto necesitaría ahorrar por mes para llegar a tiempo.

**Why this priority**: Crear y aportar es el núcleo del ahorro; sin esto no hay funcionalidad.

**Independent Test**: Con $100.000 disponibles, se crea una meta de $600.000 y se aportan $50.000: el
saldo disponible queda en $50.000, la meta en $50.000 con 8 % de progreso, y ambos movimientos
aparecen en sus historiales.

**Acceptance Scenarios**:

1. **Given** un estudiante con menos de 5 metas activas, **When** crea una meta con nombre y monto
   objetivo válidos (y fecha opcional), **Then** la meta queda activa con saldo $0.
2. **Given** una meta activa y saldo disponible suficiente, **When** aporta un monto válido,
   **Then** su saldo disponible baja y el de la meta sube exactamente en el monto, y ve el progreso
   actualizado.
3. **Given** un aporte mayor que su saldo disponible, **When** lo confirma, **Then** Nova lo rechaza e
   indica el saldo disponible, sin mover dinero.
4. **Given** una meta que alcanza o supera su objetivo, **When** se muestra, **Then** aparece como
   «Cumplida»; puede seguir aportando.
5. **Given** un estudiante con 5 metas activas, **When** intenta crear otra, **Then** Nova le indica
   que alcanzó el máximo.
6. **Given** un doble clic en «Aportar» o un reintento tras perder la conexión, **When** la misma
   solicitud llega más de una vez, **Then** el aporte se aplica una sola vez.

---

### User Story 2 - Retirar de una meta (Priority: P2)

Surge un gasto imprevisto y el estudiante retira $20.000 de su meta del viaje. El dinero vuelve a su
saldo disponible y puede gastarlo de inmediato.

**Why this priority**: El dinero de la meta no está disponible para gastar hasta retirarlo
(regla de dominio 9); sin retiro, el dinero quedaría atrapado.

**Independent Test**: Con una meta de $50.000, se retiran $20.000: la meta queda en $30.000 y el saldo
disponible sube $20.000.

**Acceptance Scenarios**:

1. **Given** una meta con saldo, **When** retira un monto válido no mayor a su saldo, **Then** el saldo
   de la meta baja y el disponible sube exactamente en el monto.
2. **Given** un retiro mayor que el saldo de la meta, **When** lo confirma, **Then** Nova lo rechaza e
   indica el saldo de la meta; el saldo de la meta nunca queda negativo.
3. **Given** el dinero de una meta, **When** el estudiante intenta transferir, pagar con tarjeta o
   aportar a otra meta, **Then** solo puede usar su saldo disponible, nunca el de la meta.

---

### User Story 3 - Administrar y cerrar metas (Priority: P3)

El estudiante cambia el nombre, el objetivo o la fecha de una meta. Cuando ya no la necesita, la
cierra: Nova le muestra cuánto dinero volverá a su cuenta, le pide confirmar y, al cerrarla, devuelve
todo el saldo en el mismo paso. La meta cerrada queda en su historial, sin acciones.

**Why this priority**: Mejora el control, pero crear, aportar y retirar ya cubren el uso básico.

**Independent Test**: Se cierra una meta con $30.000: el saldo disponible sube $30.000, la meta queda
«Cerrada» con saldo $0 y deja de contar para el máximo de 5.

**Acceptance Scenarios**:

1. **Given** una meta activa, **When** cambia su nombre, objetivo o fecha con valores válidos,
   **Then** se muestran los nuevos valores y el progreso se recalcula.
2. **Given** una meta con saldo, **When** la cierra y confirma, **Then** todo su saldo vuelve a la
   cuenta principal, queda «Cerrada» y ya no admite aportes, retiros ni cambios.
3. **Given** una meta cerrada, **When** el estudiante ve sus metas, **Then** aparece al final, con su
   historial de movimientos.

---

### Edge Cases

- **Aportes o retiros simultáneos**: si llegan a la vez varios movimientos sobre la misma meta o el
  mismo saldo, solo se aplican los que caben; ningún saldo queda negativo.
- **Cerrar mientras se aporta**: si se cierra la meta mientras un aporte está en curso, el aporte se
  aplica antes (y vuelve en el cierre) o se rechaza porque la meta ya está cerrada; nunca se pierde
  dinero.
- **Tope diario**: suma los aportes y retiros del día calendario de Colombia; se reinicia a la
  medianoche de Bogotá. La devolución al cerrar una meta no cuenta ni tiene tope.
- **Fecha límite**: opcional; al crearla o cambiarla debe ser hoy o una fecha futura (hasta 10 años).
  Una meta cuya fecha ya pasó sigue activa y muestra «Fecha vencida».
- **Ahorro sugerido por mes**: solo si hay fecha y falta dinero; es lo que falta dividido entre los
  meses que quedan (mínimo 1).
- **Nombre**: obligatorio, de 1 a 40 caracteres; dos metas pueden llamarse igual.
- **Monto objetivo**: entero entre $1.000 y $100.000.000. Bajar el objetivo por debajo del saldo
  marca la meta como cumplida.
- **Montos de aportes y retiros**: enteros entre $1.000 y $2.000.000; se aceptan «15000», «15.000» y
  «$15.000».

## Requirements *(mandatory)*

### Functional Requirements

**Metas**

- **FR-001**: Un estudiante DEBE poder crear una meta con nombre (1–40 caracteres), monto objetivo
  ($1.000–$100.000.000) y una fecha límite opcional (hoy o futura, hasta 10 años).
- **FR-002**: Un estudiante PUEDE tener hasta 5 metas activas; las cerradas no cuentan.
- **FR-003**: Cada meta DEBE mostrar su saldo, el objetivo, el progreso (porcentaje, sin pasar de
  100 % en la barra), cuánto falta y, si tiene fecha y falta dinero, el ahorro sugerido por mes.
- **FR-004**: Una meta cuyo saldo alcanza o supera el objetivo DEBE mostrarse como «Cumplida».
- **FR-005**: Un estudiante DEBE poder cambiar el nombre, el objetivo y la fecha (o quitarla) de una
  meta activa.
- **FR-006**: La pantalla de metas DEBE mostrar el total ahorrado en metas activas.

**Aportes y retiros**

- **FR-007**: Un aporte DEBE mover dinero del saldo disponible a la meta; un retiro, de la meta al
  saldo disponible. Cada uno se registra en el libro contable con asientos balanceados y se aplica
  completo o no se aplica.
- **FR-008**: El dinero de una meta NO DEBE estar disponible para transferir, pagar con tarjeta ni
  aportar a otra meta hasta que se retire.
- **FR-009**: Un aporte mayor que el saldo disponible, o un retiro mayor que el saldo de la meta,
  DEBE rechazarse indicando el saldo correspondiente; ningún saldo puede quedar negativo.
- **FR-010**: Aportes y retiros DEBEN ser enteros entre $1.000 y $2.000.000, y lo movido en el día
  (hora de Colombia, aportes más retiros) no puede superar $5.000.000. Los tres valores se configuran
  sin cambiar el producto.
- **FR-011**: Una misma solicitud de aporte, retiro o cierre enviada más de una vez DEBE aplicarse una
  sola vez; si la repetición trae datos distintos, DEBE rechazarse.

**Cierre**

- **FR-012**: Al cerrar una meta, el sistema DEBE mostrar antes el saldo que volverá, pedir
  confirmación y, al cerrarla, devolver todo el saldo a la cuenta principal en la misma operación. La
  devolución no está sujeta a los límites de FR-010.
- **FR-013**: Una meta cerrada NO DEBE admitir aportes, retiros ni cambios, y DEBE seguir visible con
  su historial.

**Movimientos y privacidad**

- **FR-014**: Aportes, retiros y devoluciones DEBEN aparecer en el historial de la cuenta principal
  («Aporte a {meta}» con «−», «Retiro de {meta}» con «+») y en el historial de cada meta.
- **FR-015**: Las metas de otro estudiante DEBEN responder como inexistentes.

**Auditoría**

- **FR-016**: Crear y cerrar metas, y cada aporte, retiro y devolución, DEBEN quedar en la auditoría
  con el estudiante, la fecha y hora y el identificador de la solicitud.

### Key Entities

- **Meta de ahorro**: pertenece a un estudiante; tiene nombre, monto objetivo, fecha límite opcional,
  estado (activa o cerrada) y una subcuenta propia en el libro contable con su saldo.
- **Aporte / Retiro**: operación del libro contable entre la cuenta principal y la subcuenta de la
  meta.
- **Movimiento** (vista, spec 002): el aporte o retiro visto desde la cuenta principal o desde la
  meta, con su signo y el nombre de la meta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un estudiante crea una meta y hace su primer aporte en menos de 45 segundos.
- **SC-002**: En el 100 % de los aportes, retiros y cierres, la suma del saldo disponible y los saldos
  de las metas del estudiante no cambia, y la suma del libro contable sigue siendo cero.
- **SC-003**: Ningún saldo (disponible o de meta) queda negativo, ni siquiera con operaciones
  simultáneas.
- **SC-004**: El 100 % de las solicitudes repetidas se aplican una sola vez.
- **SC-005**: El dinero de las metas nunca se puede gastar sin retirarlo antes.
- **SC-006**: Las pantallas cumplen WCAG 2.1 AA y funcionan desde 360 px de ancho.

## Assumptions

- Depende de las specs 001 (estudiantes verificados y sesión) y 002 (cuentas, libro contable,
  idempotencia e historial). Las specs 003 y 004 ya gastan solo el saldo disponible de la cuenta
  principal, así que FR-008 se cumple sin cambiarlas.
- Las metas no generan intereses ni rendimientos (Principio V: no hay dinero real).
- La devolución al cerrar está exenta de los límites de FR-010: es dinero del propio estudiante que
  vuelve a su cuenta sin salir de Nova, y con el límite por movimiento una meta con más de $2.000.000
  no se podría cerrar.
- Quedan fuera: aportes automáticos o programados, redondeos de compras, metas compartidas entre
  estudiantes, iconos o imágenes por meta, reabrir metas cerradas, recordatorios y notificaciones.
