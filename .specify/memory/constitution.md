# Nova Constitution

Banca virtual para estudiantes universitarios en Colombia · Documento base para Spec Kit
(`/speckit-constitution`) · Idioma de producto: español (es-CO)

## Core Principles

### I. Dinero Exacto y Libro Contable Inmutable (NON-NEGOTIABLE)

- **Moneda única COP en pesos enteros**: La única moneda del MVP es el peso colombiano (COP).
  Todo importe DEBE almacenarse y calcularse como entero en pesos. Queda prohibido usar punto
  flotante para dinero. En la interfaz los montos se formatean con
  `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`.
- **Representación del dinero por capa**:
  - Base de datos: columnas `BIGINT`.
  - Código: el repositorio de cada módulo convierte el `bigint` que entrega Prisma a `number` y
    verifica `Number.isSafeInteger`; si no es seguro, lanza un error. Fuera de los repositorios
    el dinero siempre es `number` entero.
  - API: los montos viajan en JSON como número entero en pesos (ej. `"amount": 25000`), nunca
    como `bigint`, cadena ni decimal. Los esquemas Zod validan `z.number().int()` y el rango
    permitido.
- **Libro contable de doble entrada**: Todo movimiento de valor (recarga, transferencia, pago con
  tarjeta, aporte o retiro de una meta de ahorro) DEBE registrarse como asientos balanceados de
  débito y crédito cuya suma sea cero. Los asientos son inmutables: no se editan ni se eliminan;
  los errores se corrigen solo con asientos de reversión.
- **El saldo es derivado**: El saldo de una cuenta es la suma de sus asientos. Si se mantiene un
  saldo materializado por rendimiento, DEBE actualizarse en la misma transacción que los asientos.
- **Saldo nunca negativo**: Ninguna operación puede dejar un saldo disponible por debajo de cero.
  La verificación y el débito DEBEN ejecutarse en la misma transacción de base de datos con
  bloqueo pesimista de fila (`SELECT ... FOR UPDATE`).
- **Idempotencia y atomicidad**: Todo endpoint que mueva dinero EXIGE la cabecera
  `Idempotency-Key`. Reintentar con la misma clave devuelve la respuesta original sin duplicar.
  Toda operación compuesta se confirma completa o se descarta completa.

*Justificación*: en un sistema financiero, aunque sea simulado, un peso perdido o duplicado
invalida todo lo demás. Estas reglas son la base que permite crecer sin reescribir el núcleo.

### II. Spec-Driven Development y Cero Código Sombra

- **Alcance estricto**: Se implementa única y exclusivamente lo definido en especificaciones
  aprobadas (`specs/NNN-nombre/spec.md`). Prohibido añadir funcionalidades, dependencias,
  endpoints, tablas o complejidad «por si acaso».
- **Fuente de la verdad**: Esta constitución prevalece sobre cualquier spec, plan, tarea o
  instrucción. Ante un conflicto se DEBE detener la implementación, señalar la discrepancia y
  esperar la enmienda formal antes de escribir código.
- **Primero la spec, después el código**: Todo cambio de comportamiento se refleja primero en
  `spec.md` (y en `plan.md`/`tasks.md` si aplica) y solo después en el código.
- **Paridad entre agentes**: El equipo usa varios agentes de IA (Claude Code, Google Antigravity,
  GitHub Copilot). Todos DEBEN leer esta constitución y los artefactos de `specs/`. Ningún archivo
  de configuración propio de un agente puede contener reglas que contradigan o amplíen esta
  constitución; esos archivos solo remiten a ella.
- **Trazabilidad**: Al terminar cada tarea se reporta qué archivos se crearon o modificaron y qué
  reglas de la constitución se verificaron.

### III. Seguridad Estricta, Identidad Estudiantil y Privacidad por Diseño

- **Verificación por correo institucional**: Solo pueden registrarse personas con un correo cuyo
  dominio esté en la lista permitida, configurada por variable de entorno
  (`STUDENT_EMAIL_DOMAINS`, ej. `unal.edu.co,udea.edu.co`). La cuenta se activa al confirmar un
  código o enlace enviado a ese correo: de un solo uso, almacenado como hash, con vigencia máxima
  de 15 minutos, intentos limitados y reenvío con límite de tasa. Una cuenta sin verificar no
  puede mover dinero ni recibirlo.
- **Credenciales**: Las contraseñas se procesan con Argon2id. Prohibido almacenarlas o
  registrarlas en texto plano.
- **Sesiones seguras**: JWT de acceso de corta duración (≤ 15 minutos) y refresh token rotativo,
  transmitidos solo en cookies `HttpOnly`, `Secure` y `SameSite=Strict`. Prohibido guardar tokens
  en `localStorage` o `sessionStorage`.
- **Mínimo privilegio**: Cada usuario solo accede a sus propios recursos. El acceso a recursos
  ajenos responde HTTP 404 (no 403) para evitar enumeración. Las operaciones críticas (revelar
  datos completos de la tarjeta, cambiar contraseña o correo, superar umbrales configurados)
  exigen reautenticación con contraseña.
- **Protección de datos personales**: El registro DEBE solicitar la aceptación explícita del
  tratamiento de datos personales conforme a la Ley 1581 de 2012 (Habeas Data) y guardar la fecha
  y versión del texto aceptado. Solo se recolectan los datos necesarios para la funcionalidad.
- **Aislamiento de secretos**: Toda clave y cadena de conexión vive en variables de entorno
  (`.env`, ignorado en git), con una plantilla `.env.example` sin secretos reales. Prohibido
  registrar en logs contraseñas, tokens, códigos de verificación o datos de tarjeta.

### IV. Estética Apple-Grade y Experiencia Dinámica

- **Lenguaje visual limpio**: Espacios generosos, esquinas muy redondeadas, tipografía de sistema
  (`-apple-system`, `SF Pro`, con respaldo `Inter`) y vidrio esmerilado (*glassmorphism*) en
  barras de navegación, hojas modales y tarjetas.
- **Color funcional y temas**: Base neutra en blanco, negro y grises; el color se reserva a
  iconos, estados y acentos (azul hielo, violeta, verde, naranja, rojo). Toda variación
  positiva/negativa se acompaña de signo o flecha además del color. Modo claro y oscuro según la
  preferencia del sistema, mediante tokens en variables CSS.
- **Fluidez y accesibilidad**: Transiciones ≤ 400 ms, retroalimentación inmediata y saldo
  ocultable con un toque. Cumplimiento de WCAG 2.1 AA: contraste, foco visible y navegable por
  teclado, áreas táctiles ≥ 44 px y respeto de `prefers-reduced-motion`.
- **Patrón «Muy pronto»**: Las funcionalidades de fases futuras PUEDEN mostrarse en la interfaz
  como tarjetas con la etiqueta «Muy pronto», no interactivas o con un único mensaje informativo.
  No tienen rutas de backend, tablas, datos simulados ni lógica: solo comunican la hoja de ruta.

### V. Alcance Delimitado y Simulación Segura

- **Carácter académico**: Nova es un MVP demostrativo para la materia de Ingeniería Web. No
  custodia fondos reales ni se conecta a redes bancarias, PSE, Nequi, franquicias de tarjetas ni
  blockchains. Todo saldo es un libro contable interno simulado.
- **Entrada de dinero simulada**: El dinero entra al sistema solo mediante una «recarga simulada»
  registrada en el libro contable contra una cuenta técnica del sistema. No existe salida de
  dinero hacia el exterior en el MVP.
- **Transición a producción**: Cualquier paso hacia dinero real (licencias, KYC real, pasarelas
  de pago, custodia) REQUIERE una enmienda MAJOR previa de esta constitución.

### VI. Arquitectura Escalable y Evolutiva

- **Monolito modular por dominio**: El backend es un único despliegue dividido en módulos de
  dominio. Un módulo NO accede a las tablas de otro: se comunica a través del servicio público del
  otro módulo. Esto permite extraer un módulo como servicio independiente en el futuro sin
  reescribir su lógica.
- **API sin estado**: Ningún estado de sesión, de negocio ni de infraestructura vive en memoria
  del proceso; todo persiste en PostgreSQL o en cookies firmadas. Esto incluye los contadores de
  límite de tasa, que usan un almacén compartido en PostgreSQL (store propio que implementa la
  interfaz `Store` de `express-rate-limit`). Así la API puede escalar horizontalmente.
- **Contratos primero**: Cada spec que exponga endpoints DEBE definir su contrato en
  `specs/NNN-nombre/contracts/` (OpenAPI 3.1) durante `/speckit-plan`, antes de implementarse.
  En el código, la documentación OpenAPI se genera desde los mismos esquemas Zod con
  `@asteasolutions/zod-to-openapi` y se publica en `/api/v1/openapi.json`. Lo generado DEBE
  coincidir con el contrato de la spec; cualquier diferencia se corrige en la spec o en el código
  antes del merge. Los cambios incompatibles requieren una nueva versión de prefijo (`/api/v2`).
- **Código compartido**: Los esquemas Zod de entrada y salida, los tipos de la API, los códigos de
  error y las utilidades puras de dinero viven en el paquete `/shared` (`@nova/shared`), usado
  por frontend y backend. Ese paquete no depende de Express, React ni Prisma y no contiene lógica
  de negocio.
- **Configuración por entorno**: Límites, dominios permitidos, orígenes CORS y secretos se leen
  de variables de entorno validadas con Zod al arrancar; si falta una variable requerida, la
  aplicación no arranca.
- **Reproducibilidad**: Cualquier integrante DEBE poder levantar el entorno completo con
  `docker compose up` (servicios de infraestructura) y `npm install && npm run dev`.

## Naturaleza y Alcance del Proyecto

Nova es una banca virtual para estudiantes universitarios en Colombia: les permite recibir dinero,
enviarlo a sus compañeros, pagar con una tarjeta virtual, ahorrar para metas y controlar sus
gastos desde una interfaz rápida, transparente y segura.

### Fases

1. **Fase 1 — MVP (en alcance)**: registro con verificación por correo institucional, cuenta en
   COP con libro contable, recargas simuladas, transferencias entre estudiantes verificados,
   tarjeta virtual simulada, metas de ahorro, presupuesto por categorías y gastos compartidos.
2. **Fase 2 — «Muy pronto» (fuera de alcance)**: wallet de criptoactivos y swaps cripto-COP. En
   el MVP solo existe como tarjeta «Muy pronto» en la interfaz (Principio IV). Implementarla
   requiere una enmienda que defina sus reglas (precisión decimal por activo con `NUMERIC` y
   `decimal.js`, `PriceProvider` simulado, cotizaciones con vigencia y control de slippage).

Cualquier otra funcionalidad no listada en la Fase 1 requiere enmienda antes de especificarse.

### Supuestos operativos

1. **Entorno simulado**: Las operaciones no tienen contraparte en redes bancarias reales.
2. **Zona horaria**: Las fechas se almacenan en UTC. Los límites diarios y los periodos de
   presupuesto se calculan en la zona `America/Bogota`.
3. **Correo electrónico**: El envío se hace por SMTP mediante una interfaz `MailProvider`. En
   desarrollo se usa Mailpit (bandeja local en Docker); nunca se envían correos reales en pruebas.

## Stack Tecnológico y Reglas de Implementación

Solo se permiten las tecnologías listadas. Cualquier otra dependencia requiere enmienda. Las
versiones mayores indicadas son obligatorias; las versiones exactas quedan fijadas en el
`package-lock.json` y solo se actualizan en un PR propio.

- **Frontend / UI**:
  - React 19 con Vite.
  - Tailwind CSS 4, configurado en CSS (`@theme`) con variables CSS para los tokens de diseño
    (modo claro y oscuro).
  - React Router 7 en modo SPA (sin renderizado en servidor).
  - TanStack Query 5 para el estado del servidor; React Hooks para el estado local.
  - `lucide-react` para la iconografía.
- **Backend / API**:
  - Node.js 24 LTS con Express 5.
  - API REST JSON con prefijo obligatorio `/api/v1`.
  - Zod 4 para validar entradas, salidas y variables de entorno.
  - `@asteasolutions/zod-to-openapi` para generar la documentación OpenAPI 3.1 desde Zod.
  - `jsonwebtoken` para JWT, `cookie-parser` para cookies y `argon2` para contraseñas.
  - `helmet`, `cors` y `express-rate-limit` (con store propio en PostgreSQL) para seguridad de
    red.
  - `pino` y `pino-http` para logs estructurados.
  - `nodemailer` para el envío de correos SMTP.
- **Base de datos y persistencia**:
  - PostgreSQL 17 como motor único.
  - Prisma ORM 7 para operaciones convencionales, con el adaptador oficial `@prisma/adapter-pg` y
    el controlador `pg`.
  - SQL explícito (`$queryRaw`/`$executeRaw` con plantillas etiquetadas, nunca concatenando
    texto) solo para operaciones de concurrencia que Prisma no expresa de forma atómica: bloqueos
    de fila (`FOR UPDATE`, `FOR UPDATE SKIP LOCKED`) e inserciones o actualizaciones atómicas
    (`INSERT … ON CONFLICT`). Cada uso se justifica en el `plan.md` de su spec.
  - Todo cambio de esquema mediante migraciones versionadas de Prisma.
- **Lenguaje y tipado**:
  - TypeScript estricto (`"strict": true`) en frontend y backend. Prohibido `any` sin
    justificación documentada.
  - JavaScript solo en archivos de configuración raíz.
- **Calidad y pruebas**:
  - ESLint + Prettier.
  - Vitest y Testing Library (`@testing-library/react`, `@testing-library/user-event`) con
    entorno `jsdom` para pruebas unitarias y de componentes.
  - Supertest para pruebas de integración de la API.
  - Playwright para pruebas E2E de flujos críticos.
  - `tsx` para ejecutar TypeScript en desarrollo.
- **Infraestructura y herramientas**:
  - npm workspaces (`frontend`, `backend`, `db`, `shared`) con un único `package-lock.json` en
    la raíz.
  - Docker Compose para PostgreSQL y Mailpit en desarrollo (Docker Desktop con WSL 2 en Windows).
  - GitHub Actions para CI: lint, `tsc`, pruebas y build en cada PR.
  - Spec Kit con scripts PowerShell (`--script ps`), ya que el equipo trabaja en Windows.
- **Complementos de tecnologías permitidas**: se permiten sin enmienda los complementos
  oficiales, adaptadores, definiciones de tipos y herramientas de desarrollo necesarios para usar
  una tecnología ya listada, siempre que no agreguen funcionalidad propia. Ejemplos:
  `typescript`, `@types/*`, `typescript-eslint`, `eslint-plugin-react-hooks`,
  `@vitejs/plugin-react`, `@tailwindcss/vite` y la CLI `prisma`. Cada uno se declara en el
  `plan.md` de la spec que lo introduce. Cualquier librería que aporte funcionalidad nueva
  (formularios, fechas, estado, UI, etc.) sigue requiriendo enmienda.
- **Tecnologías prohibidas**:
  - Otros frameworks UI (Angular, Vue, Svelte, etc.).
  - CSS-in-JS (Styled Components, Emotion).
  - Librerías de componentes intrusivas (Material UI, Bootstrap, Ant Design).
  - Bases de datos NoSQL.
  - Dependencias comerciales de pago o con licencias restrictivas.

## Reglas de Dominio y Lógica de Negocio

Cada regla DEBE tener al menos una prueba automatizada.

1. **Dinero exacto**: Importes en pesos enteros COP; montos de entrada deben ser enteros
   positivos.
2. **Doble entrada**: Todo movimiento genera asientos de débito y crédito inmutables; las
   anulaciones se hacen con un asiento inverso marcado como reversión.
3. **Saldo no negativo y concurrencia**: Sin sobregiro. Consulta y escritura en la misma
   transacción con bloqueo de fila.
4. **Idempotencia**: Todo `POST` que mueva dinero exige `Idempotency-Key`. Se guarda el resultado
   asociado a la clave y al usuario; repetir la clave con el mismo cuerpo devuelve el resultado
   guardado y con un cuerpo distinto devuelve 409.
5. **Estudiantes verificados**: Solo usuarios con correo institucional verificado pueden enviar,
   recibir, recargar, usar la tarjeta o crear metas. El destinatario de una transferencia se
   identifica por correo institucional o alias y DEBE estar verificado.
6. **Límites operativos**: Límite por transacción y límite diario agregado por usuario,
   configurables por variables de entorno. Superarlos devuelve 422 indicando el límite excedido.
7. **Ciclo de vida transaccional**: Estados permitidos `pendiente` → `completada` | `fallida` |
   `revertida`. Prohibida cualquier otra transición.
8. **Tarjeta virtual**: Una tarjeta `congelada` rechaza toda autorización de inmediato. En vistas
   estándar solo se muestran los últimos 4 dígitos. El número completo y el CVV se entregan solo
   tras reautenticación y nunca se guardan en logs ni cachés del cliente. Los pagos con tarjeta
   son simulados.
9. **Metas de ahorro**: Cada meta es una subcuenta del libro contable del usuario. Aportar o
   retirar es un movimiento contable entre la cuenta principal y la meta; el saldo de la meta
   nunca es negativo y su dinero no está disponible para gastar hasta que se retira.
10. **Presupuesto**: Los presupuestos por categoría son informativos: alertan al acercarse o
    superar el tope, pero nunca bloquean una operación.
11. **Gastos compartidos**: Una solicitud de división no mueve dinero por sí misma. El dinero solo
    se mueve cuando cada participante paga su parte mediante una transferencia normal, sujeta a
    todas las reglas anteriores.
12. **Rutas autenticadas**: Todas las rutas exigen JWT válido excepto las de entrada a la cuenta
    y las técnicas:
    - Registro y verificación: `/auth/register`, `/auth/register/complete`,
      `/auth/verification`, `/auth/verify-email` y `/auth/resend-verification`.
    - Recuperación de contraseña: `/auth/password-reset` y `/auth/password-reset/complete`.
    - Sesión: `/auth/login`, `/auth/refresh` y `/auth/logout`.
    - Técnicas: `/health` y `/openapi.json`.

    Las rutas públicas que dependen de un flujo en curso o de una sesión se protegen con su
    propia cookie (token de flujo o refresh token), nunca con datos enviados en el cuerpo.

## Estructura y Estilo de Código

### Organización del repositorio

- `/frontend`: React + Vite (`src/app`, `src/features/<dominio>`, `src/components`, `src/lib`,
  `src/styles`).
- `/backend`: API modular (`src/modules/<dominio>` con `routes`, `controller`, `service`,
  `schema`; además `src/middleware`, `src/config`, `src/lib`).
- `/db`: esquema Prisma, migraciones versionadas y `seed.ts`.
- `/shared`: paquete `@nova/shared` con esquemas Zod, tipos de la API, códigos de error y
  utilidades puras de dinero (ver Principio VI).
- `/e2e`: pruebas de extremo a extremo con Playwright, que prueban la aplicación completa.
- `/specs`: especificaciones de Spec Kit, una carpeta por funcionalidad.
- En la raíz solo viven archivos de configuración y herramientas (workspaces, Docker Compose,
  CI, `.specify/`, carpetas de agentes, documentación); nunca lógica de aplicación.
- **Dominios del MVP**: `auth`, `profile`, `accounts`, `ledger`, `topups`, `transfers`, `cards`,
  `savings`, `budgets` y `splits`.

### Estilo de programación

- **Separación de responsabilidades**: las rutas validan y enrutan; los controladores orquestan;
  los servicios contienen la lógica de negocio; el acceso a datos queda confinado a repositorios
  o al cliente Prisma del propio módulo.
- **Componentes React**: solo funciones con hooks; sin lógica de negocio pesada en componentes
  visuales.
- **Complejidad**: funciones pequeñas de propósito único; ningún archivo supera 300 líneas sin
  justificación explícita.
- **Nomenclatura**: `camelCase` para variables y funciones; `PascalCase` para componentes, tipos e
  interfaces; `UPPER_SNAKE_CASE` para constantes globales; `PascalCase.tsx` para componentes;
  `kebab-case.ts` para lógica; `snake_case` para tablas y columnas. Código en inglés; textos de
  cara al usuario en español, centralizados en un único catálogo.
- **Compatibilidad multiplataforma**: los scripts de `package.json` DEBEN funcionar en Windows
  (sin comandos exclusivos de bash). Un `.gitattributes` normaliza los finales de línea a LF.

### Flujo de trabajo en equipo

- **División por capa**: un integrante es responsable del backend (`/backend`, `/db`) y el otro
  del frontend (`/frontend`). Cada spec es una funcionalidad completa (vertical) que ambos
  definen juntos y luego implementan cada uno en su capa.
- **Hoja de ruta secuencial**: las specs se crean en el orden y con los números de la hoja de
  ruta del `README.md`; no se crea una spec que no esté en ella.
- **Tres ramas por spec**, todas integradas a `main` mediante PR:
  - `NNN-nombre`: definición. Contiene `spec.md`, `plan.md`, `contracts/`, `tasks.md` y las
    tareas `[SH]`: el código del paquete `/shared` (el contrato en código) y los cambios de la
    configuración raíz compartida. Se integra antes de empezar a implementar.
  - `NNN-nombre-be`: implementación del backend.
  - `NNN-nombre-fe`: implementación del frontend y de las pruebas E2E.
- **Etiquetas de capa en `tasks.md`**: cada tarea lleva exactamente una etiqueta:
  - `[SH]`: paquete `/shared` y configuración raíz compartida (workspaces, TypeScript base,
    ESLint/Prettier, `.env.example`, CI);
  - `[BE]`: backend, base de datos e infraestructura del backend (Docker Compose);
  - `[FE]`: frontend;
  - `[E2E]`: pruebas de extremo a extremo en `/e2e`.

  Cada integrante implementa solo las tareas de su capa.
- **Contrato congelado**: después de integrar la rama de definición, cambiar `contracts/` o el
  paquete `/shared` exige actualizar primero la spec y el contrato en un PR aprobado por ambos
  integrantes.
- **Revisión cruzada**: `spec.md`, `plan.md` y `contracts/` los aprueban ambos integrantes; todo
  PR requiere aprobación del otro integrante.
- **Commits** con Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- **Puertas de calidad**: ningún PR se integra si falla lint, `tsc`, pruebas o build en CI.
- **Pruebas**: cada regla de dominio tiene al menos una prueba; los flujos críticos (registro y
  verificación, transferencia, congelar tarjeta) tienen pruebas E2E con Playwright.

## Manejo de Errores y Validaciones

### Experiencia de usuario

- Mensajes de error claros, humanos y accionables en español.
- Prohibido mostrar stack traces, errores SQL o códigos internos al usuario.
- Toda vista maneja los estados de carga, vacío y error.
- Las operaciones con impacto financiero o destructivas exigen confirmación explícita, mostrando
  el monto y el destinatario.
- Validación inmediata en el cliente, que nunca sustituye la validación del backend.

### API

- Toda entrada (body, query y params) se valida con Zod antes de llegar al servicio.
- Formato uniforme de error:
  ```json
  {
    "error": {
      "code": "STRING_ESTABLE",
      "message": "Texto descriptivo para el usuario",
      "requestId": "uuid-v4-trazabilidad",
      "details": { "attemptsLeft": 2 }
    }
  }
  ```
- `details` es opcional y solo lleva datos que la interfaz necesita para reaccionar (intentos
  restantes, segundos de espera, motivo, reglas o campos inválidos). Nunca contiene datos
  sensibles, mensajes técnicos ni información que revele la existencia de cuentas. Su forma por
  código de error se define en el contrato de cada spec.
- Códigos HTTP:
  - `400`: entrada inválida.
  - `401`: no autenticado o token vencido.
  - `403`: autenticado sin privilegio (ej. cuenta sin verificar intentando mover dinero).
  - `404`: recurso inexistente o de otro usuario.
  - `409`: conflicto de estado o idempotencia con cuerpo distinto.
  - `422`: regla de negocio violada (fondos insuficientes, límite alcanzado, tarjeta congelada).
  - `429`: límite de tasa alcanzado.
  - `500`: error no controlado; respuesta opaca al cliente y detalle en los logs.
- Un middleware centralizado captura las excepciones, inyecta el `requestId` y registra el
  detalle con `pino`.

## Seguridad y Protección de Datos Sensibles

- **Cabeceras y red**: `helmet` para CSP, HSTS y cabeceras de defensa; CORS limitado al origen
  del frontend configurado.
- **Límites de tasa**: en registro, login, verificación y reenvío de código, emisión de tarjetas,
  recargas y transferencias, con contadores en el almacén compartido de PostgreSQL.
- **Consultas parametrizadas**: siempre mediante el ORM o plantillas etiquetadas.
- **Auditoría**: todo movimiento de dinero y evento de seguridad (registro, verificación, inicio
  de sesión, cambio de contraseña, congelamiento de tarjeta) genera un registro inmutable con
  usuario, marca de tiempo y `requestId`.
- **Higiene del frontend**: ningún secreto en el bundle del cliente; todo contenido dinámico se
  sanitiza para mitigar XSS.

## Identidad Visual y Experiencia de Usuario

- **Estilo**: minimalista inspirado en Apple, bordes con radio acentuado, contrastes controlados y
  desenfoque translúcido (`backdrop-filter: blur`).
- **Tipografía**: fuentes del sistema (`-apple-system`, `BlinkMacSystemFont`, `SF Pro`) con
  respaldo `Inter`.
- **Paleta**: base acromática con acentos semánticos: verde para ingresos y variaciones
  positivas; rojo para gastos y alertas críticas; azul hielo y violeta para la marca e
  interacciones; naranja para advertencias y estados en proceso.
- **Diseño adaptativo**: desde 360 px hasta escritorio. En móvil, barra de navegación inferior
  flotante; en escritorio, menú lateral con paneles en cuadrícula.
- **Rendimiento**: primera carga interactiva de la vista principal en menos de 2,5 s sobre 4G,
  con división de código y carga diferida de rutas.

## Governance

1. **Supremacía constitucional**: Esta constitución es la norma máxima del proyecto Nova y
   prevalece sobre cualquier spec, plan, tarea, conversación o preferencia puntual.
2. **Procedimiento de enmienda**: Toda modificación exige:
   - Editar `.specify/memory/constitution.md` en un PR propio, aprobado por ambos integrantes y
     integrado antes de continuar con trabajo que dependa del cambio.
   - Incrementar la versión semántica:
     - **MAJOR**: eliminación o redefinición incompatible de principios o del alcance.
     - **MINOR**: nuevas secciones, dominios, principios o reglas materiales.
     - **PATCH**: correcciones de redacción, formato o aclaraciones.
   - Revisar y actualizar las specs dependientes.
   - Registrar el cambio en el historial de enmiendas.
3. **Cumplimiento continuo**: Cada PR y cada ciclo de implementación guiado por IA certifica el
   cumplimiento de esta constitución (sección «Constitution Check» de `plan.md`).

### Historial de Enmiendas

| Versión | Fecha | Tipo | Resumen del cambio |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-19 | Ratificación inicial | Constitución fundacional de Nova Neobank: principios, stack, reglas de negocio financiero simulado, seguridad y lineamientos SDD. |
| **2.0.0** | 2026-11-20 | MAJOR | Enfoque en estudiantes universitarios de Colombia; moneda única COP en pesos enteros; verificación por correo institucional; cripto movida a Fase 2 con patrón «Muy pronto»; nuevos dominios (recargas, metas, presupuesto, gastos compartidos); nuevo Principio VI de arquitectura escalable; stack actualizado (React 19, Node 24 LTS) y dependencias de seguridad declaradas; flujo de trabajo en equipo multiagente en Windows. |
| **2.1.0** | 2026-11-20 | MINOR | Representación del dinero por capa (BIGINT → `number` entero seguro → JSON entero); límites de tasa con almacén compartido en PostgreSQL; generación de OpenAPI desde Zod con `@asteasolutions/zod-to-openapi`; nuevo paquete `/shared` en los workspaces; versiones mayores fijadas (Express 5, Zod 4, Tailwind 4, React Router 7, TanStack Query 5, Prisma 7, PostgreSQL 17). |
| **2.2.0** | 2026-11-20 | MINOR | Flujo de equipo dividido por capa (backend / frontend): hoja de ruta secuencial, tres ramas por spec (definición, `-be`, `-fe`), etiquetas de capa obligatorias en `tasks.md` y contrato congelado tras la definición. |
| **2.3.0** | 2026-11-20 | MINOR | Ajustes surgidos del plan de la spec 001: rutas públicas de registro, recuperación y sesión; campo opcional `details` en el formato de error; cláusula de complementos oficiales y dependencias explícitas (`pg`, `@prisma/adapter-pg`, `jsdom`, Testing Library); SQL explícito permitido para operaciones de concurrencia en cualquier módulo; carpeta `/e2e`; la etiqueta `[SH]` incluye la configuración raíz compartida. |

---

**Version**: 2.3.0 | **Ratified**: 2026-10-19 | **Last Amended**: 2026-11-20
