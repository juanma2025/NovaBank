# Feature Specification: Tarjeta virtual

**Feature Branch**: `004-tarjeta-virtual`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "Emitir, congelar, ver datos con reautenticación y pagos simulados."

## Clarifications

### Session 2026-11-22

- Q: ¿Cómo se hacen los pagos simulados? → A: En una «Tienda demo» dentro de Nova, con comercios
  ficticios. Para pagar se escriben el número, el vencimiento y el CVV de la tarjeta, como en una
  compra en línea.
- Q: ¿Cuántas tarjetas puede tener cada estudiante? → A: Hasta 3 tarjetas vigentes, cada una con un
  nombre (ej. «Suscripciones») y su propio estado.
- Q: ¿Qué límites tienen los pagos con tarjeta? → A: Entre $1.000 y $500.000 por pago y $1.000.000
  por día sumando todas las tarjetas del estudiante. Configurables.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Emitir y congelar mi tarjeta (Priority: P1)

Una estudiante entra a «Tarjetas» y pulsa «Nueva tarjeta». Le pone un nombre («Compras en línea») y
Nova la emite al instante: la ve como una tarjeta con su nombre, los últimos 4 dígitos y el estado
«Activa». Cuando no la está usando, la congela con un toque; mientras esté congelada, cualquier pago
con ella se rechaza. La descongela cuando la necesita.

**Why this priority**: Sin tarjeta emitida no hay nada más que hacer, y congelarla es la protección
principal que da la constitución (regla de dominio 8).

**Independent Test**: Se emite una tarjeta, se comprueba que solo se ven los últimos 4 dígitos, se
congela y se descongela, y cada cambio queda reflejado en su estado y en la auditoría.

**Acceptance Scenarios**:

1. **Given** una estudiante sin tarjetas, **When** pide una nueva con un nombre válido, **Then** Nova
   la emite activa y le muestra el nombre, los últimos 4 dígitos, el vencimiento y su nombre como
   titular.
2. **Given** una tarjeta activa, **When** la congela, **Then** queda «Congelada» de inmediato.
3. **Given** una tarjeta congelada, **When** la descongela, **Then** vuelve a «Activa».
4. **Given** cualquier pantalla de tarjetas, **When** la estudiante la ve sin pedir los datos
   completos, **Then** solo aparecen los últimos 4 dígitos, nunca el número completo ni el CVV.

---

### User Story 2 - Ver los datos completos con mi contraseña (Priority: P2)

Para pagar en línea, la estudiante necesita el número completo, el vencimiento y el CVV. Pulsa «Ver
datos», escribe su contraseña y Nova se los muestra durante un minuto, con un botón para copiar el
número. Pasado el minuto, o al salir de la pantalla, los datos se ocultan otra vez.

**Why this priority**: Es necesaria para pagar en la tienda demo, pero la tarjeta ya existe y se
protege sin esta historia.

**Independent Test**: Con contraseña correcta se obtienen número, vencimiento y CVV válidos; con una
incorrecta no se obtiene nada; ambos casos quedan auditados.

**Acceptance Scenarios**:

1. **Given** una tarjeta propia, **When** la estudiante escribe su contraseña correcta, **Then** Nova
   le muestra el número completo, el vencimiento y el CVV.
2. **Given** una contraseña incorrecta, **When** la envía, **Then** Nova no muestra nada y se lo
   indica; tras 5 intentos fallidos en 15 minutos, deja de aceptar la contraseña durante 15 minutos.
3. **Given** los datos visibles, **When** pasa un minuto o sale de la pantalla, **Then** se ocultan y
   para volver a verlos debe escribir la contraseña de nuevo.
4. **Given** la tarjeta de otro estudiante, **When** alguien intenta ver sus datos, **Then** Nova
   responde como si no existiera.

---

### User Story 3 - Pagar en la tienda demo (Priority: P2)

La estudiante entra a la «Tienda demo», elige un comercio ficticio (por ejemplo «Cafetería
Central») y escribe el monto. Para pagar escribe el número, el vencimiento y el CVV de su tarjeta.
Si los datos son correctos, la tarjeta está activa y le alcanza el saldo, el pago se aprueba: el
dinero sale de su cuenta y ve el movimiento «Compra en Cafetería Central» con el signo «−» y los
últimos 4 dígitos de la tarjeta. Si la tarjeta está congelada, el pago se rechaza de inmediato.

**Why this priority**: Completa el ciclo de la tarjeta y mueve dinero, pero depende de las dos
historias anteriores.

**Independent Test**: Con una cuenta con $50.000 y una tarjeta activa, se paga $12.000 en un
comercio y el saldo queda en $38.000 con el movimiento correspondiente; con la tarjeta congelada el
mismo pago se rechaza y el saldo no cambia.

**Acceptance Scenarios**:

1. **Given** una tarjeta activa propia y saldo suficiente, **When** paga con los datos correctos,
   **Then** el pago se aprueba, el saldo baja exactamente en el monto y aparece el movimiento con el
   comercio y los últimos 4 dígitos.
2. **Given** una tarjeta congelada o cancelada, **When** intenta pagar, **Then** el pago se rechaza
   sin mover dinero y Nova indica que la tarjeta no está activa.
3. **Given** datos que no coinciden con ninguna de sus tarjetas (número, vencimiento o CVV
   equivocados), **When** intenta pagar, **Then** el pago se rechaza con un mensaje genérico que no
   dice cuál dato falló.
4. **Given** saldo insuficiente, **When** intenta pagar, **Then** el pago se rechaza e indica el
   saldo disponible.
5. **Given** un monto fuera del rango o que supera el tope diario, **When** intenta pagar, **Then** el
   pago se rechaza indicando el límite.
6. **Given** un doble clic en «Pagar» o un reintento tras perder la conexión, **When** la misma
   solicitud llega más de una vez, **Then** el pago se aplica una sola vez.

---

### User Story 4 - Administrar varias tarjetas (Priority: P3)

La estudiante tiene una tarjeta para compras en línea y crea otra llamada «Suscripciones». Puede
cambiarle el nombre a cualquiera. Si cree que alguien vio los datos de una, la cancela: la tarjeta
cancelada deja de funcionar para siempre y libera un cupo para emitir otra con un número distinto.

**Why this priority**: Mejora el control, pero una sola tarjeta ya cubre el uso básico.

**Independent Test**: Se emiten 3 tarjetas, la cuarta se rechaza; se cancela una y se puede emitir
otra con un número diferente; la cancelada rechaza los pagos.

**Acceptance Scenarios**:

1. **Given** una estudiante con menos de 3 tarjetas vigentes, **When** pide otra, **Then** se emite
   con un número distinto al de todas las anteriores.
2. **Given** una estudiante con 3 tarjetas vigentes, **When** pide otra, **Then** Nova le indica que
   alcanzó el máximo.
3. **Given** una tarjeta, **When** le cambia el nombre, **Then** se muestra con el nombre nuevo.
4. **Given** una tarjeta, **When** la cancela y confirma, **Then** queda «Cancelada», no se puede
   descongelar ni usar, y deja de contar para el máximo.

---

### Edge Cases

- **Congelar durante un pago**: si la tarjeta se congela mientras un pago está en curso, el pago se
  resuelve con el estado que tenga la tarjeta al momento de autorizarlo, nunca a medias.
- **Pagos simultáneos que superan el saldo**: solo se aprueban los que caben; el saldo nunca queda
  negativo.
- **Tope diario**: suma los pagos aprobados de todas las tarjetas del estudiante en el día calendario
  de Colombia; se reinicia a la medianoche de Bogotá. Las transferencias y recargas no cuentan.
- **Tarjeta de otro estudiante en la tienda**: la tienda solo acepta tarjetas del estudiante que
  está usando Nova; con datos de otra persona el pago se rechaza con el mensaje genérico.
- **Intentos con datos equivocados**: tras 5 pagos rechazados por datos equivocados en 15 minutos,
  la tienda deja de aceptar pagos del estudiante durante 15 minutos.
- **Formato de los datos**: el número se acepta con o sin espacios («9012 3456 7890 1234»); el
  vencimiento como MM/AA.
- **Nombre de la tarjeta**: obligatorio, de 1 a 30 caracteres; dos tarjetas pueden tener el mismo
  nombre.
- **Cancelar**: es definitivo; pide confirmación. Una tarjeta cancelada sigue apareciendo en la lista
  (para entender sus movimientos), marcada como cancelada.
- **Vencimiento**: las tarjetas vencen 4 años después de emitidas; en el MVP no se renuevan. Una
  tarjeta vencida sigue en la lista, se muestra como vencida, rechaza los pagos con el mismo aviso
  de una tarjeta no activa y cuenta para el máximo de 3 hasta que se cancele.
- **Montos**: enteros entre $1.000 y $500.000; se aceptan «15000», «15.000» y «$15.000».

## Requirements *(mandatory)*

### Functional Requirements

**Emisión y estado**

- **FR-001**: Un estudiante DEBE poder emitir una tarjeta virtual al instante, dándole un nombre de 1
  a 30 caracteres.
- **FR-002**: Un estudiante PUEDE tener hasta 3 tarjetas vigentes (activas o congeladas); las
  canceladas no cuentan.
- **FR-003**: Cada tarjeta DEBE tener un número de 16 dígitos único y válido (dígito de control), un
  vencimiento 4 años después de la emisión, un CVV de 3 dígitos y el nombre del estudiante como
  titular. El número no debe pertenecer a ninguna franquicia real.
- **FR-004**: Un estudiante DEBE poder congelar y descongelar sus tarjetas; el cambio aplica de
  inmediato.
- **FR-005**: Un estudiante DEBE poder cambiar el nombre de sus tarjetas y cancelarlas. La
  cancelación es definitiva y pide confirmación.
- **FR-006**: La emisión de tarjetas DEBE tener un límite de frecuencia para impedir abusos.

**Datos de la tarjeta**

- **FR-007**: En todas las vistas estándar solo se muestran los últimos 4 dígitos del número.
- **FR-008**: El número completo, el vencimiento y el CVV se entregan solo tras reautenticación con
  contraseña. Tras 5 contraseñas incorrectas en 15 minutos, se bloquea la reautenticación durante 15
  minutos.
- **FR-009**: Los datos completos nunca se registran en logs ni quedan guardados en cachés del
  cliente; la interfaz los oculta tras un minuto o al salir de la pantalla.
- **FR-010**: Las tarjetas de otro estudiante DEBEN responder como inexistentes.

**Pagos en la tienda demo**

- **FR-011**: La tienda demo DEBE ofrecer una lista fija de comercios ficticios, cada uno con nombre
  y categoría (ej. Cafetería, Librería, Transporte, Papelería, Entretenimiento).
- **FR-012**: Para pagar, el estudiante DEBE escribir número, vencimiento y CVV; el pago se autoriza
  solo si coinciden con una tarjeta suya.
- **FR-013**: Una tarjeta congelada, cancelada o vencida DEBE rechazar toda autorización de
  inmediato. Una tarjeta vence al terminar su mes de vencimiento (hora de Colombia).
- **FR-014**: Si los datos no coinciden, el rechazo DEBE ser genérico, sin indicar qué dato falló.
  Tras 5 rechazos por datos equivocados en 15 minutos, la tienda deja de aceptar pagos del
  estudiante durante 15 minutos.
- **FR-015**: El monto DEBE ser un entero entre $1.000 y $500.000 por pago, y los pagos aprobados del
  día (hora de Colombia, todas las tarjetas) no pueden superar $1.000.000. Los tres valores se
  configuran sin cambiar el producto.
- **FR-016**: El sistema DEBE rechazar el pago si el saldo no alcanza e indicar el saldo disponible;
  el saldo nunca puede quedar negativo.
- **FR-017**: Un pago aprobado DEBE registrarse en el libro contable con asientos balanceados (débito
  al estudiante, crédito a una cuenta técnica de comercios simulados) y aplicarse completo o no
  aplicarse.
- **FR-018**: Una misma solicitud de pago enviada más de una vez DEBE aplicarse una sola vez; si la
  repetición trae datos distintos, DEBE rechazarse.

**Movimientos**

- **FR-019**: El estudiante DEBE ver cada pago aprobado como movimiento con signo «−», la
  descripción «Compra en {comercio}» y los últimos 4 dígitos de la tarjeta, en la pantalla de inicio
  y en el historial de la spec 002.
- **FR-020**: Cada tarjeta DEBE mostrar sus propios pagos aprobados, del más reciente al más antiguo.

**Auditoría**

- **FR-021**: Emitir, congelar, descongelar, cancelar, ver los datos completos y cada pago aprobado
  DEBEN quedar en la auditoría con el estudiante, la fecha y hora y el identificador de la
  solicitud, sin datos de la tarjeta más allá de los últimos 4 dígitos.

### Key Entities

- **Tarjeta virtual**: pertenece a un estudiante; tiene nombre, últimos 4 dígitos, vencimiento,
  titular, estado (activa, congelada o cancelada) y datos protegidos (número completo y CVV).
- **Comercio simulado**: comercio ficticio de la tienda demo con nombre y categoría.
- **Pago con tarjeta**: operación del libro contable de tipo pago con tarjeta, con monto, comercio,
  tarjeta usada y estado.
- **Movimiento** (vista, spec 002): el pago visto desde la cuenta del estudiante, con signo «−», el
  comercio y los últimos 4 dígitos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un estudiante emite una tarjeta en menos de 15 segundos desde que entra a «Tarjetas».
- **SC-002**: El 100 % de los intentos de pago con una tarjeta congelada o cancelada se rechazan sin
  mover dinero.
- **SC-003**: Un estudiante completa un pago en la tienda demo, desde elegir el comercio hasta ver
  el saldo actualizado, en menos de 60 segundos.
- **SC-004**: En el 100 % de los pagos aprobados el saldo baja exactamente en el monto y la suma del
  libro contable sigue siendo cero; ningún pago deja un saldo negativo, ni siquiera con pagos
  simultáneos.
- **SC-005**: Ninguna respuesta, log o pantalla estándar contiene el número completo ni el CVV; solo
  la vista tras reautenticación los muestra.
- **SC-006**: Las pantallas cumplen WCAG 2.1 AA y funcionan desde 360 px de ancho.

## Assumptions

- Depende de las specs 001 (estudiantes verificados, sesión, contraseña), 002 (cuentas, libro
  contable, idempotencia, historial) y 003 (reautenticación con contraseña y su bloqueo, que se
  comparte: los fallos al ver los datos y al transferir cuentan juntos).
- La tarjeta gasta el saldo de la cuenta principal del estudiante; no tiene saldo propio ni cupo de
  crédito.
- La tienda demo es parte de Nova y solo la usa el estudiante con su sesión iniciada; no hay
  comercios ni sistemas externos (Principio V).
- Las categorías de los comercios quedan guardadas en cada pago para que la spec 006 (presupuesto)
  pueda usarlas.
- Quedan fuera: tarjetas físicas, billeteras móviles (Apple Pay, Google Pay), devoluciones y
  reversos de pagos, compras en cuotas, pagos recurrentes, renovar tarjetas vencidas, límites
  personalizados por tarjeta y notificaciones de cada compra.
