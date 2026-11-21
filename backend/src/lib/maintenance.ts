import type { Clock } from './clock.js';
import type { Logger } from './logger.js';

/** Limpieza de las tablas propias de un módulo; devuelve las filas borradas. */
export type Cleanup = (now: Date) => Promise<number>;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Programador de mantenimiento (research R6, Principio VI): cada dueño registra la limpieza de
 * sus propias tablas; este programador solo las ejecuta.
 */
export class Maintenance {
  private readonly cleanups = new Map<string, Cleanup>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  registerCleanup(name: string, cleanup: Cleanup): void {
    this.cleanups.set(name, cleanup);
  }

  /** Ejecuta todas las limpiezas; una que falla no impide las demás. */
  async runAll(): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    for (const [name, cleanup] of this.cleanups) {
      try {
        results[name] = await cleanup(this.clock.now());
      } catch (error) {
        this.logger.error({ err: error, cleanup: name }, 'mantenimiento: limpieza fallida');
      }
    }
    return results;
  }

  start(intervalMs = HOUR_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runAll();
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
