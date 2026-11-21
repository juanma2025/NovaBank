/** Reloj inyectable: los servicios nunca llaman a `new Date()` directamente (pruebas con tiempo). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export const addSeconds = (date: Date, seconds: number): Date =>
  new Date(date.getTime() + seconds * 1000);

export const secondsUntil = (from: Date, to: Date): number =>
  Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 1000));
