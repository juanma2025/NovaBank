import type { IncrementResponse, Options, Store } from 'express-rate-limit';

import type { Clock } from '../../lib/clock.js';
import type { PrismaClient } from '../../lib/db.js';

interface HitRow {
  hits: number;
  reset_at: Date;
}

/**
 * Store compartido de express-rate-limit en PostgreSQL (research R8; Principio VI: nada de
 * contadores en memoria). Tabla: data-model.md `RateLimitHit` (key, hits, reset_at).
 */
export class PgRateLimitStore implements Store {
  /** Las claves se comparten entre instancias de la API. */
  localKeys = false;
  prefix: string;
  private windowMs = 60_000;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly clock: Clock,
    prefix: string,
  ) {
    this.prefix = `${prefix}:`;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private key(key: string): string {
    return `${this.prefix}${key}`.slice(0, 200);
  }

  /**
   * Incremento atómico: si la ventana venció, reinicia el contador (SQL explícito permitido
   * por la constitución v2.3.0 para operaciones de concurrencia; ver plan.md).
   */
  async increment(key: string): Promise<IncrementResponse> {
    const now = this.clock.now();
    const resetAt = new Date(now.getTime() + this.windowMs);
    const rows = await this.prisma.$queryRaw<HitRow[]>`
      INSERT INTO rate_limit_hits (key, hits, reset_at)
      VALUES (${this.key(key)}, 1, ${resetAt})
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN rate_limit_hits.reset_at <= ${now} THEN 1
                    ELSE rate_limit_hits.hits + 1 END,
        reset_at = CASE WHEN rate_limit_hits.reset_at <= ${now} THEN EXCLUDED.reset_at
                        ELSE rate_limit_hits.reset_at END
      RETURNING hits, reset_at`;
    const row = rows[0];
    if (!row) throw new Error('rate_limit_hits: INSERT sin resultado');
    return { totalHits: row.hits, resetTime: row.reset_at };
  }

  async decrement(key: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE rate_limit_hits SET hits = GREATEST(hits - 1, 0) WHERE key = ${this.key(key)}`;
  }

  async resetKey(key: string): Promise<void> {
    await this.prisma.$executeRaw`DELETE FROM rate_limit_hits WHERE key = ${this.key(key)}`;
  }

  /** Limpieza registrada en el mantenimiento: borra contadores vencidos (research R6). */
  static async cleanupExpired(prisma: PrismaClient, now: Date): Promise<number> {
    return prisma.$executeRaw`DELETE FROM rate_limit_hits WHERE reset_at <= ${now}`;
  }
}
