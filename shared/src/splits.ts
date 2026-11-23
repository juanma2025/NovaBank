/** Reglas puras de los gastos compartidos (spec 007, research R4). */

export const SPLIT_MAX_PARTICIPANTS = 10;
export const SPLIT_TOTAL_MIN = 2000;
export const SPLIT_TOTAL_MAX = 5_000_000;
export const SPLIT_TITLE_MAX_LENGTH = 60;
/** Un recordatorio por participante cada 24 horas (FR-011). */
export const SPLIT_REMINDER_INTERVAL_HOURS = 24;

/**
 * Partes iguales entre quien crea y `participants` personas (FR-002): cada participante debe
 * `floor(total / (participants + 1))` y quien crea asume el resto. $10.000 entre 3 → 3.334 y 3.333.
 */
export function splitEvenly(
  total: number,
  participants: number,
): { creatorShare: number; share: number } {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('total inválido');
  if (!Number.isInteger(participants) || participants < 1)
    throw new Error('participantes inválidos');
  const share = Math.floor(total / (participants + 1));
  return { creatorShare: total - share * participants, share };
}
