const bogotaYearMonthFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: 'numeric',
});

/**
 * Indica si una tarjeta ya venció según la hora de Colombia (`America/Bogota`).
 * Una tarjeta vence al terminar su mes de vencimiento (spec 004, FR-013 y T037).
 */
export function isCardExpiredInBogota(
  expMonth: number,
  expYear: number,
  now: Date = new Date(),
): boolean {
  const parts = bogotaYearMonthFormatter.formatToParts(now);
  const currentYear = Number(parts.find((part) => part.type === 'year')?.value ?? 0);
  const currentMonth = Number(parts.find((part) => part.type === 'month')?.value ?? 0);
  if (!currentYear || !currentMonth) return false;
  return currentYear > expYear || (currentYear === expYear && currentMonth > expMonth);
}

/** Formatea mes y año como `MM/AA`. */
export function formatCardExpiry(expMonth: number, expYear: number): string {
  const mm = String(expMonth).padStart(2, '0');
  const yy = String(expYear % 100).padStart(2, '0');
  return `${mm}/${yy}`;
}

/** Agrupa un número de tarjeta de hasta 16 dígitos en bloques de 4 (`9012 3456 7890 1234`). */
export function formatCardNumberGroups(raw: string): string {
  const digits = raw.replace(/\D+/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}
