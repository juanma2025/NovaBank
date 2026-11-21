# Feature Specification: Registro e inicio de sesión de estudiantes

**Feature Branch**: `001-auth-onboarding`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "Registro e inicio de sesión de estudiantes. Solo pueden registrarse personas con correo institucional de una universidad permitida. Al registrarse reciben un código de verificación por correo; sin verificar no pueden usar la banca. El registro pide aceptar el tratamiento de datos personales. Después pueden iniciar y cerrar sesión."

## Clarifications

### Session 2026-11-20

- Q: ¿Cómo debe aplicarse el bloqueo después de 5 intentos fallidos de inicio de sesión? → A: Por
  combinación de correo y dispositivo o red de origen (5 intentos en 15 minutos), más un límite
  global de 20 intentos fallidos por hora para el mismo correo desde cualquier origen.
- Q: ¿Nova debe avisar antes de cerrar la sesión por inactividad? → A: Sí, 1 minuto antes, con
  cuenta regresiva y el botón «Seguir conectado».
- Q: ¿Qué dominios institucionales se habilitan para la demo y las pruebas? → A: `ucc.edu.co`
  (universidad del curso) para la demo y `nova-test.edu.co` (ficticio) solo para las pruebas
  automáticas.
- Q: ¿Qué pasa si la persona recarga o cierra la pestaña a mitad del registro o la recuperación?
  → A: Al volver en el mismo navegador retoma el paso donde estaba, mientras el código o la
  verificación sigan vigentes; en otro navegador empieza de nuevo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registro con correo institucional verificado (Priority: P1)

Una estudiante entra a Nova por primera vez y quiere abrir su cuenta. Escribe su correo
institucional y acepta la política de tratamiento de datos personales. Recibe en ese correo un
código de verificación y lo ingresa en Nova. Con el correo ya comprobado, escribe su nombre
completo y crea una contraseña. Su cuenta queda creada y entra a Nova directamente, sin tener que
iniciar sesión de nuevo.

El registro avanza en tres pasos: (1) correo y aceptación de datos, (2) código de verificación,
(3) nombre y contraseña. La cuenta solo se crea al terminar el paso 3, de modo que nunca existe
una cuenta con un correo sin verificar.

**Why this priority**: Es la puerta de entrada al producto. Sin cuentas de estudiantes
verificados no hay nada más que construir: todas las demás funcionalidades dependen de saber
quién es el usuario y de que sea estudiante.

**Independent Test**: Se puede probar completo registrando un correo de un dominio permitido,
leyendo el código en la bandeja de correo de prueba, completando nombre y contraseña, y
comprobando que el estudiante queda dentro de Nova con su nombre visible.

**Acceptance Scenarios**:

1. **Given** una persona con correo de un dominio permitido que no tiene cuenta, **When** escribe
   su correo, acepta la política de datos y continúa, **Then** recibe un código de verificación en
   ese correo y Nova le pide ingresarlo.
2. **Given** una persona en el paso del código, **When** ingresa el código correcto antes de que
   venza, **Then** Nova le pide su nombre completo y una contraseña.
3. **Given** una persona con el correo verificado, **When** escribe su nombre y una contraseña
   válida, **Then** su cuenta queda creada, la sesión se inicia y ve la pantalla de bienvenida con
   su nombre.
4. **Given** una persona con un correo de un dominio no permitido, **When** intenta continuar en
   el paso 1, **Then** Nova le indica que solo se aceptan correos institucionales de las
   universidades participantes y no envía ningún código.
5. **Given** una persona en el paso 1, **When** intenta continuar sin aceptar la política de
   datos, **Then** Nova no le permite avanzar y le indica que la aceptación es obligatoria.
6. **Given** una persona en el paso del código, **When** ingresa un código incorrecto, **Then**
   Nova le indica que el código no es válido y cuántos intentos le quedan.
7. **Given** una persona en el paso de la contraseña, **When** escribe una contraseña que no
   cumple las reglas, **Then** Nova le explica qué regla no cumple antes de enviarla.

---

### User Story 2 - Inicio y cierre de sesión (Priority: P2)

Un estudiante que ya tiene cuenta vuelve a Nova. Escribe su correo institucional y su contraseña
y entra. Cuando termina, cierra sesión y nadie más puede usar su cuenta desde ese dispositivo.

**Why this priority**: Sin poder volver a entrar, la cuenta creada en la historia 1 solo sirve
una vez. Va después porque la historia 1 ya deja al estudiante dentro de Nova al terminar el
registro.

**Independent Test**: Con una cuenta ya creada, se prueba iniciando sesión con las credenciales
correctas, comprobando que se ve la pantalla de bienvenida, cerrando sesión y comprobando que
volver a una pantalla interna lleva de nuevo al inicio de sesión.

**Acceptance Scenarios**:

1. **Given** un estudiante con cuenta, **When** ingresa su correo y contraseña correctos,
   **Then** entra a Nova y ve la pantalla de bienvenida con su nombre.
2. **Given** cualquier persona, **When** ingresa un correo sin cuenta o una contraseña
   incorrecta, **Then** Nova muestra el mismo mensaje genérico («Correo o contraseña incorrectos»)
   sin revelar cuál de los dos falló.
3. **Given** un estudiante con sesión iniciada, **When** pulsa «Cerrar sesión», **Then** la
   sesión termina en ese dispositivo y vuelve a la pantalla de inicio de sesión.
4. **Given** una persona sin sesión iniciada, **When** intenta abrir una pantalla interna de
   Nova, **Then** es llevada a la pantalla de inicio de sesión y, al entrar, vuelve a la pantalla
   que intentaba abrir.
5. **Given** 5 intentos fallidos para un correo desde el mismo dispositivo o red en los últimos 15
   minutos, **When** se intenta de nuevo desde ese mismo origen, **Then** Nova rechaza el intento e
   indica cuántos minutos faltan para volver a intentarlo, aunque la contraseña sea correcta.
6. **Given** un correo bloqueado desde un dispositivo o red, **When** su dueño inicia sesión con
   la contraseña correcta desde otro dispositivo y otra red, **Then** entra normalmente.

---

### User Story 3 - Recuperar la contraseña olvidada (Priority: P3)

Un estudiante no recuerda su contraseña. En la pantalla de inicio de sesión pulsa «¿Olvidaste tu
contraseña?», escribe su correo institucional y recibe un código. Lo ingresa, crea una contraseña
nueva y vuelve a entrar a Nova con ella. Por seguridad, cualquier sesión que tuviera abierta en
otro dispositivo se cierra.

**Why this priority**: Sin recuperación, un estudiante que olvida su contraseña pierde el acceso
a su dinero para siempre. Va después del registro y el inicio de sesión porque depende de que la
cuenta exista.

**Independent Test**: Con una cuenta creada y una sesión abierta en otro navegador, se pide la
recuperación, se lee el código en la bandeja de prueba, se crea una contraseña nueva y se
comprueba que la anterior ya no sirve, que la nueva sí y que la sesión del otro navegador se
cerró.

**Acceptance Scenarios**:

1. **Given** cualquier persona en la pantalla de recuperación, **When** escribe un correo y
   continúa, **Then** Nova muestra el mismo mensaje exista o no la cuenta («Si el correo tiene
   cuenta, te enviamos un código») y solo envía el código si la cuenta existe.
2. **Given** un estudiante con el código de recuperación, **When** lo ingresa correctamente antes
   de que venza, **Then** Nova le pide una contraseña nueva.
3. **Given** un estudiante con el código verificado, **When** escribe una contraseña nueva válida,
   **Then** la contraseña cambia, todas sus sesiones abiertas se cierran, recibe un aviso por
   correo de que su contraseña cambió y Nova lo lleva a iniciar sesión.
4. **Given** un estudiante que cambió su contraseña, **When** intenta entrar con la anterior,
   **Then** Nova la rechaza con el mensaje genérico de credenciales incorrectas.
5. **Given** un correo bloqueado por intentos fallidos de inicio de sesión, **When** el estudiante
   recupera su contraseña, **Then** el bloqueo se levanta y puede entrar con la contraseña nueva.

---

### User Story 4 - Pedir un código nuevo cuando no llega o vence (Priority: P4)

Una estudiante está registrándose o recuperando su contraseña, pero el código no le llegó, lo
borró sin querer o ya venció. Pide un código nuevo desde la misma pantalla y termina sin empezar
de cero.

**Why this priority**: Los correos institucionales a veces tardan o caen en spam. Sin esta
historia, parte de los estudiantes abandonaría el proceso, pero los flujos principales funcionan
sin ella.

**Independent Test**: Se inicia un registro, se espera a que el código venza (o se agotan los
intentos), se pide uno nuevo y se comprueba que el código anterior ya no sirve y el nuevo sí. Lo
mismo aplica a la recuperación de contraseña.

**Acceptance Scenarios**:

1. **Given** una persona en el paso del código, **When** pulsa «Reenviar código» después de que
   pasó el tiempo de espera, **Then** recibe un código nuevo y el anterior deja de ser válido.
2. **Given** una persona que acaba de recibir un código, **When** intenta pedir otro antes de 60
   segundos, **Then** el botón de reenvío está deshabilitado y muestra cuántos segundos faltan.
3. **Given** una persona con un código vencido, **When** lo ingresa, **Then** Nova le indica que
   el código venció y le ofrece pedir uno nuevo.
4. **Given** una persona que agotó los 5 intentos de un código, **When** intenta otro código,
   **Then** Nova le indica que debe pedir un código nuevo.

---

### Edge Cases

- **Mayúsculas y espacios en el correo**: el correo se compara sin distinguir mayúsculas y sin
  espacios al inicio o al final; `Ana.Perez@UCC.edu.co ` y `ana.perez@ucc.edu.co` son el mismo.
- **Subdominios**: solo se aceptan los dominios exactamente listados. Un subdominio (ej.
  `campus.ucc.edu.co`) se acepta solo si está en la lista.
- **Correo que ya tiene cuenta**: en el paso 1, Nova muestra el mismo mensaje que para un correo
  nuevo («Te enviamos un código si el correo puede registrarse») y, en lugar del código, envía a
  ese correo un aviso de que ya tiene cuenta, con la indicación de iniciar sesión.
- **Registro abandonado después de verificar**: si la persona verificó el código pero no completa
  el paso 3 en 30 minutos, debe empezar el registro de nuevo.
- **Recargar a mitad del proceso**: en el mismo navegador se retoma el paso pendiente (FR-009a);
  la persona no pierde el código que ya recibió.
- **Dos registros simultáneos del mismo correo** (dos pestañas o dispositivos): solo vale el
  último código enviado y solo se puede crear una cuenta por correo.
- **Límite de reenvíos**: un mismo correo puede recibir como máximo 5 códigos por hora; al
  superarlo, Nova indica cuándo podrá pedir otro.
- **Política de datos actualizada**: se guarda la versión exacta del texto que aceptó la persona.
- **Sesión vencida mientras se usa Nova**: la persona es llevada a iniciar sesión con un mensaje
  que explica que su sesión terminó, y al entrar vuelve donde estaba.
- **Varias pestañas abiertas**: el aviso de inactividad y el cierre de sesión se aplican a todas
  las pestañas a la vez; pulsar «Seguir conectado» en una pestaña lo cierra en las demás.
- **Límite de 12 horas**: al cumplirse, la sesión se cierra sin aviso de «Seguir conectado»,
  porque no se puede extender.

## Requirements *(mandatory)*

### Functional Requirements

**Registro y verificación**

- **FR-001**: El sistema DEBE aceptar en el registro solo correos cuyo dominio esté en la lista
  de dominios institucionales permitidos, configurable sin cambiar el producto. La configuración
  de la demo habilita `ucc.edu.co`; las pruebas automáticas usan exclusivamente el dominio
  ficticio `nova-test.edu.co`, que NO DEBE estar habilitado en la demo.
- **FR-002**: El sistema DEBE exigir la aceptación explícita de la política de tratamiento de
  datos personales (Ley 1581 de 2012) antes de enviar el código, y guardar la fecha, la hora y la
  versión del texto aceptado.
- **FR-003**: El sistema DEBE enviar al correo un código de verificación numérico de 6 dígitos,
  de un solo uso, que vence a los 15 minutos.
- **FR-004**: El sistema DEBE permitir como máximo 5 intentos por código; al agotarlos, el código
  queda invalidado.
- **FR-005**: El sistema DEBE permitir pedir un código nuevo con una espera mínima de 60 segundos
  entre envíos y un máximo de 5 envíos por correo por hora. Al emitir un código nuevo, los
  anteriores quedan invalidados.
- **FR-006**: El sistema DEBE crear la cuenta solo después de verificar el correo, al recibir el
  nombre completo y una contraseña válida, y DEBE iniciar la sesión automáticamente al crearla.
- **FR-007**: El sistema DEBE dar 30 minutos, desde la verificación del código, para completar el
  nombre y la contraseña; después, el registro debe empezar de nuevo.
- **FR-008**: El sistema DEBE responder igual en el paso 1 tanto si el correo ya tiene cuenta como
  si no; si ya tiene cuenta, envía un aviso a ese correo en lugar del código.
- **FR-009**: El sistema DEBE garantizar que exista como máximo una cuenta por correo
  institucional.
- **FR-009a**: Si la persona recarga o cierra la pestaña durante el registro o la recuperación de
  contraseña, al volver en el mismo navegador el sistema DEBE llevarla al paso donde estaba
  mientras el código (15 minutos) o la verificación (30 minutos) sigan vigentes. Si ya vencieron,
  o si vuelve desde otro navegador, empieza desde el primer paso.

**Contraseñas y datos personales**

- **FR-010**: Las contraseñas DEBEN tener entre 10 y 128 caracteres, no pueden ser iguales al
  correo ni contener el nombre de usuario del correo, y no pueden estar en una lista de
  contraseñas comunes.
- **FR-011**: El sistema DEBE solicitar solo el correo institucional, el nombre completo y la
  contraseña. No se recolectan otros datos personales en esta funcionalidad.
- **FR-012**: El nombre completo DEBE tener entre 2 y 100 caracteres y admitir tildes, la ñ,
  espacios, guiones y apóstrofos.

**Inicio y cierre de sesión**

- **FR-013**: El sistema DEBE permitir iniciar sesión con correo institucional y contraseña.
- **FR-014**: Ante credenciales incorrectas, el sistema DEBE mostrar un único mensaje genérico,
  sin revelar si el correo tiene cuenta.
- **FR-015**: Después de 5 intentos fallidos para un mismo correo desde el mismo dispositivo o red
  en 15 minutos, el sistema DEBE bloquear los intentos de ese correo desde ese origen durante 15
  minutos. Además, después de 20 intentos fallidos para un mismo correo en una hora desde
  cualquier origen, DEBE bloquear todos los intentos de ese correo durante 15 minutos. Ambos
  bloqueos aplican exista o no la cuenta.
- **FR-016**: La sesión DEBE cerrarse automáticamente tras 15 minutos sin actividad del
  estudiante y, aunque haya actividad, a las 12 horas de haberse iniciado. También termina al
  cerrar sesión. Cuenta como actividad cualquier interacción con Nova (navegar, escribir, pulsar
  un botón) en cualquiera de sus pestañas abiertas.
- **FR-016a**: Al minuto 14 de inactividad, el sistema DEBE mostrar un aviso con cuenta regresiva
  de 60 segundos y el botón «Seguir conectado». Si el estudiante lo pulsa, la sesión continúa; si
  no responde, la sesión se cierra y Nova lo lleva a iniciar sesión con un mensaje que explica
  que su sesión terminó por inactividad.
- **FR-017**: El sistema DEBE permitir cerrar sesión desde cualquier pantalla interna; al
  hacerlo, la sesión deja de ser válida en ese dispositivo.
- **FR-018**: El sistema DEBE llevar a iniciar sesión a quien intente abrir una pantalla interna
  sin sesión válida y, tras iniciar sesión, devolverlo a la pantalla que intentaba abrir.
- **FR-019**: Al iniciar sesión o crear la cuenta, el estudiante DEBE ver una pantalla de
  bienvenida con su nombre y la opción de cerrar sesión. Esta pantalla será reemplazada por la
  pantalla de inicio de la banca en la funcionalidad 002.
**Recuperación de contraseña**

- **FR-020**: El sistema DEBE permitir recuperar la contraseña desde la pantalla de inicio de
  sesión mediante un código enviado al correo institucional, con las mismas reglas de los códigos
  de registro (FR-003, FR-004 y FR-005).
- **FR-020a**: El sistema DEBE responder igual a una solicitud de recuperación exista o no la
  cuenta, y enviar el código solo si existe.
- **FR-020b**: La contraseña nueva DEBE cumplir FR-010 y dar 30 minutos, desde la verificación del
  código, para definirla.
- **FR-020c**: Al cambiar la contraseña por recuperación, el sistema DEBE cerrar todas las
  sesiones abiertas del estudiante, levantar todos los bloqueos por intentos fallidos de su
  correo (por origen y global), enviar un aviso al
  correo y llevar al estudiante a iniciar sesión.

**Seguridad, auditoría y experiencia**

- **FR-021**: El sistema DEBE registrar como evento de auditoría, con fecha, hora y usuario (si
  existe): inicio de registro, verificación de correo, creación de cuenta, inicio de sesión
  exitoso, inicio de sesión fallido, bloqueo por intentos, cierre de sesión (manual o por
  vencimiento), solicitud de recuperación y cambio de contraseña por recuperación.
- **FR-022**: El sistema NUNCA DEBE mostrar ni registrar contraseñas o códigos de verificación en
  texto legible.
- **FR-023**: Todos los mensajes al usuario DEBEN estar en español, ser claros y decir qué hacer a
  continuación.
- **FR-024**: Los formularios DEBEN validar los datos mientras se escriben (formato de correo,
  reglas de contraseña) además de la validación final.
- **FR-025**: Todas las pantallas de esta funcionalidad DEBEN poder usarse solo con teclado,
  con lector de pantalla y en pantallas desde 360 px de ancho.

### Key Entities

- **Estudiante**: persona con cuenta en Nova. Tiene correo institucional (único), nombre
  completo, contraseña protegida, fecha de creación y referencia al consentimiento de datos que
  aceptó.
- **Dominio institucional permitido**: dominio de correo de una universidad participante (ej.
  `ucc.edu.co`). La lista se configura sin cambiar el producto.
- **Verificación por código**: proceso en curso que exige comprobar un correo con un código.
  Tiene un propósito (registro o recuperación de contraseña) y guarda el correo, el código vigente
  (protegido), sus intentos, su vencimiento, el número de envíos y si el correo ya fue verificado.
  En el registro también guarda el consentimiento aceptado.
- **Consentimiento de datos**: aceptación de la política de tratamiento de datos personales, con
  la versión del texto, la fecha y la hora.
- **Sesión**: acceso activo de un estudiante desde un dispositivo, con su inicio, su última
  actividad y su vencimiento.
- **Evento de auditoría**: registro inmutable de un evento de seguridad, con tipo, fecha, hora,
  usuario (si existe) e identificador de la solicitud.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona con correo institucional completa el registro, desde el primer paso
  hasta ver la pantalla de bienvenida, en menos de 3 minutos (sin contar la espera del correo).
- **SC-002**: En el 95 % de los casos el código llega a la bandeja de entrada en menos de 1
  minuto.
- **SC-003**: El 100 % de los intentos de registro con dominios no permitidos se rechazan sin
  enviar ningún correo.
- **SC-004**: Un estudiante con cuenta inicia sesión en menos de 30 segundos y ve la pantalla de
  bienvenida en menos de 2 segundos después de enviar sus datos.
- **SC-005**: Ninguna contraseña ni código de verificación aparece en texto legible en los
  registros del sistema (verificable por auditoría de los registros).
- **SC-006**: No es posible saber si un correo tiene cuenta a partir de los mensajes de registro o
  de inicio de sesión.
- **SC-007**: El 90 % de los estudiantes de prueba completa el registro al primer intento sin
  ayuda.
- **SC-008**: Un estudiante que olvidó su contraseña recupera el acceso en menos de 3 minutos (sin
  contar la espera del correo).
- **SC-009**: Todas las pantallas de esta funcionalidad cumplen WCAG 2.1 AA y se usan sin
  problemas en pantallas de 360 px.

## Assumptions

- La lista de dominios permitidos puede cambiarse sin modificar el producto. Para la demostración
  incluye `ucc.edu.co`; agregar otras universidades es solo un cambio de configuración.
- Los usuarios son mayores de edad. La verificación de edad queda fuera de alcance.
- En desarrollo y pruebas los correos llegan a una bandeja local de prueba; nunca se envían
  correos reales.
- Quedan fuera de esta funcionalidad: cambio de contraseña o de correo con sesión iniciada (solo
  existe el cambio por recuperación),
  edición del perfil, alias de usuario (se define en la funcionalidad 003), verificación en dos
  pasos, inicio de sesión con cuentas externas (Google, Microsoft), cerrar sesión en todos los
  dispositivos y la pérdida del correo institucional al graduarse.
- La pantalla de bienvenida es provisional y será reemplazada por la pantalla de inicio de la
  banca (saldo y movimientos) en la funcionalidad 002.
- Esta es la primera funcionalidad del producto: su implementación también establece la base
  técnica sobre la que se construirán las siguientes.
