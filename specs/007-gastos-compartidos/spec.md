# Feature Specification: Gastos compartidos

**Feature Branch**: `007-gastos-compartidos`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Dividir un gasto entre compañeros y pagar cada parte con una transferencia."

## Clarifications

### Session 2026-11-23

- Q: ¿Cómo se divide el gasto? → A: Nova propone partes iguales; el sobrante de pesos lo asume quien
  crea la división. Quien crea puede ajustar el monto de cada persona; la suma siempre debe dar el
  total.
- Q: ¿Cómo se paga cada parte? → A: Cada participante pulsa «Pagar mi parte» y Nova hace una
  transferencia normal a quien creó la división, con todos sus límites y la contraseña cuando
  corresponda. Quien creó la división también puede marcar una parte como «pagada por fuera»
  (efectivo), sin mover dinero.
- Q: ¿Cómo se enteran los participantes? → A: En Nova y por correo: al ser incluidos, y quien creó la
  división recibe un correo cuando alguien paga en Nova.
- Q: ¿Qué más se puede hacer? → A: Un participante puede rechazar su parte; quien creó la división
  puede cancelarla y enviar recordatorios a quienes no han pagado (máximo uno por día por persona).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dividir un gasto y pagar mi parte (Priority: P1)

Ana pagó $90.000 de la cena del grupo. En «Gastos compartidos» crea «Cena de cumpleaños», escribe el
total y agrega a Juan y a Laura por su correo o su alias. Nova propone $30.000 para cada uno. Juan y
Laura reciben un correo y ven la solicitud en Nova. Juan pulsa «Pagar mi parte»: Nova le transfiere
$30.000 a Ana y su parte queda pagada. Ana ve quién ya pagó y quién no, y recibe un correo con cada
pago.

**Why this priority**: Es el flujo completo de la funcionalidad; sin él no hay gastos compartidos.

**Independent Test**: Ana divide $90.000 entre ella, Juan y Laura; Juan paga su parte: el saldo de Juan
baja $30.000, el de Ana sube $30.000, la parte de Juan queda pagada y la división sigue abierta hasta
que Laura pague.

**Acceptance Scenarios**:

1. **Given** una estudiante, **When** crea una división con título, total y participantes válidos,
   **Then** Nova propone partes iguales (el sobrante lo asume ella), la división queda abierta y cada
   participante recibe un correo y la ve pendiente en Nova.
2. **Given** una división con partes ajustadas, **When** la suma de las partes (incluida la de quien
   crea) no da el total, **Then** Nova no la guarda y lo indica.
3. **Given** un participante con una parte pendiente, **When** pulsa «Pagar mi parte» y confirma,
   **Then** Nova hace una transferencia normal por el monto de su parte a quien creó la división, con
   la nota «Gasto compartido: {título}», y la parte queda pagada.
4. **Given** una parte por encima del umbral de contraseña de las transferencias, **When** la paga,
   **Then** Nova le pide su contraseña, como en cualquier transferencia.
5. **Given** un participante sin saldo suficiente o que superó su tope diario, **When** intenta pagar,
   **Then** el pago se rechaza con el mismo mensaje de una transferencia y la parte sigue pendiente.
6. **Given** un doble clic en «Pagar mi parte», **When** la solicitud llega más de una vez, **Then** se
   transfiere una sola vez.
7. **Given** que todos los participantes pagaron, rechazaron o fueron marcados como pagados por fuera,
   **When** se resuelve la última parte, **Then** la división queda completada.

---

### User Story 2 - Seguir y gestionar mis divisiones (Priority: P2)

Ana ve en el inicio cuánto le deben y cuánto debe ella. Laura le pagó en efectivo, así que Ana marca
su parte como pagada por fuera. Un compañero que Ana agregó por error rechaza su parte. A quien sigue
sin pagar, Ana le envía un recordatorio. Si el plan se cae, Ana cancela la división.

**Why this priority**: Completa el ciclo, pero pagar ya funciona sin estas acciones.

**Independent Test**: Sobre una división abierta, marcar una parte como pagada por fuera no mueve
dinero; rechazar una parte la deja rechazada; un segundo recordatorio el mismo día se rechaza;
cancelar deja las partes pendientes canceladas y no devuelve las ya pagadas.

**Acceptance Scenarios**:

1. **Given** una estudiante con divisiones, **When** abre «Gastos compartidos», **Then** ve las que creó
   y en las que participa, de la más reciente a la más antigua, con su estado; en el inicio ve cuánto
   le deben y cuánto debe en divisiones abiertas.
2. **Given** una parte pendiente, **When** quien creó la división la marca como pagada por fuera,
   **Then** queda así sin mover dinero.
3. **Given** un participante con una parte pendiente, **When** la rechaza, **Then** queda rechazada y no
   se le pide pagar.
4. **Given** una parte pendiente, **When** quien creó la división envía un recordatorio, **Then** el
   participante recibe un correo; un segundo recordatorio a la misma persona antes de 24 horas se
   rechaza indicando cuándo podrá enviarlo.
5. **Given** una división abierta, **When** quien la creó la cancela, **Then** las partes pendientes
   quedan canceladas, las pagadas siguen pagadas (no se devuelve dinero) y ya nadie puede pagar.
6. **Given** una división, **When** la consulta alguien que no la creó ni participa, **Then** Nova
   responde como si no existiera.

---

### Edge Cases

- **Partes iguales**: con $10.000 entre 3 personas, Juan y Laura deben $3.333 y quien crea asume
  $3.334.
- **Parte de quien crea**: puede ser $0 (por ejemplo, si invitó la cena y no consumió), pero nunca
  negativa.
- **Monto de cada parte**: entre el mínimo y el máximo de una transferencia ($1.000 y $500.000),
  porque se paga con una sola transferencia.
- **Participantes**: de 1 a 10 estudiantes de Nova, sin repetir y sin incluir a quien crea.
- **Total**: entero entre $2.000 y $5.000.000.
- **Título**: obligatorio, de 1 a 60 caracteres.
- **Pagar mientras se cancela**: si la división se cancela mientras un pago está en curso, el pago se
  aplica antes (y la parte queda pagada) o se rechaza; nunca se transfiere por una parte cancelada.
- **Dos pagos simultáneos de la misma parte**: solo uno transfiere.
- **Presupuesto**: el pago de una parte es una transferencia enviada y cuenta en «Transferencias» del
  presupuesto de quien paga (spec 006), donde puede reclasificarla.
- **Reembolsos**: cancelar no devuelve las partes pagadas; si hace falta, quien creó la división hace
  una transferencia normal.

## Requirements *(mandatory)*

### Functional Requirements

**Crear**

- **FR-001**: Una estudiante DEBE poder crear una división con título (1–60 caracteres), total
  ($2.000–$5.000.000) y de 1 a 10 participantes identificados por correo institucional o alias.
- **FR-002**: El sistema DEBE proponer partes iguales entre quien crea y los participantes, con el
  sobrante de pesos a cargo de quien crea; quien crea PUEDE ajustar cada parte.
- **FR-003**: La suma de las partes de los participantes más la de quien crea DEBE ser igual al total;
  la de quien crea no puede ser negativa y cada parte de un participante debe estar entre el mínimo y
  el máximo de una transferencia.
- **FR-004**: Crear una división NO DEBE mover dinero (regla de dominio 11).

**Pagar**

- **FR-005**: Un participante DEBE poder pagar su parte pendiente con una transferencia a quien creó la
  división, sujeta a todas las reglas de las transferencias de la spec 003 (saldo, límites,
  contraseña por encima del umbral e idempotencia).
- **FR-006**: La transferencia y el cambio de la parte a «pagada» DEBEN aplicarse juntos o no
  aplicarse; una parte nunca se paga dos veces.
- **FR-007**: Quien creó la división DEBE poder marcar una parte pendiente como «pagada por fuera», sin
  mover dinero.
- **FR-008**: Un participante DEBE poder rechazar su parte pendiente.
- **FR-009**: La división DEBE quedar completada cuando ninguna parte quede pendiente.

**Gestionar**

- **FR-010**: Quien creó una división abierta DEBE poder cancelarla: las partes pendientes quedan
  canceladas y las pagadas se mantienen.
- **FR-011**: Quien creó la división DEBE poder enviar un recordatorio por correo a un participante con
  la parte pendiente, como máximo uno cada 24 horas por participante.
- **FR-012**: Cada estudiante DEBE ver las divisiones que creó y en las que participa, y un resumen de
  cuánto le deben y cuánto debe en divisiones abiertas.
- **FR-013**: En cada división se muestran el título, el total, el nombre parcial de quien la creó y de
  cada participante, el monto y el estado de cada parte; nunca el correo completo.
- **FR-014**: Las divisiones en las que una estudiante no participa DEBEN responder como inexistentes.

**Avisos**

- **FR-015**: Cada participante DEBE recibir un correo al ser incluido, y quien creó la división uno
  cada vez que alguien paga su parte en Nova.

### Key Entities

- **División**: gasto con título, total, quien la creó, su propia parte y estado (abierta, completada
  o cancelada).
- **Parte**: lo que debe un participante de una división, con su monto y estado (pendiente, pagada,
  pagada por fuera, rechazada o cancelada) y, si se pagó en Nova, la transferencia que la pagó.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una estudiante crea una división con 3 participantes en menos de 60 segundos.
- **SC-002**: Un participante paga su parte en menos de 30 segundos desde que abre la solicitud.
- **SC-003**: El 100 % de los pagos de partes se hacen con una transferencia normal y ninguna parte se
  paga dos veces, ni siquiera con pagos simultáneos.
- **SC-004**: Crear, rechazar, marcar como pagada por fuera, recordar o cancelar nunca mueven dinero.
- **SC-005**: Las pantallas cumplen WCAG 2.1 AA y funcionan desde 360 px de ancho.

## Assumptions

- Depende de las specs 001 (sesión y correo) y 003 (destinatarios por correo o alias, nombre parcial
  y transferencias con todas sus reglas).
- Los participantes se eligen con la misma vista previa de destinatario de la spec 003.
- Quedan fuera: divisiones por porcentaje, recibos o fotos, gastos recurrentes, grupos guardados,
  editar una división ya creada, reembolsos automáticos al cancelar y notificaciones push.
