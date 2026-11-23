# Feature Specification: Transferencias entre estudiantes

**Feature Branch**: `003-transferencias`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "Envíos de dinero entre estudiantes verificados, identificando al destinatario por su correo institucional o por su alias, con idempotencia y límites."

## Clarifications

### Session 2026-11-22

- Q: ¿Cómo funciona el alias para recibir transferencias? → A: Opcional, único y editable (ej.
  `@ana.perez`, 3–20 caracteres: letras, números, punto y guion bajo). Siempre se puede recibir por
  correo institucional.
- Q: ¿Qué límites tienen las transferencias? → A: Máximo $500.000 por transferencia y $1.000.000
  enviados por día; las mayores a $200.000 piden la contraseña antes de confirmar. Configurables.
- Q: ¿Qué ve quien envía sobre el destinatario antes de confirmar? → A: Su nombre parcial (primer
  nombre e iniciales del resto, ej. «Ana P. G.») y su correo enmascarado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enviar dinero a un compañero (Priority: P1)

Un estudiante le debe $15.000 a una compañera. Pulsa «Enviar», escribe el correo institucional o el
alias de ella, el monto y, si quiere, una nota («almuerzo del martes»). Nova le muestra el nombre
parcial y el correo enmascarado de la destinataria para que confirme que es la persona correcta.
Confirma y el dinero sale de su cuenta y entra de inmediato en la de ella. Ambos ven el movimiento
en su historial: él con signo «−» y ella con signo «+».

Si el monto supera $200.000, Nova le pide su contraseña antes de enviar.

**Why this priority**: Es la razón de ser de una banca entre estudiantes y el primer movimiento de
dinero entre personas. Usa el libro contable y la idempotencia de la spec 002.

**Independent Test**: Con dos cuentas, una con $50.000, se envían $15.000 por correo y se comprueba
que el saldo del que envía queda en $35.000, el de la destinataria aumenta $15.000 y cada uno ve el
movimiento con su signo y la nota.

**Acceptance Scenarios**:

1. **Given** un estudiante con saldo suficiente, **When** escribe el correo o el alias de un
   compañero y un monto válido, **Then** Nova le muestra el nombre parcial y el correo enmascarado
   del destinatario, el monto y la nota, y le pide confirmar.
2. **Given** un estudiante que confirma una transferencia válida, **When** termina la operación,
   **Then** su saldo baja exactamente en el monto, el del destinatario sube exactamente en el monto y
   ambos ven el movimiento con su signo, la contraparte y la nota.
3. **Given** un estudiante, **When** escribe un correo o alias que no corresponde a ningún
   estudiante, **Then** Nova le indica que no encontró a ese estudiante y no deja continuar.
4. **Given** un estudiante, **When** intenta enviarse dinero a sí mismo, **Then** Nova se lo impide
   con un mensaje claro.
5. **Given** un estudiante sin saldo suficiente, **When** intenta enviar más de lo que tiene,
   **Then** Nova rechaza la transferencia, le indica su saldo disponible y no mueve dinero.
6. **Given** un estudiante que envía más de $200.000, **When** confirma, **Then** Nova le pide su
   contraseña; si es incorrecta, no envía nada y se lo indica.
7. **Given** un estudiante que pulsa «Confirmar» dos veces o reintenta tras perder la conexión,
   **When** la misma solicitud llega más de una vez, **Then** la transferencia se aplica una sola
   vez.

---

### User Story 2 - Elegir mi alias (Priority: P2)

Una estudiante quiere que le transfieran sin dictar su correo institucional. En su perfil elige el
alias `@ana.perez`. Si alguien más ya lo tiene, Nova se lo indica. Más adelante lo cambia o lo
quita; el alias anterior queda libre para otros.

**Why this priority**: Facilita recibir dinero, pero transferir por correo ya funciona sin alias.

**Independent Test**: Se asigna un alias a una cuenta, otro estudiante transfiere usando ese alias y
el dinero llega. Al cambiar el alias, el anterior deja de encontrar a la estudiante.

**Acceptance Scenarios**:

1. **Given** una estudiante sin alias, **When** escribe un alias válido y libre y lo guarda,
   **Then** queda asignado y otros pueden transferirle con él.
2. **Given** un alias que ya usa otro estudiante, **When** intenta guardarlo, **Then** Nova le indica
   que no está disponible.
3. **Given** un alias con formato inválido (muy corto, con espacios o símbolos no permitidos),
   **When** lo escribe, **Then** Nova le explica la regla antes de guardar.
4. **Given** una estudiante con alias, **When** lo cambia o lo quita, **Then** el alias anterior deja
   de identificarla y queda libre.

---

### Edge Cases

- **Mayúsculas y la arroba**: `@Ana.Perez`, `ana.perez` y `@ana.perez` son el mismo alias; se guarda
  en minúsculas y sin la arroba. El correo se normaliza igual que en la spec 001.
- **Transferencias cruzadas simultáneas**: si A le envía a B y B le envía a A al mismo tiempo, ambas
  se aplican correctamente y ninguna queda bloqueada para siempre.
- **Saldo justo**: enviar exactamente todo el saldo está permitido y deja la cuenta en $0.
- **Dos envíos simultáneos que juntos superan el saldo**: solo se aplican los que caben; el saldo
  nunca queda negativo.
- **Tope diario**: suma lo enviado en el día calendario de Colombia; lo recibido no cuenta. Se
  reinicia a la medianoche de Bogotá.
- **Cambio de alias del destinatario entre la vista previa y la confirmación**: la transferencia va
  a la persona que se mostró en la vista previa, no a quien tenga ese alias después.
- **Contraseña incorrecta repetida**: tras 5 intentos fallidos en 15 minutos, Nova deja de aceptar
  la contraseña para transferir durante 15 minutos.
- **Nota**: opcional, hasta 140 caracteres; se muestra a ambos.
- **Montos**: enteros entre $1.000 y $500.000; se aceptan «15000», «15.000» y «$15.000».

## Requirements *(mandatory)*

### Functional Requirements

**Destinatario**

- **FR-001**: El estudiante DEBE poder identificar al destinatario por su correo institucional o por
  su alias.
- **FR-002**: Antes de confirmar, el sistema DEBE mostrar el nombre parcial del destinatario (primer
  nombre e iniciales del resto) y su correo enmascarado; nunca su nombre completo ni su correo
  completo.
- **FR-003**: Si no existe un estudiante con ese correo o alias, el sistema DEBE indicarlo sin
  revelar otros datos.
- **FR-004**: El sistema DEBE impedir que un estudiante se transfiera a sí mismo.
- **FR-005**: La transferencia DEBE ir a la cuenta del estudiante mostrado en la vista previa, aunque
  el alias cambie de dueño antes de confirmar.

**Transferencia**

- **FR-006**: El monto DEBE ser un entero entre $1.000 y $500.000 por transferencia, y lo enviado en
  el día (hora de Colombia) no puede superar $1.000.000. Los tres valores se configuran sin cambiar
  el producto.
- **FR-007**: El sistema DEBE rechazar la transferencia si el saldo no alcanza e indicar el saldo
  disponible; el saldo nunca puede quedar negativo.
- **FR-008**: Las transferencias mayores a $200.000 (configurable) DEBEN pedir la contraseña del
  estudiante; si es incorrecta, no se envía nada. Tras 5 contraseñas incorrectas en 15 minutos, se
  bloquea la confirmación con contraseña durante 15 minutos.
- **FR-009**: Antes de enviar, el sistema DEBE mostrar un resumen (destinatario, monto, nota) y pedir
  confirmación explícita.
- **FR-010**: Una transferencia DEBE registrarse en el libro contable con dos asientos (débito al que
  envía, crédito al que recibe) y aplicarse completa o no aplicarse.
- **FR-011**: Una misma solicitud de transferencia enviada más de una vez DEBE aplicarse una sola
  vez; si la repetición trae datos distintos, DEBE rechazarse.
- **FR-012**: La nota es opcional, de hasta 140 caracteres, y la ven ambos.

**Movimientos**

- **FR-013**: Quien envía DEBE ver el movimiento con signo «−» y la descripción «Transferencia a
  {nombre parcial}»; quien recibe, con signo «+» y «Transferencia de {nombre parcial}». Ambos ven la
  nota.
- **FR-014**: Las transferencias DEBEN aparecer en la pantalla de inicio y en el historial de la
  spec 002, en orden con el resto de movimientos.

**Alias**

- **FR-015**: Cada estudiante PUEDE tener un alias opcional de 3 a 20 caracteres: letras minúsculas
  sin tilde, números, punto y guion bajo; no puede empezar ni terminar con punto o guion bajo.
- **FR-016**: Un alias DEBE ser único entre todos los estudiantes, sin distinguir mayúsculas.
- **FR-017**: El estudiante DEBE poder asignar, cambiar y quitar su alias; el anterior queda libre.

**Auditoría**

- **FR-018**: Cada transferencia y cada cambio de alias DEBEN quedar en la auditoría con el
  estudiante, la fecha y hora y el identificador de la solicitud.

### Key Entities

- **Alias**: identificador opcional y único de un estudiante para recibir transferencias.
- **Transferencia**: operación del libro contable de tipo transferencia entre dos cuentas de
  estudiantes, con monto, nota opcional, estado y contraparte.
- **Movimiento** (vista, spec 002): para cada participante, la transferencia vista desde su cuenta,
  con su signo, la descripción con la contraparte y la nota.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un estudiante completa una transferencia, desde «Enviar» hasta ver el saldo
  actualizado, en menos de 45 segundos.
- **SC-002**: En el 100 % de las transferencias, el saldo del que envía baja y el del que recibe sube
  exactamente en el monto, y la suma del libro contable sigue siendo cero.
- **SC-003**: Ninguna transferencia deja un saldo negativo, ni siquiera con envíos simultáneos.
- **SC-004**: El 100 % de las solicitudes repetidas se aplican una sola vez.
- **SC-005**: Las transferencias cruzadas simultáneas entre dos estudiantes nunca quedan bloqueadas.
- **SC-006**: Las pantallas cumplen WCAG 2.1 AA y funcionan desde 360 px de ancho.

## Assumptions

- Depende de las specs 001 (estudiantes verificados, sesión, contraseña) y 002 (cuentas, libro
  contable, idempotencia, historial).
- Todos los estudiantes con cuenta están verificados (spec 001), así que todo destinatario
  encontrado puede recibir.
- Quedan fuera: solicitudes de cobro (la spec 007 cubre gastos compartidos), transferencias
  programadas o recurrentes, contactos frecuentes o favoritos, cancelar o revertir una
  transferencia, notificaciones por correo o push al destinatario y transferencias a bancos
  externos.
- La recepción no tiene límites: lo recibido no cuenta para el tope diario de quien recibe.
