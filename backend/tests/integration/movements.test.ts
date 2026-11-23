/** Spec 002 · US3 — Historial completo por cursor (tasks.md T035). */
import { MovementsPageSchema } from '@nova/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TestAgent } from '../helpers/agent.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase } from '../helpers/test-db.js';
import { IDEMPOTENCY, createUserWithSession, newKey } from '../helpers/users.js';

const MOVEMENTS = '/api/v1/accounts/me/movements';
let t: TestApp;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
});
afterAll(async () => {
  await t.close();
});

/** Hace `n` recargas de 1.000, 1.001, … (montos distintos para identificarlas). */
async function topups(agent: TestAgent, n: number, start = 1000): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await agent.post('/api/v1/topups', { amount: start + i }, { [IDEMPOTENCY]: newKey() });
    t.clock.advanceSeconds(1);
  }
}

const amounts = (body: { items: { amount: number }[] }) => body.items.map((m) => m.amount);

describe('US3 · historial (FR-020)', () => {
  it('páginas de 20 en orden, sin repetir ni saltar, hasta nextCursor null', async () => {
    const { agent } = await createUserWithSession(t);
    await topups(agent, 45);
    const seen: number[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res = await agent.get(cursor ? `${MOVEMENTS}?cursor=${cursor}` : MOVEMENTS);
      expect(res.status).toBe(200);
      const page = MovementsPageSchema.parse(res.body);
      seen.push(...amounts(page));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor);
    expect(pages).toBe(3);
    expect(seen).toEqual(Array.from({ length: 45 }, (_, i) => 1044 - i));
  });

  it('una recarga nueva entre páginas no desplaza ni duplica el resultado', async () => {
    const { agent } = await createUserWithSession(t, 'estable');
    await topups(agent, 25);
    const first = (await agent.get(MOVEMENTS)).body;
    await topups(agent, 1, 9000); // movimiento nuevo mientras navega
    const second = (await agent.get(`${MOVEMENTS}?cursor=${first.nextCursor}`)).body;
    const all = [...amounts(first), ...amounts(second)];
    expect(all).toEqual(Array.from({ length: 25 }, (_, i) => 1024 - i));
    expect(second.nextCursor).toBeNull();
  });

  it('respeta limit y lo valida', async () => {
    const { agent } = await createUserWithSession(t, 'limite');
    await topups(agent, 3);
    expect((await agent.get(`${MOVEMENTS}?limit=2`)).body.items).toHaveLength(2);
    for (const q of ['limit=0', 'limit=21', 'limit=x', 'otro=1']) {
      expect((await agent.get(`${MOVEMENTS}?${q}`)).status, q).toBe(400);
    }
  });

  it('un cursor inválido: 400 VALIDATION_ERROR', async () => {
    const { agent } = await createUserWithSession(t, 'cursor');
    const res = await agent.get(`${MOVEMENTS}?cursor=no-es-un-cursor`);
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields.cursor).toBe('invalid');
  });

  it('sin movimientos: página vacía; y cada estudiante ve solo los suyos', async () => {
    const { agent: empty } = await createUserWithSession(t, 'vacio');
    expect((await empty.get(MOVEMENTS)).body).toEqual({ items: [], nextCursor: null });
    const { agent: other } = await createUserWithSession(t, 'otro');
    await topups(other, 2);
    expect((await empty.get(MOVEMENTS)).body.items).toEqual([]);
  });
});
