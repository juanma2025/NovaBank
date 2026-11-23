# Feature Specification: Cuenta en COP, libro contable y recarga simulada

**Feature Branch**: `002-cuentas-ledger`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "Cuenta en pesos colombianos para cada estudiante verificado, con su saldo. Todo movimiento de dinero queda registrado en un libro contable de doble entrada que nunca se modifica. El estudiante puede hacer una recarga simulada de su cuenta (no hay conexión con bancos reales). La pantalla de inicio muestra el saldo (que se puede ocultar con un toque), los últimos movimientos y una tarjeta «Muy pronto» que anuncia la futura wallet de criptoactivos. Reemplaza la pantalla de bienvenida provisional de la spec 001."

## Clarifications

### Session 2026-11-22

- Q: ¿Qué límites tiene la recarga simulada? → A: Mínimo $1.000 y máximo $500.000 por recarga, con un
  tope diario de $2.000.000; configurables.
- Q: ¿El historial completo de movimientos entra en esta funcionalidad? → A: Sí, como historia P3
  (pantalla «Ver todos» con páginas de 20).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver mi cuenta y mi saldo al entrar (Priority: P1)

Un estudiante inicia sesión y llega a la pantalla de inicio de Nova. Ve su saldo en pesos
colombianos, sus últimos movimientos y una tarjeta «Muy pronto» que anuncia la wallet de
criptoactivos. Si está en un lugar público, oculta el saldo con un toque y Nova recuerda esa
preferencia en su dispositivo.

Todo estudiante tiene exactamente una cuenta en COP. Se crea sola: al terminar el registro o, para
quienes se registraron antes de esta funcionalidad, la primera vez que entran.

**Why this priority**: Es la cara de la banca: reemplaza la pantalla de bienvenida provisional de
la spec 001 y es la base sobre la que se construyen recargas, transferencias, tarjeta y metas.

**Independent Test**: Se inicia sesión con una cuenta nueva y se comprueba que aparece el saldo en
$0, el estado vacío de movimientos con una invitación a recargar y la tarjeta «Muy pronto». Al
ocultar el saldo y recargar la página, sigue oculto.

**Acceptance Scenarios**:

1. **Given** un estudiante que acaba de crear su cuenta, **When** llega a la pantalla de inicio,
   **Then** ve su saldo «$0», el mensaje de que aún no tiene movimientos con un acceso a «Recargar»
   y la tarjeta «Muy pronto».
2. **Given** un estudiante registrado antes de esta funcionalidad, **When** inicia sesión por
   primera vez después de su lanzamiento, **Then** su cuenta se crea automáticamente con saldo $0.
3. **Given** un estudiante con movimientos, **When** abre la pantalla de inicio, **Then** ve su
   saldo y sus movimientos más recientes, del más nuevo al más antiguo, cada uno con su
   descripción, fecha y monto con signo.
4. **Given** un estudiante en la pantalla de inicio, **When** pulsa el botón de ocultar saldo,
   **Then** el saldo y los montos de los movimientos se reemplazan por «••••••» y, al recargar la
   página en el mismo dispositivo, siguen ocultos hasta que pulse mostrar.
5. **Given** un estudiante en la pantalla de inicio, **When** pulsa la tarjeta «Muy pronto»,
   **Then** ve un mensaje que explica que la wallet de criptoactivos llegará en una próxima fase y
   no ocurre ninguna operación.

---

### User Story 2 - Recargar mi cuenta con dinero de demostración (Priority: P2)

Un estudiante quiere tener saldo para probar Nova. Pulsa «Recargar», escribe un monto o elige uno
sugerido, revisa el resumen y confirma. El saldo aumenta de inmediato y la recarga aparece en sus
movimientos. Nova deja claro en todo momento que es dinero de demostración.

**Why this priority**: Es la única forma de que entre dinero al sistema (constitución, Principio V).
Sin recargas no hay saldo para transferir ni pagar en las siguientes funcionalidades.

**Independent Test**: Con una cuenta en $0, se recargan $50.000 y se comprueba que el saldo pasa a
$50.000, que aparece el movimiento «Recarga simulada +$50.000» y que repetir el envío por un doble
clic no duplica la recarga.

**Acceptance Scenarios**:

1. **Given** un estudiante en la pantalla de recarga, **When** escribe un monto válido y continúa,
   **Then** ve un resumen con el monto y el aviso de que es dinero de demostración, y debe
   confirmar antes de que se haga la recarga.
2. **Given** un estudiante que confirma una recarga válida, **When** termina la operación,
   **Then** su saldo aumenta exactamente en ese monto y la recarga aparece como el movimiento más
   reciente, con estado completada.
3. **Given** un estudiante, **When** escribe un monto menor que el mínimo o mayor que el máximo por
   recarga, **Then** Nova le indica el rango permitido y no le deja continuar.
4. **Given** un estudiante que ya recargó cerca del tope del día, **When** intenta una recarga que
   lo supera, **Then** Nova la rechaza e indica cuánto puede recargar todavía hoy.
5. **Given** un estudiante que pulsa «Confirmar» dos veces o pierde la conexión y reintenta,
   **When** la misma solicitud llega más de una vez, **Then** la recarga se aplica una sola vez.

---

### User Story 3 - Revisar todo mi historial de movimientos (Priority: P3)

Un estudiante quiere revisar movimientos que ya no aparecen en la pantalla de inicio. Pulsa «Ver
todos» y recorre su historial completo, página por página.

**Why this priority**: La pantalla de inicio solo muestra los más recientes. El historial completo
da transparencia sobre el dinero, pero el flujo principal funciona sin él.

**Independent Test**: Con más de 20 movimientos, se abre el historial y se comprueba que muestra los
primeros 20 del más nuevo al más antiguo y que «Cargar más» trae los siguientes sin repetir ninguno.

**Acceptance Scenarios**:

1. **Given** un estudiante con más movimientos de los que caben en la pantalla de inicio, **When**
   pulsa «Ver todos», **Then** ve su historial ordenado del más nuevo al más antiguo, en páginas de
   20.
2. **Given** un estudiante en el historial, **When** llega al final de una página y pide más,
   **Then** se cargan los siguientes sin repetir ni saltar movimientos, aunque mientras tanto
   haya hecho una recarga nueva.
3. **Given** un estudiante sin movimientos, **When** abre el historial, **Then** ve el estado vacío
   con el acceso a «Recargar».

---

### Edge Cases

- **Montos con formato**: el estudiante puede escribir «50000», «50.000» o «$50.000»; Nova lo
  interpreta como cincuenta mil pesos. No se aceptan decimales, negativos ni texto.
- **Recargas simultáneas desde dos pestañas**: ambas se aplican si son solicitudes distintas y
  caben en el tope diario; el saldo final es la suma exacta.
- **Tope diario**: se calcula por día calendario en la hora de Colombia (America/Bogota); a la
  medianoche se reinicia.
- **Misma solicitud repetida con datos distintos**: si una solicitud repetida trae un monto
  diferente, Nova la rechaza en lugar de aplicar cualquiera de las dos.
- **Saldo oculto y recarga**: si el saldo está oculto, el resumen de la recarga sí muestra el monto
  que se va a recargar, pero el saldo resultante sigue oculto.
- **Movimiento de un usuario ajeno**: un estudiante nunca puede ver la cuenta ni los movimientos de
  otro; si lo intenta, Nova responde como si no existieran.
- **Falla durante la recarga**: si algo falla a mitad de la operación, no queda dinero a medias:
  la recarga se aplica completa o no se aplica.

## Requirements *(mandatory)*

### Functional Requirements

**Cuenta y saldo**

- **FR-001**: El sistema DEBE garantizar que cada estudiante tenga exactamente una cuenta en COP,
  creada al terminar el registro o, si no existe, la primera vez que el estudiante entra.
- **FR-002**: El saldo DEBE expresarse en pesos colombianos enteros, sin decimales, con el formato
  colombiano (ej. «$1.250.000»).
- **FR-003**: El saldo de una cuenta DEBE ser siempre igual a la suma de sus movimientos registrados
  y nunca puede ser negativo.
- **FR-004**: Un estudiante solo puede consultar su propia cuenta y sus propios movimientos; un
  intento de acceder a los de otro DEBE responderse como si no existieran.

**Libro contable**

- **FR-005**: Todo movimiento de dinero DEBE registrarse en un libro contable de doble entrada: un
  débito y un crédito por el mismo monto, cuya suma es cero.
- **FR-006**: Los registros del libro contable NUNCA DEBEN modificarse ni borrarse.
- **FR-007**: Cada operación de dinero DEBE tener un estado: pendiente, completada, fallida o
  revertida, y solo puede pasar de pendiente a uno de los otros tres.
- **FR-008**: Toda operación de dinero DEBE aplicarse completa o no aplicarse; nunca puede quedar a
  medias.

**Recarga simulada**

- **FR-009**: El estudiante DEBE poder recargar su cuenta con un monto entero entre $1.000 y
  $500.000 por recarga. El tope diario de recargas es de $2.000.000. Los tres valores se configuran
  sin cambiar el producto (constitución, regla de dominio 6).
- **FR-010**: El sistema DEBE rechazar una recarga que haga superar el tope diario e indicar cuánto
  puede recargar todavía ese día.
- **FR-011**: Antes de aplicar una recarga, el sistema DEBE mostrar un resumen con el monto y pedir
  confirmación explícita.
- **FR-012**: Una misma solicitud de recarga enviada más de una vez DEBE aplicarse una sola vez y
  devolver el mismo resultado; si la repetición trae datos distintos, DEBE rechazarse.
- **FR-013**: La interfaz DEBE indicar en la pantalla de recarga y en el movimiento que se trata de
  dinero de demostración, sin conexión con bancos reales.
- **FR-014**: El sistema DEBE ofrecer montos sugeridos para recargar con un toque.

**Pantalla de inicio**

- **FR-015**: La pantalla de inicio DEBE reemplazar a la pantalla de bienvenida provisional de la
  spec 001 y mostrar el nombre del estudiante, su saldo, sus 5 movimientos más recientes, el acceso
  a «Recargar», el acceso a «Ver todos» y la tarjeta «Muy pronto».
- **FR-016**: El estudiante DEBE poder ocultar y mostrar el saldo con un toque; al ocultarlo, también
  se ocultan los montos de los movimientos. La preferencia DEBE recordarse en ese dispositivo.
- **FR-017**: La tarjeta «Muy pronto» DEBE anunciar la wallet de criptoactivos y, al pulsarla, solo
  mostrar un mensaje informativo, sin ninguna operación (constitución, patrón «Muy pronto»).
- **FR-018**: Cada movimiento DEBE mostrar su descripción, su fecha y hora en la zona de Colombia y su
  monto con signo y color (verde «+» para entradas), además del estado si no está completada.
- **FR-019**: Cada vista DEBE manejar los estados de carga, vacío y error, con mensajes en español.

**Historial**

- **FR-020**: El estudiante DEBE poder ver su historial completo de movimientos, del más nuevo al
  más antiguo, en páginas de 20, sin repetir ni saltar movimientos aunque lleguen movimientos
  nuevos mientras navega.

**Auditoría**

- **FR-021**: Cada recarga DEBE quedar registrada en la auditoría con el estudiante, el monto, la
  fecha y hora y el identificador de la solicitud.

### Key Entities

- **Cuenta**: cuenta en COP de un estudiante (una por estudiante). Tiene su dueño, la moneda, su
  estado y su saldo, que siempre coincide con la suma de sus movimientos.
- **Cuenta del sistema**: cuenta técnica interna desde la que sale el dinero de las recargas
  simuladas, para que cada movimiento tenga su contrapartida en el libro contable. No pertenece a
  ningún estudiante ni se muestra.
- **Operación**: un movimiento de dinero con significado para el estudiante (por ahora, la recarga
  simulada). Tiene tipo, monto, estado, fecha y el identificador que evita aplicarla dos veces.
- **Asiento contable**: cada línea del libro contable. Una operación genera al menos un débito y un
  crédito que suman cero. Nunca se modifica.
- **Movimiento** (vista del estudiante): cómo ve una operación en su cuenta: descripción, fecha,
  monto con signo y estado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un estudiante ve su saldo en menos de 2 segundos después de iniciar sesión.
- **SC-002**: Un estudiante completa una recarga, desde pulsar «Recargar» hasta ver el saldo
  actualizado, en menos de 30 segundos.
- **SC-003**: En cualquier momento, la suma de todos los asientos del libro contable es exactamente
  cero y el saldo de cada cuenta coincide con la suma de sus asientos (verificable por auditoría).
- **SC-004**: El 100 % de las solicitudes de recarga repetidas se aplican una sola vez.
- **SC-005**: Ninguna operación deja un saldo negativo ni dinero a medias, ni siquiera con
  solicitudes simultáneas.
- **SC-006**: Las pantallas de esta funcionalidad cumplen WCAG 2.1 AA y funcionan desde 360 px de
  ancho.

## Assumptions

- Depende de la spec 001: solo los estudiantes con cuenta (correo verificado) tienen cuenta en COP.
- La única moneda es el peso colombiano y no hay intereses, comisiones ni impuestos.
- La recarga simulada es la única forma de que entre dinero; no hay retiros hacia el exterior en
  el MVP (constitución, Principio V).
- No se implementan anulaciones ni reversiones en esta funcionalidad: el estado «revertida» y los
  asientos de reversión se usarán cuando una funcionalidad posterior lo necesite.
- Quedan fuera: transferencias (spec 003), tarjeta (004), metas (005), presupuesto (006), gastos
  compartidos (007), filtros o búsqueda en el historial, exportar movimientos y la wallet de
  criptoactivos (solo la tarjeta «Muy pronto»).
- Los montos sugeridos para recargar son fijos (ej. $20.000, $50.000, $100.000) y se pueden ajustar
  en el plan.
