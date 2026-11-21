import type { Clock } from '../../src/lib/clock.js';

/** Reloj controlable para probar vencimientos sin esperar. */
export class FakeClock implements Clock {
  private current: Date;

  constructor(start = new Date('2026-11-20T15:00:00.000Z')) {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  advanceSeconds(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }

  advanceMinutes(minutes: number): void {
    this.advanceSeconds(minutes * 60);
  }
}
