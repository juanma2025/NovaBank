# Feature Specification: Página de inicio pública y tema claro/oscuro

**Feature Branch**: `008-landing-publica`

**Created**: 2026-11-23 | **Updated**: 2026-11-23

**Status**: Draft

**Input**: User description: "Experiencia pública multipágina de Nova para visitantes sin sesión (inicio minimalista en `/`, características en `/caracteristicas` y público/seguridad en `/estudiantes`) con barra superior fija sin accesos duplicados al pie, y selector de tema claro (blanco opaco con borde sólido estático) u oscuro (negro sólido OLED con contornos iluminados azul hielo/violeta animados en CSS puro)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conocer Nova antes de registrarme sin ruido visual (Priority: P1)

Un estudiante abre Nova por primera vez. En `/` encuentra una primera vista limpia y despejada con
lo primordial: qué es Nova, una vista previa ilustrativa de la cuenta en COP (marcada como dinero
simulado) y accesos claros a `/caracteristicas` y `/estudiantes` desde la barra superior y tarjetas
breves de navegación. Los botones «Iniciar sesión» y «Crear cuenta» viven únicamente en la barra
superior fija para mantener el foco y evitar repeticiones al final de cada pantalla.

**Why this priority**: Es la primera impresión del producto; comunica qué es Nova y su carácter
académico simulado (Principio V) sin saturar la primera vista.

**Independent Test**: Sin sesión, `/` muestra la presentación minimalista con vista previa
ilustrativa y navegación pública hacia `/caracteristicas` y `/estudiantes`; «Iniciar sesión» y
«Crear cuenta» aparecen únicamente en el navbar; con sesión activa, `/` redirige a `/inicio`.

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión, **When** abre `/`, **Then** ve una primera vista despejada con
   titular breve, subtítulo de 1–2 líneas, una única tarjeta de vista previa ilustrativa en COP
   simulados y 2–3 accesos breves hacia `/caracteristicas` y `/estudiantes`, sin repetir botones de
   acceso al final ni en el pie de página.
2. **Given** cualquier página pública (`/`, `/caracteristicas` o `/estudiantes`), **When** el
   visitante usa la barra superior fija, **Then** puede navegar entre `Inicio`, `Características` y
   `Estudiantes` con indicador activo, o ir a «Iniciar sesión» (`/ingresar`) y «Crear cuenta»
   (`/registro`).
3. **Given** un estudiante con sesión iniciada, **When** abre `/`, **Then** va directo a `/inicio`,
   sin ver la página de presentación pública.
4. **Given** la vista `/caracteristicas`, **When** se muestra, **Then** presenta qué hace Nova y las
   funcionalidades de la hoja de ruta (cuenta COP y libro contable, transferencias, tarjeta virtual,
   metas y presupuesto, gastos compartidos — sin presentar nada pendiente como acción interactiva) y
   la wallet de criptoactivos únicamente con la etiqueta «Muy pronto», sin acciones.
5. **Given** la vista `/estudiantes`, **When** se muestra, **Then** explica que Nova está dirigida a
   estudiantes universitarios en Colombia con correo institucional, sus pilares de seguridad
   (verificación por código, cookies `HttpOnly`, Ley 1581 con enlace a `/privacidad`) y su carácter
   académico con dinero simulado.

---

### User Story 2 - Elegir tema claro u oscuro con identidad visual diferenciada (Priority: P2)

Una estudiante prefiere el modo oscuro o el modo claro independientemente de la configuración de su
equipo. Pulsa el selector de tema y Nova cambia de inmediato entre un modo oscuro OLED de negro
sólido con contornos iluminados azul hielo/violeta y un modo claro en blanco opaco/porcelana con
contornos sólidos estáticos de marca. La preferencia se recuerda en el navegador; si nunca elige,
Nova sigue la preferencia del sistema.

**Why this priority**: Refuerza la comodidad visual y la estética Apple-grade en ambos entornos de
iluminación cumpliendo WCAG 2.1 AA (Principio IV).

**Independent Test**: Sin preferencia guardada, Nova sigue `prefers-color-scheme`; al elegir tema,
aplica `data-theme="dark" | "light"` en `<html>`, persiste en `localStorage['nova:theme']`, deja de
seguir cambios del sistema y funciona en memoria si el navegador bloquea el almacenamiento.

**Acceptance Scenarios**:

1. **Given** una visitante sin preferencia guardada, **When** abre Nova, **Then** ve el tema de su
   sistema y, si este cambia, Nova lo sigue.
2. **Given** el selector de tema en el navbar público o en las pantallas con sesión, **When** lo
   pulsa, **Then** el tema cambia de inmediato entre claro (lienzo blanco opaco + contornos sólidos
   estáticos) y oscuro (lienzo `#000000` + cards carbón profundo con contorno iluminado azul
   hielo/violeta), y anuncia a lectores de pantalla el tema al que cambiará.
3. **Given** un tema elegido, **When** vuelve a abrir o recargar Nova en el mismo navegador, **Then**
   se mantiene el tema elegido.
4. **Given** un navegador que no permite guardar en `localStorage`, **When** elige un tema, **Then**
   el cambio funciona durante la visita sin errores.

---

### Edge Cases

- **Reducir movimiento**: bajo `@media (prefers-reduced-motion: reduce)`, se desactivan todas las
  transiciones de entrada y la animación del contorno iluminado en modo oscuro se detiene por
  completo mostrando un borde iluminado estático limpio.
- **Pantallas pequeñas**: desde 360 px de ancho, el navbar público mantiene el logo, los enlaces de
  navegación pública, `ThemeToggle` y los dos accesos sin desbordamiento horizontal.
- **Selector de tema**: disponible en el navbar público (`PublicLayout`), en `AuthLayout`, en
  `AppHeader` y en `AppShell`.
- **Datos ilustrativos**: los montos y movimientos de la vista previa nunca consultan la API ni
  muestran datos reales de un estudiante.

## Requirements *(mandatory)*

### Functional Requirements

**Experiencia pública multipágina**

- **FR-001**: Los visitantes sin sesión DEBEN ver la portada pública minimalista en `/`; los
  estudiantes con sesión DEBEN redirigirse automáticamente a `/inicio`.
- **FR-002**: La navegación pública DEBE dividir la información en rutas limpias con carga diferida
  desde la barra superior fija: `/` (`Inicio`), `/caracteristicas` (`Características`) y
  `/estudiantes` (`Estudiantes`), manteniendo «Iniciar sesión» (`/ingresar`) y «Crear cuenta»
  (`/registro`) exclusivamente en el navbar (sin botones duplicados al final ni en el pie).
- **FR-003**: La experiencia pública DEBE indicar de forma visible que Nova es un proyecto académico
  con dinero 100 % simulado en COP, sin conexión con entidades bancarias reales (Principio V).
- **FR-004**: La wallet de criptoactivos solo puede aparecer en `/caracteristicas` con la etiqueta
  «Muy pronto» y sin acciones interactivas (Principio IV, patrón «Muy pronto»). Ninguna función
  pendiente puede presentarse como acción disponible.
- **FR-005**: La experiencia pública DEBE enlazar la política de tratamiento de datos (`/privacidad`,
  spec 001) tanto en `/estudiantes` como en el pie de página minimalista.
- **FR-006**: Toda la información pública es estática y etiquetada como ilustrativa: no consulta la
  API ni muestra datos reales de estudiantes.

**Tema claro / oscuro**

- **FR-007**: Sin preferencia guardada, el tema DEBE seguir `prefers-color-scheme` y sus cambios.
- **FR-008**: La estudiante DEBE poder alternar entre tema claro (blanco opaco/porcelana con bordes
  sólidos estáticos en acento de marca, sin blanco `#FFFFFF` como fondo ni efecto neón) y oscuro
  (negro sólido `#000000`, cards carbón profundo y contornos iluminados azul hielo → violeta con
  animación CSS pura detenida bajo `prefers-reduced-motion`). La elección se recuerda en el
  navegador.
- **FR-009**: Si `localStorage` no está disponible o falla, el cambio DEBE funcionar en memoria sin
  errores.

**Calidad**

- **FR-010**: Todas las páginas públicas y el selector DEBEN cumplir WCAG 2.1 AA: landmarks
  semánticos (`header`, `nav`, `main`, `footer`), foco visible, áreas táctiles ≥ 44 px, contraste
  ≥ 4.5:1 en ambos temas, soporte desde 360 px sin desborde horizontal, transiciones interactivas
  ≤ 400 ms y respeto estricto de `prefers-reduced-motion`.

### Key Entities

- **Preferencia de tema**: valor `'light' | 'dark'` elegido por la persona en `localStorage['nova:theme']`;
  si no existe, se deriva del sistema. No es un dato personal ni se envía al servidor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante comprende qué es Nova en la primera vista despejada y llega al registro
  en menos de 30 segundos.
- **SC-002**: El 100 % de las visitas sin sesión a `/` muestran la portada pública, y el 100 % de
  las visitas con sesión redirigen a `/inicio`.
- **SC-003**: La elección de tema persiste al recargar o reabrir Nova en el mismo navegador.
- **SC-004**: `/`, `/caracteristicas`, `/estudiantes` y el selector cumplen WCAG 2.1 AA en ambos
  temas y funcionan desde 360 px sin desbordamiento horizontal.

## Assumptions

- Depende de la spec 001 (rutas `/ingresar`, `/registro`, `/privacidad` y sesión). No requiere
  backend, contratos, tablas ni cambios en `@nova/shared`.
- La paleta constitucional reserva el azul hielo y el violeta para marca/contornos/interacciones y
  el rojo exclusivamente para errores y alertas críticas.
- Quedan fuera: blog, preguntas frecuentes, formularios de contacto, analítica de visitas, varios
  idiomas y temas distintos de claro y oscuro.
