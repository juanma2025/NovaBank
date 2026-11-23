# Feature Specification: Página de inicio pública y tema claro/oscuro

**Feature Branch**: `008-landing-publica`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Página pública de presentación de Nova para visitantes sin sesión y selector de tema claro u oscuro. Ya existe una implementación en la rama 002-cuentas-ledger-fe que se especifica aquí para integrarla según el proceso."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conocer Nova antes de registrarme (Priority: P1)

Un estudiante abre Nova por primera vez. En lugar de caer directamente en el formulario de inicio de
sesión, ve una página que explica qué es Nova, qué puede hacer con ella y para quién es, y deja claro
que es un proyecto académico con dinero simulado. Desde ahí puede crear su cuenta o iniciar sesión.

**Why this priority**: Es la primera impresión del producto y explica el carácter académico y
simulado antes del registro (Principio V).

**Independent Test**: Sin sesión, al abrir la dirección principal se ve la página de presentación con
sus secciones y los accesos a «Crear cuenta» e «Iniciar sesión»; con sesión, se entra directo al
inicio de la cuenta.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión, **When** abre la dirección principal de Nova, **Then** ve la
   página de presentación con: encabezado con navegación y accesos, presentación principal, «Qué hace
   Nova», características, «Para estudiantes», cierre y pie de página.
2. **Given** la página de presentación, **When** el visitante pulsa «Crear cuenta» o «Iniciar
   sesión», **Then** llega al registro o al inicio de sesión de la spec 001.
3. **Given** un estudiante con sesión iniciada, **When** abre la dirección principal, **Then** va
   directo al inicio de su cuenta, sin ver la página de presentación.
4. **Given** la sección de características, **When** se muestra, **Then** presenta las funcionalidades
   de la hoja de ruta (cuenta y libro contable, transferencias, tarjeta virtual, metas y presupuesto,
   gastos compartidos) y la wallet de criptoactivos solo con la etiqueta «Muy pronto», sin acciones.
5. **Given** cualquier parte de la página, **When** se muestran datos de ejemplo (saldo, tarjeta,
   movimientos), **Then** se indica que son ilustrativos y que el dinero es simulado.

---

### User Story 2 - Elegir tema claro u oscuro (Priority: P2)

Una estudiante prefiere el modo oscuro aunque su computador está en modo claro. Pulsa el selector de
tema y Nova cambia de inmediato; la próxima vez que abra Nova, sigue en modo oscuro. Si nunca elige,
Nova sigue la preferencia del sistema.

**Why this priority**: Mejora la comodidad visual; la preferencia del sistema ya funciona sin esto
(Principio IV).

**Independent Test**: Sin preferencia guardada, Nova usa el tema del sistema y lo sigue si cambia; al
elegir un tema, se aplica, se recuerda al volver y deja de seguir al sistema.

**Acceptance Scenarios**:

1. **Given** una visitante sin preferencia guardada, **When** abre Nova, **Then** ve el tema de su
   sistema y, si lo cambia, Nova lo sigue.
2. **Given** el selector de tema, **When** lo pulsa, **Then** el tema cambia de inmediato y el selector
   anuncia a los lectores de pantalla a qué tema cambiará.
3. **Given** un tema elegido, **When** vuelve a abrir Nova en el mismo navegador, **Then** se mantiene
   el tema elegido.
4. **Given** un navegador que no permite guardar preferencias, **When** elige un tema, **Then** el
   cambio funciona durante la visita sin errores.

---

### Edge Cases

- **Sin JavaScript de animaciones**: con «reducir movimiento» activado en el sistema, la página no
  anima transiciones ni efectos de inclinación.
- **Pantallas pequeñas**: desde 360 px de ancho la navegación se simplifica y nada se desborda.
- **Selector de tema**: disponible en la página de presentación y en las pantallas con sesión.
- **Datos de ejemplo**: nunca son datos reales de un estudiante; no se consultan a la API.

## Requirements *(mandatory)*

### Functional Requirements

**Página de presentación**

- **FR-001**: Los visitantes sin sesión DEBEN ver la página de presentación en la dirección principal;
  los estudiantes con sesión DEBEN ir directo al inicio de su cuenta.
- **FR-002**: La página DEBE explicar qué es Nova, sus funcionalidades y su público, y ofrecer los
  accesos «Crear cuenta» e «Iniciar sesión».
- **FR-003**: La página DEBE indicar de forma visible que Nova es un proyecto académico con dinero
  simulado, sin conexión con entidades bancarias reales (Principio V).
- **FR-004**: La wallet de criptoactivos solo puede aparecer con la etiqueta «Muy pronto», sin
  acciones (Principio IV, patrón «Muy pronto»).
- **FR-005**: La página DEBE enlazar la política de tratamiento de datos (spec 001).
- **FR-006**: Toda la información de la página es estática: no consulta ni muestra datos de
  estudiantes.

**Tema**

- **FR-007**: Sin preferencia guardada, el tema DEBE seguir la preferencia del sistema y sus cambios.
- **FR-008**: La estudiante DEBE poder cambiar entre tema claro y oscuro; la elección se aplica de
  inmediato en todas las pantallas y se recuerda en ese navegador.
- **FR-009**: Si el navegador no permite guardar la preferencia, el cambio DEBE funcionar durante la
  visita sin errores.

**Calidad**

- **FR-010**: La página y el selector DEBEN cumplir WCAG 2.1 AA: estructura con regiones navegables,
  foco visible, áreas táctiles de 44 px o más, contraste en ambos temas y respeto de «reducir
  movimiento».

### Key Entities

- **Preferencia de tema**: claro u oscuro elegido por la persona en ese navegador; si no existe, se usa
  la del sistema. No es un dato personal ni se envía al servidor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante entiende qué es Nova y llega al registro en menos de 30 segundos.
- **SC-002**: El 100 % de las visitas sin sesión a la dirección principal muestran la página de
  presentación, y el 100 % de las visitas con sesión van al inicio de la cuenta.
- **SC-003**: La elección de tema se mantiene al volver a abrir Nova en el mismo navegador.
- **SC-004**: La página y el selector cumplen WCAG 2.1 AA y funcionan desde 360 px de ancho, en ambos
  temas.

## Assumptions

- Depende de la spec 001 (rutas de registro, inicio de sesión, sesión y política de datos). No requiere
  backend, contratos ni datos nuevos.
- Ya existe una implementación en la rama `002-cuentas-ledger-fe` (commit `cc70c02`). Esta spec la
  formaliza; el frontend la lleva a su propia rama `008-landing-publica-fe` antes de integrarla.
- El texto describe la hoja de ruta: funcionalidades que aún no tienen interfaz (por ejemplo, gastos
  compartidos) se presentan como parte del producto, nunca como acciones disponibles en la página.
- Quedan fuera: blog, preguntas frecuentes, formularios de contacto, analítica de visitas, varios
  idiomas y temas distintos de claro y oscuro.
