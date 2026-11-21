# Guía de comandos — Spec-Driven Development (SDD) con Antigravity

**Proyecto de clase:** Gestión Documental (`document-management`)

> Esta guía documenta el flujo de trabajo clase a clase para Spec-Driven Development (SDD) utilizando **GitHub Spec Kit** y **Google Antigravity**.

---

## Prerrequisitos (Antes de la Clase 1)

Si no cuentas con el administrador de herramientas `uv` instalado en tu sistema (común en entornos Windows), ejecútalo en tu terminal PowerShell:

```powershell
# Opción A (Recomendada con instalador oficial):
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# Opción B (Si ya tienes Python instalado):
python -m pip install uv
```

Si es la primera vez que instalas `uv`, asegúrate de actualizar el PATH de tu terminal:
```powershell
uv tool update-shell
```

---

## Clase 1. Instalación, inicialización y especificaciones

### 1. Instalar o actualizar Spec Kit

Ejecutar en la **terminal** (PowerShell):

```powershell
uv tool install specify-cli --force --from git+https://github.com/github/spec-kit.git
```

> **Nota:** Si la terminal indica que `specify` no se reconoce, recarga tu terminal o agrega la ruta de ejecutables locales de usuario:
> ```powershell
> $env:PATH = "$HOME\.local\bin;$env:PATH"
> ```

### 2. Verificar la versión instalada

```powershell
specify version
```

### 3. Consultar las opciones de inicialización

```powershell
specify init --help
```

### 4. Crear el proyecto con Google Antigravity

En lugar de Copilot, utilizamos la integración oficial de **Antigravity** (`--integration agy`). En entornos Windows también recomendamos fijar los scripts a PowerShell (`--script ps`):

```powershell
specify init document-management --integration agy --ignore-agent-tools --script ps
```

> **¿Por qué `.agents/` en lugar de `.github/`?**  
> - **Google Antigravity** almacena sus habilidades y extensiones en la carpeta estándar `.agents/skills/`.
> - **GitHub Copilot** utiliza la carpeta `.github/skills/`.
> 
> Si deseas **soporte dual** (para que el proyecto funcione simultáneamente en Google Antigravity y en GitHub Copilot / VS Code), puedes instalar la integración de Copilot en el mismo proyecto ejecutando dentro de `document-management`:
> ```powershell
> specify integration install copilot --force
> ```
> *(¡Ya lo dejamos preconfigurado en este proyecto con ambas carpetas disponibles!)*

### 5. Ingresar al directorio del proyecto

```powershell
cd document-management
```

Al listar los archivos verás:
- `.agents/` → Configuración y skills para **Google Antigravity**.
- `.github/` → Configuración y skills para **GitHub Copilot**.
- `.specify/` → Memoria, plantillas de especificaciones, constitución y scripts SDD.

Abre esta carpeta en **Google Antigravity IDE** y utiliza el panel de **Antigravity Chat (Modo Agent)** para los siguientes comandos.

---

### 6. Crear la constitución del proyecto

**En el Chat de Antigravity:**

```text
/speckit-constitution
```

- **Propósito:** Define los principios no negociables, estándares de arquitectura, gobernanza, librerías permitidas y restricciones técnicas que el agente debe respetar a lo largo de todo el desarrollo.
- **Archivo generado:** `.specify/memory/constitution.md`

### 7. Crear la especificación funcional inicial

**En el Chat de Antigravity:**

```text
/speckit-specify
```

- **Propósito:** Describe qué debe hacer el sistema para el módulo de Gestión Documental: historias de usuario, requerimientos funcionales, reglas de negocio, validaciones y criterios de aceptación.
- **Archivo generado:** `.specify/templates/` y carpetas de especificaciones en `.specify/`.

---

## Próximas clases (Ruta completa de Spec-Driven Development)

En el flujo de SDD con Spec Kit y Antigravity, las siguientes clases cubren el ciclo de vida completo:

### Clase 2. Desambiguación y Preguntas Críticas
Antes de diseñar la solución técnica, se eliminan dudas y zonas grises:
- **En Antigravity Chat:**
  ```text
  /speckit-clarify
  ```
  Permite al agente hacer preguntas estructuradas sobre requerimientos ambiguos, casos límite y políticas de almacenamiento de documentos.

### Clase 3. Arquitectura y Plan Técnico de Implementación
Diseño de contratos, modelos de datos y decisiones arquitectónicas:
- **En Antigravity Chat:**
  ```text
  /speckit-plan
  ```
  Genera el plan de arquitectura técnica asegurando coherencia con la Constitución.
- **Validación de calidad (opcional):**
  ```text
  /speckit-checklist
  ```
  Genera listas de control de completitud y consistencia técnica.

### Clase 4. Desglose de Tareas y Auditoría de Consistencia
Convertir las especificaciones y arquitectura en unidades de trabajo atómicas:
- **En Antigravity Chat:**
  ```text
  /speckit-tasks
  ```
  Genera el backlog ordenado de tareas técnicas de desarrollo y testing.
- **Auditoría cruzada (antes de codificar):**
  ```text
  /speckit-analyze
  ```
  Revisa la alineación y consistencia entre la especificación, el plan técnico y la lista de tareas.

### Clase 5. Implementación Guiada y Convergencia
Construcción del software guiada por especificaciones:
- **En Antigravity Chat:**
  ```text
  /speckit-implement
  ```
  El agente toma las tareas definidas y programa los módulos, modelos, controladores y pruebas.
- **Verificación de cierre:**
  ```text
  /speckit-converge
  ```
  Audita el código implementado contra los specs para determinar qué falta o si el proyecto converge al 100%.
