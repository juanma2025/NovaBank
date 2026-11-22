function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Valida rutas de redirección interna (?redirect=). Solo acepta rutas relativas que empiecen
 * con `/` y no con `//` ni `/\`, sin barras invertidas ni caracteres de control (FR-018).
 */
export function safeRedirect(target: string | null | undefined, fallback = '/inicio'): string {
  if (!target) return fallback;
  const trimmed = target.trim();
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return fallback;
  if (trimmed.includes('\\')) return fallback;
  if (hasControlCharacter(trimmed)) return fallback;
  return trimmed;
}
