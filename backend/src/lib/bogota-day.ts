const bogotaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Inicio (00:00) del día calendario de `now` en America/Bogota, como instante UTC.
 * Los topes diarios se cuentan en hora de Colombia (constitución, supuestos operativos).
 * Colombia no usa horario de verano: medianoche en Bogotá es siempre 05:00 UTC.
 */
export function startOfBogotaDay(now: Date): Date {
  // en-CA formatea como AAAA-MM-DD.
  const day = bogotaDate.format(now);
  return new Date(`${day}T00:00:00-05:00`);
}
