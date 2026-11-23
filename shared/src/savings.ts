/**
 * Reglas puras de las metas de ahorro (spec 005, research R8). El frontend y el backend usan las
 * mismas funciones para el progreso y las fechas.
 */

export const MAX_ACTIVE_GOALS = 5;
export const GOAL_NAME_MAX_LENGTH = 40;
export const SAVINGS_TARGET_MIN = 1000;
export const SAVINGS_TARGET_MAX = 100_000_000;
/** La fecha límite puede estar hasta 10 años en el futuro. */
export const GOAL_DATE_MAX_YEARS = 10;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `AAAA-MM-DD` que existe en el calendario («2026-02-30» no). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const bogotaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Fecha calendario de `now` en Bogotá como `AAAA-MM-DD`. */
export function bogotaToday(now: Date): string {
  return bogotaDate.format(now);
}

/** Misma fecha `years` años después (el 29 de febrero pasa al 28 si el año no es bisiesto). */
export function addYearsToIsoDate(value: string, years: number): string {
  const [, y = '0', m = '01', d = '01'] = ISO_DATE.exec(value) ?? [];
  const year = Number(y) + years;
  const lastDay = new Date(Date.UTC(year, Number(m), 0)).getUTCDate();
  return `${year}-${m}-${String(Math.min(Number(d), lastDay)).padStart(2, '0')}`;
}

/** Meses completos entre dos fechas `AAAA-MM-DD`, al menos 1. */
function monthsUntil(today: string, target: string): number {
  const [, y1 = '0', m1 = '0', d1 = '0'] = ISO_DATE.exec(today) ?? [];
  const [, y2 = '0', m2 = '0', d2 = '0'] = ISO_DATE.exec(target) ?? [];
  let months = (Number(y2) - Number(y1)) * 12 + (Number(m2) - Number(m1));
  if (Number(d2) < Number(d1)) months -= 1;
  return Math.max(1, months);
}

export interface GoalProgress {
  /** Porcentaje para la barra: entero de 0 a 100 (redondeado hacia abajo). */
  percent: number;
  /** Lo que falta para el objetivo; 0 si ya se cumplió. */
  remaining: number;
  /** Saldo ≥ objetivo (FR-004). */
  completed: boolean;
  /** Tiene fecha, ya pasó y no se cumplió. */
  overdue: boolean;
  /** Lo que falta dividido entre los meses que quedan (mínimo 1); null sin fecha, cumplida o vencida. */
  suggestedMonthly: number | null;
}

/** Progreso de una meta a la fecha `today` (`AAAA-MM-DD` en Bogotá) (FR-003, FR-004). */
export function goalProgress(
  goal: { balance: number; targetAmount: number; targetDate: string | null },
  today: string,
): GoalProgress {
  const completed = goal.balance >= goal.targetAmount;
  const remaining = Math.max(0, goal.targetAmount - goal.balance);
  const percent = Math.min(100, Math.floor((goal.balance * 100) / goal.targetAmount));
  const overdue = goal.targetDate !== null && goal.targetDate < today && !completed;
  const suggestedMonthly =
    goal.targetDate !== null && !completed && !overdue
      ? Math.ceil(remaining / monthsUntil(today, goal.targetDate))
      : null;
  return { percent, remaining, completed, overdue, suggestedMonthly };
}
