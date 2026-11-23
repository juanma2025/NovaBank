/**
 * Nombre parcial para la vista previa del destinatario (spec 003, FR-002): el primer nombre completo
 * y la inicial con punto de cada palabra restante. «Ana Pérez Gómez» → «Ana P. G.».
 */
export function partialName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/).filter(Boolean);
  if (!first) return '';
  const initials = rest.map((word) => `${[...word][0]?.toLocaleUpperCase('es-CO') ?? ''}.`);
  return [first, ...initials].join(' ');
}
