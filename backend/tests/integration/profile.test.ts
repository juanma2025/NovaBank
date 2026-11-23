/**
 * Spec 003 · US2 — Alias (tasks.md T022).
 */
import { ProfileSchema } from '@nova/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase } from '../helpers/test-db.js';
import { createUserWithSession } from '../helpers/users.js';

const ME = '/api/v1/profile/me';
const ALIAS = `${ME}/alias`;
let t: TestApp;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
});
afterAll(async () => {
  await t.close();
});

describe('US2 · perfil y alias (FR-015–FR-018)', () => {
  it('el perfil muestra nombre, correo y alias null al inicio', async () => {
    const { agent, email } = await createUserWithSession(t, 'perfil', { fullName: 'Ana Pérez' });
    const res = await agent.get(ME);
    expect(res.status).toBe(200);
    expect(ProfileSchema.parse(res.body)).toEqual({ fullName: 'Ana Pérez', email, alias: null });
  });

  it('asigna el alias normalizado y lo audita sin el alias en metadata', async () => {
    const { agent, userId } = await createUserWithSession(t, 'asigna');
    const res = await agent.put(ALIAS, { alias: '  @Ana.Perez ' });
    expect(res.status).toBe(200);
    expect(res.body.alias).toBe('ana.perez');
    expect((await agent.get(ME)).body.alias).toBe('ana.perez');
    const events = await t.prisma.auditEvent.findMany({
      where: { userId, type: 'ALIAS_CHANGED' },
    });
    expect(events.map((e) => e.metadata)).toEqual([{ action: 'set' }]);
    // Repetir el mismo alias no genera otro evento.
    await agent.put(ALIAS, { alias: 'ana.perez' });
    expect(await t.prisma.auditEvent.count({ where: { userId, type: 'ALIAS_CHANGED' } })).toBe(1);
  });

  it('formato inválido: 400 VALIDATION_ERROR', async () => {
    const { agent } = await createUserWithSession(t, 'invalido');
    for (const alias of ['.ab', 'ab_', 'a', 'con espacio', 'ñandu', 'a'.repeat(21)]) {
      const res = await agent.put(ALIAS, { alias });
      expect(res.status, alias).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect((await agent.put(ALIAS, { alias: 'valido', extra: 1 })).status).toBe(400);
  });

  it('alias de otro estudiante: 409 ALIAS_TAKEN; al cambiarlo, el anterior queda libre', async () => {
    const a = await createUserWithSession(t, 'dueno');
    const b = await createUserWithSession(t, 'otro');
    await a.agent.put(ALIAS, { alias: 'compartido' });
    const taken = await b.agent.put(ALIAS, { alias: '@COMPARTIDO' });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('ALIAS_TAKEN');

    expect((await a.agent.put(ALIAS, { alias: 'nuevo.alias' })).body.alias).toBe('nuevo.alias');
    expect((await b.agent.put(ALIAS, { alias: 'compartido' })).status).toBe(200);
  });

  it('dos estudiantes piden el mismo alias a la vez: uno lo obtiene y el otro recibe 409', async () => {
    const users = await Promise.all(
      Array.from({ length: 4 }, (_, i) => createUserWithSession(t, `carrera${i}`)),
    );
    const results = await Promise.all(
      users.map((u) => u.agent.put(ALIAS, { alias: 'el.primero' })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.body?.error?.code === 'ALIAS_TAKEN')).toHaveLength(3);
  });

  it('quitar el alias lo libera y se audita una sola vez', async () => {
    const a = await createUserWithSession(t, 'quita');
    const b = await createUserWithSession(t, 'toma');
    await a.agent.put(ALIAS, { alias: 'para.quitar' });
    const removed = await a.agent.delete(ALIAS);
    expect(removed.status).toBe(200);
    expect(removed.body.alias).toBeNull();
    expect((await a.agent.delete(ALIAS)).status).toBe(200);
    const events = await t.prisma.auditEvent.findMany({
      where: { userId: a.userId, type: 'ALIAS_CHANGED' },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((e) => e.metadata)).toEqual([{ action: 'set' }, { action: 'removed' }]);
    expect((await b.agent.put(ALIAS, { alias: 'para.quitar' })).status).toBe(200);
  });

  it('quitar sin haber tenido alias: 200 con alias null', async () => {
    const { agent } = await createUserWithSession(t, 'nunca');
    const res = await agent.delete(ALIAS);
    expect(res.status).toBe(200);
    expect(res.body.alias).toBeNull();
  });

  it('sin sesión: 401', async () => {
    expect((await request(t.app).get(ME)).status).toBe(401);
    expect((await request(t.app).put(ALIAS).send({ alias: 'abc' })).status).toBe(401);
    expect((await request(t.app).delete(ALIAS)).status).toBe(401);
  });
});
