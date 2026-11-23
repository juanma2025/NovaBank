import { addSeconds } from './clock.js';

/** Regla de bloqueo por intentos fallidos: `failures` dentro de `windowMs`. */
export interface AttemptRule {
  failures: number;
  windowMs: number;
}

/** Duración del bloqueo en todas las reglas de Nova (specs 001, 003 y 004). */
export const LOCK_SECONDS = 15 * 60;

/**
 * Fin del bloqueo según los fallos más recientes (`latest`, del más nuevo al más viejo): si son
 * `failures` y el más antiguo ocurrió dentro de la ventana respecto al más reciente, dura hasta el
 * más reciente + 15 min. Si no hay bloqueo, null.
 */
export function lockedUntil(latest: Date[], rule: AttemptRule): Date | null {
  const newest = latest[0];
  const oldest = latest[rule.failures - 1];
  if (!newest || !oldest) return null;
  if (newest.getTime() - oldest.getTime() > rule.windowMs) return null;
  return addSeconds(newest, LOCK_SECONDS);
}
