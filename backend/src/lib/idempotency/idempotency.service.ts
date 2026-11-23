import type { Prisma } from '@nova/db';

import { addSeconds, type Clock } from '../clock.js';
import { sha256Hex } from '../crypto.js';
import type { Db, PrismaClient } from '../db.js';
import { appError } from '../errors.js';
import type { Maintenance } from '../maintenance.js';
import { idempotencyRepository as repo } from './idempotency.repository.js';

const TTL_SECONDS = 24 * 60 * 60;

export type BeginResult =
  { kind: 'new'; id: string } | { kind: 'replay'; status: number; body: Prisma.JsonValue };

/** JSON con las claves ordenadas: el mismo cuerpo siempre da el mismo hash. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Idempotencia de los POST que mueven dinero (constitución, regla de dominio 4; spec 002 R5).
 * Todo ocurre DENTRO de la transacción de negocio: si la operación falla, la clave no queda.
 */
export function createIdempotencyService(clock: Clock) {
  async function begin(
    tx: Db,
    input: { userId: string; scope: string; key: string; body: unknown },
  ): Promise<BeginResult> {
    const now = clock.now();
    const requestHash = sha256Hex(canonical(input.body));
    const id = await repo.insertIfNew(tx, {
      userId: input.userId,
      scope: input.scope,
      key: input.key,
      requestHash,
      now,
      expiresAt: addSeconds(now, TTL_SECONDS),
    });
    if (id) return { kind: 'new', id };

    const existing = await repo.find(tx, input.userId, input.scope, input.key);
    if (
      !existing ||
      existing.requestHash !== requestHash ||
      existing.responseStatus === null ||
      existing.responseBody === null
    ) {
      throw appError('IDEMPOTENCY_KEY_REUSED');
    }
    return { kind: 'replay', status: existing.responseStatus, body: existing.responseBody };
  }

  async function complete(
    tx: Db,
    id: string,
    status: number,
    body: Prisma.InputJsonValue,
  ): Promise<void> {
    await repo.saveResponse(tx, id, status, body);
  }

  /** Limpieza propia de lib/idempotency: claves vencidas (más de 24 h). */
  function registerCleanup(maintenance: Maintenance, prisma: PrismaClient): void {
    maintenance.registerCleanup('idempotency_keys', (now) => repo.deleteExpired(prisma, now));
  }

  return { begin, complete, registerCleanup };
}

export type IdempotencyService = ReturnType<typeof createIdempotencyService>;
