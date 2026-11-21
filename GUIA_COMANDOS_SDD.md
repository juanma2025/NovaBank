# Guía de trabajo con Spec Kit (SDD) — Nova

Cómo trabajamos Nova con Spec-Driven Development usando **GitHub Spec Kit**. El equipo tiene dos
integrantes en Windows:

| Rol | Carpetas | Agente |
| :--- | :--- | :--- |
| **Backend** | `/backend`, `/db` | Claude Code |
| **Frontend** | `/frontend` | Google Antigravity |
| **Ambos** | `/shared`, `specs/` | — |

> Las reglas del proyecto están en [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
> Si esta guía y la constitución se contradicen, manda la constitución.

---

## 1. Prerrequisitos (una vez por computador)

| Herramienta | Para qué | Cómo verificar |
| :--- | :--- | :--- |
| Git | Control de versiones | `git --version` |
| `uv` | Instalar la CLI de Spec Kit | `uv --version` |
| Python 3 | Lo usan los scripts de Spec Kit | `python --version` |
| Node.js 24 LTS | Frontend y backend | `node --version` |
| Docker Desktop (WSL 2) | PostgreSQL y Mailpit en desarrollo | `docker --version` |
| Claude Code **o** Antigravity IDE ≥ 2.0 | Ejecutar los comandos `/speckit-*` | — |

Instalar `uv` en PowerShell, si no lo tienes:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
uv tool update-shell
```

Instalar o actualizar Spec Kit:

```powershell
uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git
specify version
```

> **Los dos integrantes deben tener la misma versión de Spec Kit.** La versión con la que se
> generaron los archivos del repo está en `.specify/init-options.json` (`speckit_version`). Si
> alguien actualiza la CLI, ejecuta también lo siguiente y sube los cambios en un PR propio:
> ```powershell
> specify integration upgrade agy --script ps --force
> specify integration upgrade copilot --script ps --force
> specify integration upgrade claude --script ps --force
> ```

Si PowerShell bloquea los scripts `.ps1`:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

---

## 2. Dónde vive cada cosa

```
.specify/memory/constitution.md   Reglas del proyecto (la "ley")
.specify/templates/               Plantillas de spec, plan, tareas y checklist
.specify/scripts/powershell/      Scripts que usan los comandos
.claude/skills/                   Comandos /speckit-* para Claude Code
.agents/skills/                   Comandos /speckit-* para Antigravity
.github/skills/                   Comandos /speckit-* para GitHub Copilot
specs/NNN-nombre/                 Una carpeta por funcionalidad
AGENTS.md / CLAUDE.md             Instrucciones comunes para los agentes
```

Las tres carpetas de skills tienen las mismas instrucciones. Da igual qué agente use cada uno: lo
que importa son los archivos de `specs/`, que son compartidos.

**Cómo se escribe un comando:**
- **Claude Code**: en el chat, `/speckit-plan` seguido de las indicaciones.
- **Antigravity**: en el panel de chat en modo *Agent*, `/speckit-plan` seguido de las
  indicaciones.

---

## 3. La idea: specs verticales, trabajo por capas

Cada spec es una **funcionalidad completa** (por ejemplo, «registro y login»), no una capa. No
hay una spec «de backend» y otra «de frontend»: la spec describe lo que vive el estudiante, y
cada uno implementa su parte.

El punto de encuentro entre los dos es el **contrato**:

```
                 ┌──────────────────────────────┐
                 │  spec.md  (qué)              │   lo definen juntos
                 │  plan.md  (cómo)             │
                 │  contracts/  (OpenAPI)       │
                 │  /shared  (esquemas Zod)     │ ← contrato en código
                 └──────────────┬───────────────┘
                                │  se congela al integrar la rama de definición
                 ┌──────────────┴───────────────┐
        tareas [BE]                       tareas [FE] y [E2E]
        rama NNN-nombre-be                rama NNN-nombre-fe
        Backend (Claude Code)             Frontend (Antigravity)
```

Mientras los dos respeten el contrato, pueden avanzar al mismo tiempo sin bloquearse.

---

## 4. El proceso de una spec, paso a paso

Ejemplo con la spec `001-auth-onboarding`. Para las siguientes solo cambia el número y el nombre,
que salen de la hoja de ruta del [README](README.md).

### Fase A — Definición (juntos, rama `001-auth-onboarding`)

Un integrante ejecuta los comandos y el otro participa en las decisiones. Recomendamos que lo
ejecute **Backend**, porque el plan define el modelo de datos y los endpoints; **Frontend**
aporta las pantallas, los estados y los textos.

**A1. Crear la rama** (desde `main` actualizado):

```powershell
git checkout main
git pull
git checkout -b 001-auth-onboarding
```

**A2. Especificar** — describe la funcionalidad sin hablar de tecnología:

```text
/speckit-specify Registro e inicio de sesión de estudiantes. Solo pueden registrarse personas con
correo institucional de una universidad permitida. Al registrarse reciben un código de
verificación por correo; sin verificar no pueden usar la banca. El registro pide aceptar el
tratamiento de datos personales. Después pueden iniciar y cerrar sesión.
```

Revisen juntos `specs/001-auth-onboarding/spec.md`. Commit: `docs(001): spec`.

**A3. Aclarar** — respondan juntos las preguntas sobre casos límite:

```text
/speckit-clarify
```

Commit: `docs(001): clarify`.

**A4. Planear** — el plan debe cubrir las dos capas:

```text
/speckit-plan Incluye el diseño del backend (módulos, modelo de datos, endpoints) y del frontend
(rutas, pantallas, componentes y estados de carga, vacío y error de cada vista). Define en
contracts/ el OpenAPI de cada endpoint y lista los esquemas Zod que irán en /shared.
```

**Frontend revisa con atención** `contracts/` y la sección de frontend: es lo que va a consumir.
Si falta un campo o un estado, corríjanlo ahora, porque después el contrato queda congelado.
Commit: `docs(001): plan`.

**A5. Generar las tareas** con etiqueta de capa:

```text
/speckit-tasks Etiqueta cada tarea con exactamente una de estas capas: [SH] paquete /shared,
[BE] backend y base de datos, [FE] frontend, [E2E] pruebas Playwright. Ordena primero las [SH].
Dentro de cada historia de usuario agrupa las tareas por capa.
```

Revisen que cada tarea tenga su etiqueta y que ninguna mezcle capas. Commit: `docs(001): tasks`.

**A6. Auditar** antes de programar:

```text
/speckit-analyze
```

Corrijan los hallazgos CRITICAL y HIGH en la spec, el plan o las tareas.

**A7. Implementar el contrato en código** (Backend):

```text
/speckit-implement Implementa solo las tareas etiquetadas [SH].
```

Commit: `feat(001): shared schemas`.

**A8. PR de definición** → `main`. Ambos lo aprueban. Al integrarlo, **el contrato queda
congelado**.

### Fase B — Implementación en paralelo

Cada uno crea su rama desde `main` ya actualizado con la definición.

**Backend (Claude Code):**

```powershell
git checkout main
git pull
git checkout -b 001-auth-onboarding-be
$env:SPECIFY_FEATURE_DIRECTORY = "specs/001-auth-onboarding"
```

```text
/speckit-implement Implementa solo las tareas etiquetadas [BE], historia por historia.
```

**Frontend (Antigravity):**

```powershell
git checkout main
git pull
git checkout -b 001-auth-onboarding-fe
$env:SPECIFY_FEATURE_DIRECTORY = "specs/001-auth-onboarding"
```

Abre Antigravity desde esa terminal (o reinícialo) para que tome la variable, y luego:

```text
/speckit-implement Implementa solo las tareas etiquetadas [FE], historia por historia.
```

**Mientras el backend no esté listo**, Frontend construye las pantallas, los componentes y el
cliente de la API usando los tipos de `@nova/shared`, que ya están en `main`. No se crean
servidores falsos ni datos inventados: la conexión real se prueba cuando el backend llega a
`main`.

**Recomendación:** Backend abre un PR por historia de usuario (primero US1, luego US2…) en vez
de uno solo al final. Así Frontend puede conectar cada pantalla apenas su endpoint está en
`main` (`git pull origin main` en su rama).

**Marcar tareas:** cada uno marca `[X]` solo en sus tareas de `tasks.md`. Como son líneas
distintas, git las combina sin conflicto. Si aparece uno, se conservan las dos marcas.

### Fase C — Integración y cierre

**C1.** Cuando el backend esté en `main`, Frontend actualiza su rama e implementa las pruebas E2E:

```text
/speckit-implement Implementa solo las tareas etiquetadas [E2E].
```

**C2.** Frontend abre su PR → `main`, y Backend lo revisa.

**C3.** Con todo integrado, cualquiera de los dos ejecuta en `main`:

```text
/speckit-converge
```

Si reporta algo pendiente, se corrige en una rama `001-auth-onboarding-fix` siguiendo las mismas
reglas. Luego se actualiza el estado en la hoja de ruta del README.

### Resumen

| Paso | Quién | Rama | Comando |
| :--- | :--- | :--- | :--- |
| A2–A6 | Ambos (ejecuta Backend) | `NNN-nombre` | `specify`, `clarify`, `plan`, `tasks`, `analyze` |
| A7 | Backend | `NNN-nombre` | `implement` → `[SH]` |
| A8 | Ambos aprueban | → `main` | PR de definición |
| B | Backend | `NNN-nombre-be` | `implement` → `[BE]` |
| B | Frontend | `NNN-nombre-fe` | `implement` → `[FE]` |
| C1 | Frontend | `NNN-nombre-fe` | `implement` → `[E2E]` |
| C3 | Cualquiera | `main` | `converge` |

---

## 5. Cuando algo cambia

- **Cambio de comportamiento**: primero la spec, después el código.
- **Cambio del contrato** (`contracts/` o `/shared`) después de la definición: quien lo necesita
  avisa al otro, actualiza la spec, el contrato y los esquemas en un PR pequeño, y ambos lo
  aprueban antes de seguir. **Nunca** se cambia un esquema de `/shared` dentro de una rama
  `-be` o `-fe`.
- **Algo que la constitución no permite** (una librería nueva, una funcionalidad fuera de la
  Fase 1): se detiene el trabajo y se enmienda la constitución con `/speckit-constitution`, en un
  PR propio aprobado por ambos.
- **Commits** con Conventional Commits y el número de la spec: `feat(001): ...`,
  `fix(003): ...`, `docs(002): ...`, `test(001): ...`.

---

## 6. Problemas comunes

| Síntoma | Solución |
| :--- | :--- |
| `specify` no se reconoce | Reabre la terminal o ejecuta `$env:PATH = "$HOME\.local\bin;$env:PATH"` |
| Los comandos `/speckit-*` no aparecen en Claude Code | Verifica que exista `.claude/skills/` y reinicia la sesión |
| Los comandos no aparecen en Antigravity | Actualiza a Antigravity IDE ≥ 2.0 (usa `.agents/skills/`) |
| `Feature directory not found`, o el comando trabaja sobre otra spec | Define `$env:SPECIFY_FEATURE_DIRECTORY = "specs/NNN-nombre"` y reinicia el agente desde esa terminal. La spec activa se guarda en `.specify/feature.json`, que es local y no se sube a git |
| El agente implementó tareas de la otra capa | Descarta esos cambios (`git restore <archivo>`) y repite indicando la etiqueta: «solo las tareas [BE]» |
| Error de Python al correr un comando | Instala Python 3 y verifica que `python --version` funcione |
| Git muestra archivos modificados que nadie tocó | Son finales de línea; `.gitattributes` los normaliza. Ejecuta `git add --renormalize .` |
