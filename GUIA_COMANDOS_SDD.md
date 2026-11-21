# Guía de trabajo con Spec Kit (SDD) — Nova

Cómo trabajamos Nova con Spec-Driven Development usando **GitHub Spec Kit**, con un integrante en
**Claude Code** y otro en **Google Antigravity**, ambos en Windows.

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
> alguien actualiza la CLI, ejecuta también:
> ```powershell
> specify integration upgrade agy --script ps --force
> specify integration upgrade copilot --script ps --force
> specify integration upgrade claude --script ps --force
> ```
> y sube los cambios en un PR propio.

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
specs/NNN-nombre/                 Una carpeta por funcionalidad (se crea con /speckit-specify)
AGENTS.md / CLAUDE.md             Instrucciones comunes para los agentes
```

Las tres carpetas de skills contienen las mismas instrucciones. Por eso da igual qué agente use
cada uno: lo que importa son los archivos de `specs/`, que son compartidos.

---

## 3. El ciclo de una funcionalidad

| # | Comando | Resultado | Qué revisa el humano |
| :--- | :--- | :--- | :--- |
| 0 | `git checkout -b NNN-nombre` | Rama de la funcionalidad | Que el número esté reservado en la hoja de ruta del [README](README.md) |
| 1 | `/speckit-specify <descripción>` | `specs/NNN-nombre/spec.md` | Que describa **qué** hace, sin hablar de tecnología |
| 2 | `/speckit-clarify` | `spec.md` actualizado | Responder las preguntas sobre casos límite |
| 3 | `/speckit-plan` | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` | Que pase el «Constitution Check» |
| 4 | `/speckit-checklist` *(opcional)* | `checklists/*.md` | Calidad de los requisitos |
| 5 | `/speckit-tasks` | `tasks.md` | Que no sobre ni falte nada y el orden tenga sentido |
| 6 | `/speckit-analyze` | Reporte (no modifica archivos) | Corregir inconsistencias **antes** de programar |
| 7 | `/speckit-implement` | Código y pruebas | Revisar y probar |
| 8 | `/speckit-converge` | Reporte de lo que falta | Cerrar la funcionalidad |
| 9 | PR hacia `main` | — | Aprobación del otro integrante y CI en verde |

**Cómo se escribe cada comando:**
- **Claude Code** (VS Code o terminal): escribe `/speckit-specify` en el chat, seguido de la
  descripción.
- **Antigravity**: en el panel de chat en modo *Agent*, escribe `/speckit-specify` seguido de la
  descripción.

**Recomendación:** hagan un commit después de cada paso (`docs(001): spec`,
`docs(001): plan`, …). Así es fácil revisar qué cambió y volver atrás si un comando sale mal.

---

## 4. Trabajo en equipo

1. **Reserven el número antes de empezar.** En la tabla «Hoja de ruta de specs» del README cada
   funcionalidad tiene número, nombre y responsable. Así nadie crea dos `003` al mismo tiempo.
2. **Una rama por funcionalidad**, con el mismo nombre de su carpeta: `001-auth-onboarding`.
   El comando `/speckit-specify` no crea la rama en este proyecto; créenla ustedes en el paso 0.
3. **Revisión cruzada.** Antes de `/speckit-implement`, el otro integrante revisa `spec.md` y
   `plan.md`. Lo más práctico es abrir un PR en borrador (*draft*) apenas exista el plan.
4. **Respeten las dependencias.** Las specs se pueden escribir en paralelo, pero se implementan en
   el orden de la hoja de ruta.
5. **Los contratos son el acuerdo.** Si tu funcionalidad usa endpoints de otra, lee su
   `contracts/` antes de implementar. Si necesitas cambiarlo, se cambia en la spec dueña.
6. **Commits** con Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.

### Retomar una spec en otro computador

La spec activa se guarda en `.specify/feature.json`, que **no se sube a git**. Si haces pull de la
rama de tu compañero y quieres seguir con `/speckit-plan` o `/speckit-tasks`, primero indícale a
Spec Kit en qué carpeta trabajar:

```powershell
$env:SPECIFY_FEATURE_DIRECTORY = "specs/001-auth-onboarding"
```

Luego abre el agente desde esa misma terminal (o reinícialo). La primera vez que corra un comando,
Spec Kit guarda la carpeta en tu `feature.json` y ya no tienes que repetirlo.

---

## 5. Cambios de reglas

- Si algo cambia en el comportamiento: **primero la spec, después el código**.
- Si una spec necesita algo que la constitución no permite (una librería nueva, una funcionalidad
  fuera de la Fase 1), se detiene el trabajo y se enmienda la constitución con
  `/speckit-constitution`, en un PR propio aprobado por ambos.
- Cada enmienda sube la versión (MAJOR, MINOR o PATCH) y se registra en el historial al final de
  la constitución.

---

## 6. Problemas comunes

| Síntoma | Solución |
| :--- | :--- |
| `specify` no se reconoce | Reabre la terminal o ejecuta `$env:PATH = "$HOME\.local\bin;$env:PATH"` |
| Los comandos `/speckit-*` no aparecen en Claude Code | Verifica que exista `.claude/skills/` y reinicia la sesión |
| Los comandos no aparecen en Antigravity | Actualiza a Antigravity IDE ≥ 2.0 (usa `.agents/skills/`) |
| `Feature directory not found` | Define `SPECIFY_FEATURE_DIRECTORY` (ver sección 4) |
| Error de Python al correr un comando | Instala Python 3 y verifica que `python --version` funcione |
| Git muestra archivos modificados que nadie tocó | Son finales de línea; `.gitattributes` los normaliza. Ejecuta `git add --renormalize .` |
