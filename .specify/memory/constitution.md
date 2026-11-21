<!--
# Sync Impact Report
- Version change: Unversioned / Initial Template -> 1.0.0
- Bump type: MAJOR (Initial formal ratification of Nova Neobank Constitution)
- List of modified principles:
  - [PRINCIPLE_1_NAME] -> I. Dinero Exacto y Libro Contable Inmutable (NON-NEGOTIABLE)
  - [PRINCIPLE_2_NAME] -> II. Cero Código Sombra y Spec-Driven Development (SDD)
  - [PRINCIPLE_3_NAME] -> III. Seguridad Estricta y Privacidad por Diseño
  - [PRINCIPLE_4_NAME] -> IV. Estética Apple-Grade y Experiencia Dinámica
  - [PRINCIPLE_5_NAME] -> V. Alcance Delimitado y Simulación Segura
- Added sections:
  - Naturaleza y Alcance del Proyecto
  - Stack Tecnológico y Reglas de Implementación
  - Reglas de Dominio y Lógica de Negocio
  - Estructura y Estilo de Código
  - Manejo de Errores y Validaciones
  - Seguridad y Datos Sensibles
  - Identidad Visual y Experiencia de Usuario
  - Historial de Enmiendas y Lista de Verificación
- Removed sections:
  - Template placeholder sections ([SECTION_2_NAME], [SECTION_3_NAME])
- Follow-up TODOs:
  - None. All placeholders have been fully populated with concrete specifications.
-->

# Nova Neobank Constitution

Versión 1.0.0 · Documento base para Spec Kit (`/speckit-constitution`) · Idioma de producto: español

## Core Principles

### I. Dinero Exacto y Libro Contable Inmutable (NON-NEGOTIABLE)
- **Precisión Fiat y Cripto**: Los importes en moneda fiat DEBEN almacenarse y calcularse siempre como enteros en la unidad mínima de la moneda (centavos), NUNCA como valores de punto flotante (`number`). Los montos cripto DEBEN manejarse como cadenas decimales (tipo `NUMERIC` en base de datos y utilizando librerías de precisión decimal en código), respetando la precisión de cada activo (ej. 8 decimales para BTC, 18 para ETH).
- **Libro Contable de Doble Entrada**: Todo movimiento de valor DEBE registrarse como asientos balanceados de débito y crédito cuya suma sea cero. Los asientos contables son estrictamente inmutables: no se editan ni se eliminan; los errores se corrigen exclusivamente mediante asientos de reversión.
- **Saldo Nunca Negativo**: Ninguna operación (envío, pago con tarjeta, swap, retiro) puede dejar un saldo disponible por debajo de cero. La verificación y el débito contable DEBEN ejecutarse dentro de la misma transacción de base de datos con bloqueo pesimista de fila (`SELECT ... FOR UPDATE`) para prevenir condiciones de carrera.
- **Idempotencia y Atomicidad**: Todo endpoint que transfiera o modifique valor (POST de envío, swap, recarga) EXIGE la cabecera `Idempotency-Key`. Reintentar una solicitud con la misma clave devolverá la respuesta original sin duplicar transacciones. Toda operación compuesta (swap + comisión) es estrictamente atómica: se confirma en su totalidad o se descarta íntegramente.

### II. Cero Código Sombra y Spec-Driven Development (SDD)
- **Alcance Estricto (Zero Shadow Code)**: La IA y los desarrolladores DEBEN implementar única y exclusivamente lo definido en las especificaciones aprobadas (`spec.md`). Queda prohibido añadir funcionalidades, dependencias, endpoints, tablas o complejidad técnica «por si acaso».
- **Fuente de la Verdad Absoluta**: Esta constitución prevalece sobre cualquier instrucción o especificación. Si una solicitud o especificación entra en conflicto con las reglas constitucionales, se DEBE detener la implementación de inmediato, señalar la discrepancia y esperar la enmienda formal del documento antes de escribir código.
- **Trazabilidad y Transparencia**: Al finalizar cada tarea, se DEBE emitir un reporte detallado de los archivos creados o modificados y las reglas de la constitución verificadas.

### III. Seguridad Estricta y Privacidad por Diseño
- **Gestión Criptográfica de Credenciales**: Las contraseñas DEBEN procesarse con hash Argon2id (o bcrypt con factor de coste ≥ 12 en caso de no disponibilidad). Queda terminantemente prohibido almacenar o registrar contraseñas en texto plano.
- **Sesiones Seguras**: La autenticación DEBE emplear JWT de acceso de corta duración (≤ 15 minutos) junto a un Refresh Token rotativo, transmitidos exclusivamente en cookies `HttpOnly`, `Secure` y `SameSite=Strict`. Prohibido el uso de `localStorage` para tokens de autenticación.
- **Principio de Mínimo Privilegio y Ocultamiento de Superficie**: Todo usuario solo puede acceder a sus propios recursos. El intento de acceso a recursos de terceros DEBE responder con HTTP 404 (no 403) para evitar enumeración y revelación de existencia. Operaciones críticas (superación de umbrales, revelación de credenciales de tarjeta, cambios de seguridad) exigen reautenticación o 2FA.
- **Aislamiento de Secretos**: Toda clave secreta y cadena de conexión vive en variables de entorno (`.env`, ignorado en git), con un archivo de plantilla `.env.example` libre de secretos reales. Prohibido filtrar datos de tarjetas, contraseñas o tokens en los logs.

### IV. Estética Apple-Grade y Experiencia Dinámica
- **Lenguaje Visual Limpio**: Interfaz inspirada en los estándares de diseño de Apple: espacios generosos, esquinas profundamente redondeadas, tipografía de sistema (`-apple-system`, `SF Pro`, con fallback a `Inter`) y efectos de vidrio esmerilado (*glassmorphism*) en barras de navegación, hojas modales y tarjetas.
- **Color Funcional y Temas**: Base neutra en blanco, negro y grises; color reservado a iconos, estados y acentos fríos pero vibrantes (azul hielo, violeta, verde, naranja, rojo). Toda métrica positiva/negativa DEBE acompañarse de signos/flechas explícitos además del color. Soporte nativo para modo claro y oscuro respetando las preferencias del sistema mediante tokens y variables CSS.
- **Fluidez y Accesibilidad**: Transiciones suaves (≤ 400 ms), retroalimentación instantánea, saldo ocultable mediante toque y actualización de cotizaciones en tiempo real sin recarga. Cumplimiento del estándar WCAG 2.1 AA (contraste adecuado, foco navegable por teclado, áreas táctiles ≥ 44 px y respeto de `prefers-reduced-motion`).

### V. Alcance Delimitado y Simulación Segura
- **Carácter Académico y Demostrativo**: El proyecto es un producto mínimo viable demostrativo. No custodia fondos reales ni opera con dinero fiat bancario real: el saldo fiat es un libro contable interno simulado y las cotizaciones cripto se obtienen de un proveedor simulado.
- **Custodia Simulada**: La plataforma administra los saldos a nivel de base de datos sin generar ni manipular claves privadas criptográficas reales.
- **Transición a Producción**: Cualquier paso hacia una operativa con dinero real (licencias financieras, KYC real, custodia de claves, pasarelas) REQUIERE una enmienda formal previa a esta constitución antes de modificar una sola línea de código.

## Naturaleza y Alcance del Proyecto

Nova es una aplicación web de neobanco y wallet de criptoactivos destinada a personas jóvenes y profesionales digitales que buscan gestionar su dinero fiat (saldo, transferencias, tarjeta virtual) y sus activos digitales desde una interfaz única, rápida, transparente y segura.

### Supuestos y Límites Operativos
1. **Entorno Simulado**: Las operaciones financieras no tienen contraparte en redes bancarias reales ni en mainnets públicas.
2. **Proveedor de Cotizaciones**: Los precios de mercado se consumen mediante una interfaz `PriceProvider` (simulada en este MVP). Los datos DEBEN mostrar la hora de última actualización y la interfaz DEBE invalidar precios con antigüedad superior a 60 segundos.
3. **Gobierno Previo**: Toda modificación en el modelo de custodia, identidad legal o pasarela de pagos requiere actualización constitucional.

## Stack Tecnológico y Reglas de Implementación

Únicamente está permitido el uso de las tecnologías detalladas a continuación. La incorporación de cualquier otra dependencia o herramienta requiere una enmienda explícita a esta constitución.

- **Frontend / UI**:
  - React 18 impulsado por Vite (build tool y servidor de desarrollo).
  - Tailwind CSS complementado con variables CSS para el sistema de tokens de diseño (modo claro y oscuro).
  - Enrutamiento cliente con React Router.
  - Gestión de estado del servidor con TanStack Query; estado local mediante React Hooks.
  - Iconografía homogénea con `lucide-react`.
- **Backend / API**:
  - Node.js 20 LTS con framework Express.
  - Arquitectura de API REST con payload JSON y prefijo obligatorio `/api/v1`.
  - Validación de esquemas con Zod en los puntos de entrada.
  - Autenticación mediante JWT de corta duración y refresh tokens rotativos.
  - Registro estructurado de eventos con `pino`.
- **Base de Datos y Persistencia**:
  - PostgreSQL como motor relacional único.
  - Mapeo objeto-relacional mediante Prisma ORM para operaciones CRUD convencionales.
  - Se permite el uso de SQL explícito (`$queryRaw`) exclusivamente para transacciones del libro contable que exijan bloqueos de fila pesimistas (`FOR UPDATE`) y control atómico estricto.
  - Todas las modificaciones de esquema se ejecutan a través de migraciones versionadas de Prisma. Prohibida la alteración manual de tablas.
- **Lenguaje y Tipado**:
  - TypeScript en modo estricto (`"strict": true`) en la totalidad del frontend y backend. Prohibido el uso de `any` implícito o explícito sin justificación de tipado genérico.
  - JavaScript plano permitido únicamente en archivos de configuración raíz (`vite.config.js`, `tailwind.config.js`, etc.).
- **Calidad y Pruebas**:
  - Linter y formateador: ESLint + Prettier.
  - Pruebas unitarias y de integración de componentes: Vitest.
  - Pruebas de integración de API: Supertest.
  - Pruebas de extremo a extremo (E2E): Playwright (enfocado en flujos críticos).
  - Gestor de paquetes: `npm` con archivo de bloqueo `package-lock.json` unificado.
- **Tecnologías Prohibidas**:
  - Otros frameworks UI (Angular, Vue, Svelte, etc.).
  - Librerías de CSS-in-JS (Styled Components, Emotion).
  - Librerías de componentes prediseñados intrusivos (Material UI, Bootstrap, Ant Design).
  - Bases de datos NoSQL (MongoDB, DynamoDB, etc.).
  - Dependencias comerciales de pago o con licencias restrictivas.

## Reglas de Dominio y Lógica de Negocio

El cumplimiento de estas reglas de negocio es obligatorio y verificable mediante pruebas automatizadas:

1. **Dinero Siempre Exacto**:
   - Saldo fiat representado como enteros en centavos (ej. 1000 = 10.00 EUR/USD).
   - Saldo cripto manejado como strings de precisión arbitraria en capa de aplicación y tipo `NUMERIC` en PostgreSQL.
2. **Contabilidad de Doble Entrada**:
   - Todo traspaso o movimiento de balance genera un asiento de débito y un asiento de crédito inmutables.
   - Si una operación debe anularse, se genera un asiento inverso de compensación con marca de reversión.
3. **Saldo No Negativo y Concurrencia**:
   - No se permite descubierto de cuenta. El saldo disponible DEBE ser suficiente antes de efectuar la deducción.
   - La consulta y la escritura ocurren dentro de la misma transacción de base de datos con bloqueo de fila.
4. **Idempotencia Obligatoria**:
   - Operaciones de mutación financiera (`POST /transfers`, `POST /swaps`, `POST /cards/:id/charge`) exigen cabecera `Idempotency-Key`.
   - Se almacena el resultado vinculado a la clave; solicitudes idénticas posteriores devuelven el resultado cacheado. Si el cuerpo de la petición difiere con la misma clave, se devuelve error 409 Conflict.
5. **Swaps Cripto-Fiat**:
   - La operación de intercambio requiere una cotización previa (`quoteId`) con vigencia máxima de 30 segundos.
   - Si la cotización expira o el slippage supera el margen configurado, la orden es rechazada con código 422.
   - Las comisiones asociadas DEBEN transparentarse al usuario antes de la confirmación.
6. **Límites Operativos**:
   - Se aplican límites máximos por transacción y límites agregados diarios por usuario, configurables por variables de entorno.
   - La superación de límites devuelve error HTTP 422 indicando el límite excedido.
7. **Ciclo de Vida Transaccional**:
   - Estados estrictos permitidos: `pendiente` → `completada` | `fallida` | `revertida`.
   - Prohibida cualquier transición de estado fuera de dicha máquina de estados finita.
8. **Tarjeta Virtual**:
   - Una tarjeta en estado `congelada` rechaza cualquier intento de autorización o débito de forma inmediata.
   - En vistas estándar solo se exponen los últimos 4 dígitos. El PAN completo y el CVV solo se entregan tras reautenticación activa del usuario y NUNCA se almacenan en logs o cachés cliente.
9. **Políticas de Autenticación de Rutas**:
   - Todas las rutas excepto `/auth/register`, `/auth/login` y `/health` exigen token JWT válido.
   - Las acciones sobre recursos ajenos responden sistemáticamente con HTTP 404 para proteger la privacidad.

## Estructura y Estilo de Código

### Organización del Repositorio
El repositorio mantiene una estructura dividida en tres carpetas raíz, sin lógica dispersa fuera de ellas:
- `/frontend`: Aplicación React + Vite (`src/app`, `src/features/<dominio>`, `src/components`, `src/lib`, `src/styles`).
- `/backend`: API Node.js modular (`src/modules/<dominio>` estructurado en `routes`, `controller`, `service`, `schema`; además de `src/middleware`, `src/config`, `src/lib`).
- `/db`: Esquema de datos Prisma, migraciones versionadas y scripts de inicialización de datos (`seed.ts`).
- **Dominios Iniciales**: `auth`, `accounts`, `ledger`, `transfers`, `crypto`, `swaps`, `cards` y `profile`.

### Estilo de Programación y Buenas Prácticas
- **Separación de Responsabilidades**: Las rutas validan y enrutan; los controladores orquestan la solicitud/respuesta; los servicios contienen la lógica de negocio pura; el acceso a datos queda confinado a repositorios o clientes Prisma.
- **Componentes React**: Exclusivamente funciones declarativas con hooks. Prohibido el uso de clases. La lógica de negocio pesada no debe habitar en componentes visuales.
- **Límite de Complejidad**: Funciones pequeñas con propósito único. Ningún archivo debe exceder las 300 líneas de código sin una justificación arquitectónica explícita.
- **Convenciones de Nomenclatura**:
  - Variables y funciones: `camelCase`.
  - Componentes, interfaces y tipos: `PascalCase`.
  - Constantes globales: `UPPER_SNAKE_CASE`.
  - Archivos de componentes React: `PascalCase.tsx`.
  - Archivos lógicos y de utilidad: `kebab-case.ts`.
  - Entidades y columnas de base de datos: `snake_case`.
  - Nombres de código en inglés; textos y mensajes de cara al usuario en español, centralizados en un catálogo o módulo único para futura internacionalización.
- **Control de Versiones**:
  - Ramas creadas a partir de especificaciones formales.
  - Mensajes de confirmación bajo el estándar Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
  - Ninguna rama se integra si no supera satisfactoriamente linting, chequeo de tipos (`tsc`) y suite de pruebas automatizadas.
- **Requisitos de Pruebas**:
  - Cada regla de dominio definida en esta constitución DEBE tener como mínimo una prueba automatizada.
  - Los flujos críticos (enviar fondos, swap de activos y congelar tarjeta) DEBEN contar con pruebas de extremo a extremo automatizadas con Playwright.

## Manejo de Errores y Validaciones

### Experiencia de Usuario (UI)
- Mensajes de error claros, humanos, concisos y accionables redactados en español.
- Prohibido exponer stack traces, errores SQL o códigos internos al usuario final.
- Toda vista debe manejar consistentemente los tres estados: Carga (*loading*), Vacío (*empty*) y Error (*error*).
- Las operaciones destructivas o con impacto financiero exigen un diálogo de confirmación explícito antes de su despacho.
- Formularios con validación inmediata en el cliente para mejorar la usabilidad, entendiendo que esta nunca sustituye a la validación estricta del backend.

### Especificación de la API Backend
- Toda entrada (body, query params, path params) se valida mediante esquemas Zod antes de acceder al servicio de negocio.
- Estructura uniforme de respuestas de error:
  ```json
  {
    "error": {
      "code": "STRING_ESTABLE",
      "message": "Texto descriptivo para el usuario",
      "requestId": "uuid-v4-trazabilidad"
    }
  }
  ```
- Mapeo canónico de códigos HTTP:
  - `400 Bad Request`: Datos de entrada inválidos o esquema Zod no superado.
  - `401 Unauthorized`: No autenticado o token vencido/inválido.
  - `403 Forbidden`: Autenticado pero sin privilegios suficientes.
  - `404 Not Found`: Recurso inexistente o perteneciente a otro usuario.
  - `409 Conflict`: Conflicto de estado (idempotencia repetida con payload dispar, colisión de concurrencia).
  - `422 Unprocessable Entity`: Regla de negocio violada (fondos insuficientes, límite diario alcanzado, cotización caducada).
  - `429 Too Many Requests`: Límite de tasa de peticiones alcanzado (*rate limit*).
  - `500 Internal Server Error`: Excepción no controlada; respuesta opaca al cliente con registro detallado en servidor.
- Un middleware centralizado intercepta todas las excepciones, inyecta el `requestId` y envía el detalle técnico a `pino`.

## Seguridad y Protección de Datos Sensibles

- **Políticas de Autenticación**: Tokens de acceso con vida útil máxima de 15 minutos. Rotación obligatoria de refresh tokens para detectar reutilizaciones no autorizadas.
- **Configuración de Cabeceras y Red**: Uso de `helmet` para configurar CSP, HSTS y cabeceras de defensa en profundidad. CORS configurado exclusivamente para permitir el origen del frontend registrado.
- **Defensa contra Abusos**: Límite de tasa (*rate limiting*) aplicado en endpoints de autenticación, emisión de tarjetas y transferencias de dinero.
- **Parametrización Absoluta**: Todas las consultas a PostgreSQL se ejecutan parametrizadas a través del ORM o de templates etiquetados para prevenir inyecciones SQL.
- **Registro de Auditoría**: Todo movimiento de fondos y evento de seguridad (inicio de sesión, cambio de clave, congelamiento de tarjeta) genera un registro inmutable de auditoría con identificación de usuario, marca temporal y `requestId`.
- **Higiene en Frontend**: Prohibido incluir credenciales de administrador, claves privadas o secretos de infraestructura en el bundle del cliente; todo contenido dinámico debe sanitizarse para mitigar XSS.

## Identidad Visual y Experiencia de Usuario

- **Estilo Visual**: Lenguaje limpio y minimalista inspirado en Apple. Bordes generosos con radio de curvatura acentuado, contrastes controlados y efectos de desenfoque translúcido (*backdrop-filter: blur*).
- **Tipografía y Legibilidad**: Fuentes tipográficas nativas del sistema (`-apple-system`, `BlinkMacSystemFont`, `SF Pro Display/Text`) con respaldo de Google Fonts (`Inter`).
- **Paleta de Colores**: Base acromática en escala de grises. Colores semánticos aplicados como acentos:
  - Verde: Variaciones positivas y saldos entrantes.
  - Rojo: Variaciones negativas, gastos y alertas críticas.
  - Azul hielo / Violeta: Acentos primarios de marca e interacciones destacadas.
  - Naranja: Advertencias y estados en proceso.
- **Diseño Adaptativo**: Experiencia optimizada desde teléfonos móviles compactos (360 px) hasta pantallas de escritorio amplias. En interfaces móviles, barra de navegación inferior flotante; en escritorio, menú lateral con paneles organizados en cuadrículas dinámicas.
- **Rendimiento**: Tiempo de primera carga interactiva de la vista principal inferior a 2,5 segundos sobre redes 4G móviles estándar, optimizado mediante división de código (*code splitting*) y carga perezosa de rutas (*lazy loading*).

## Governance

1. **Supremacía Constitucional**: Esta constitución constituye la norma fundamental y máxima fuente de la verdad para el proyecto Nova Neobank. Prevalece sobre cualquier especificación técnica, tarjeta de tarea, discusión o preferencia puntual.
2. **Procedimiento de Enmienda**: Toda modificación a los principios, reglas de dominio o tecnologías descritas en este documento exige:
   - Modificación previa de `.specify/memory/constitution.md`.
   - Incremento de la versión semántica del documento de acuerdo con el impacto de la reforma:
     - **MAJOR**: Modificaciones, eliminaciones o cambios de alcance incompatibles con principios previos.
     - **MINOR**: Incorporación de nuevas secciones, dominios, principios o reglas materiales complementarias.
     - **PATCH**: Correcciones de formato, redacción, aclaraciones terminológicas o refinamientos menores.
   - Revisión y actualización de las especificaciones (`spec.md`) dependientes.
   - Registro en la tabla de historial de enmiendas.
3. **Control y Validación Continua**: Cada revisión de código (PR) o ciclo de implementación guiado por IA debe certificar explícitamente el cumplimiento de las directrices aquí plasmadas.

### Historial de Enmiendas

| Versión | Fecha | Autor / Tipo | Resumen del Cambio |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-19 | Ratificación Inicial | Constitución fundacional del proyecto Nova Neobank estableciendo principios core, stack tecnológico estricto, reglas de negocio financiero simulado, seguridad y lineamientos SDD. |

### Lista de Verificación de Aprobación
- [x] El propósito, la naturaleza y los usuarios del proyecto están formalmente delimitados.
- [x] El stack tecnológico está definido de forma exhaustiva y sin ambigüedades.
- [x] Las reglas críticas de negocio (contabilidad, precisión, idempotencia) son auditables y comprobables.
- [x] La estructura del repositorio y las convenciones de código están estandarizadas.
- [x] Se cuenta con un modelo uniforme de validación y gestión de errores.
- [x] El agente de IA cuenta con directrices operativas estrictas que impiden la generación de código sombra.
- [x] Se han eliminado todos los marcadores provisionales y textos de instrucción de la plantilla base.

---

**Version**: 1.0.0 | **Ratified**: 2026-10-19 | **Last Amended**: 2026-10-19
