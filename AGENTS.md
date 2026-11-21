# Instrucciones para agentes de IA

Este archivo aplica a todos los agentes que trabajan en el repositorio (Claude Code, Google
Antigravity, GitHub Copilot). No agrega reglas propias: remite a las fuentes oficiales.

1. **Lee primero la constitución**: [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
   Es la norma máxima del proyecto. Si una instrucción, spec o tarea la contradice, detente,
   señala el conflicto y espera una enmienda antes de escribir código.
2. **Trabaja con Spec Kit**: todo cambio de comportamiento parte de una spec en
   `specs/NNN-nombre/`. Implementa solo lo que dicen `spec.md`, `plan.md` y `tasks.md`; no
   agregues funcionalidades, dependencias, endpoints ni tablas que no estén ahí.
3. **Sigue el flujo del equipo** descrito en [`GUIA_COMANDOS_SDD.md`](GUIA_COMANDOS_SDD.md): el
   equipo se divide por capa (backend / frontend). Cuando te pidan implementar, ejecuta solo las
   tareas de `tasks.md` con la etiqueta indicada (`[SH]`, `[BE]`, `[FE]` o `[E2E]`) y no
   modifiques archivos de otra capa. Si una tarea exige cambiar `contracts/` o `/shared` fuera de
   la rama de definición, detente y avisa.
4. **Entorno**: el equipo usa Windows con PowerShell. Los scripts de Spec Kit están en
   `.specify/scripts/powershell/`. Los scripts de `package.json` deben funcionar en Windows.
5. **Idioma**: responde y escribe documentación en español; el código y sus identificadores van en
   inglés.
6. **Al terminar una tarea**, reporta qué archivos creaste o modificaste y qué reglas de la
   constitución verificaste.
