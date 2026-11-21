import { ErrorResponseSchema } from '@nova/shared';
import type { Request, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../../src/config/env.js';
import { createLogger } from '../../src/lib/logger.js';
import { createErrorHandler } from '../../src/middleware/error-handler.js';
import { PgRateLimitStore } from '../../src/middleware/rate-limit/pg-store.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase, uniqueEmail } from '../helpers/test-db.js';

let t: TestApp;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
});
afterAll(async () => {
  await t.close();
});

async function createUserWithSession() {
  const user = await t.prisma.user.create({
    data: {
      email: uniqueEmail(),
      fullName: 'Ana Pérez',
      passwordHash: 'x',
      passwordChangedAt: t.clock.now(),
    },
  });
  const issued = await t.auth.sessions.create(t.prisma, user.id);
  const agent = t.agent();
  agent.cookies.set('nova_at', issued.accessToken);
  return { user, issued, agent };
}

describe('infraestructura HTTP', () => {
  it('GET /api/v1/health responde ok con X-Request-Id', async () => {
    const res = await request(t.app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('una ruta /api inexistente da 404 con el formato uniforme', async () => {
    const res = await request(t.app).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    const body = ErrorResponseSchema.parse(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('un JSON mal formado da 400 VALIDATION_ERROR', async () => {
    const res = await request(t.app)
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(ErrorResponseSchema.parse(res.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('un cuerpo que no es JSON en un POST da 400 (require-json)', async () => {
    const res = await request(t.app)
      .post('/api/v1/auth/register')
      .set('Content-Type', 'text/plain')
      .send('email=ana@nova-test.edu.co');
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields._).toBe('content_type');
  });

  it('un error no controlado da 500 opaco y se registra', () => {
    const logger = createLogger('silent');
    const spy = vi.spyOn(logger, 'error');
    const json = vi.fn();
    const res = { status: vi.fn(() => ({ json })), setHeader: vi.fn() } as unknown as Response;
    createErrorHandler(logger)(
      new Error('detalle interno de SQL'),
      { requestId: '11111111-1111-4111-8111-111111111111' } as Request,
      res,
      vi.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0]?.[0] as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('SQL');
    expect(spy).toHaveBeenCalled();
  });
});

describe('sesión base (require-auth)', () => {
  it('sin cookie: 401 UNAUTHENTICATED', async () => {
    const res = await request(t.app).get('/api/v1/auth/session');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('con sesión válida devuelve el usuario y los tiempos de SessionInfo', async () => {
    const { user, agent } = await createUserWithSession();
    const res = await agent.get('/api/v1/auth/session');
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: user.id, email: user.email, fullName: 'Ana Pérez' });
    expect(res.body.session.idleTimeoutSeconds).toBe(900);
    expect(res.body.session.idleWarningSeconds).toBe(60);
  });

  it('más de 15 min sin actividad: SESSION_EXPIRED con reason=idle y auditoría', async () => {
    const { user, issued } = await createUserWithSession();
    t.clock.advanceMinutes(14);
    // El JWT dura 15 min: a los 14 sigue vigente, pero la sesión ya no la tocamos.
    await t.prisma.session.update({
      where: { id: issued.session.id },
      data: { lastActivityAt: new Date(t.clock.now().getTime() - 16 * 60 * 1000) },
    });
    const agent = t.agent();
    agent.cookies.set('nova_at', issued.accessToken);
    const res = await agent.get('/api/v1/auth/session');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: 'SESSION_EXPIRED', details: { reason: 'idle' } });
    const events = await t.prisma.auditEvent.findMany({
      where: { userId: user.id, type: 'SESSION_ENDED' },
    });
    expect(events).toHaveLength(1);
  });

  it('JWT vencido: ACCESS_TOKEN_EXPIRED (el cliente debe refrescar)', async () => {
    const { agent } = await createUserWithSession();
    t.clock.advanceMinutes(16);
    const res = await agent.get('/api/v1/auth/session');
    expect(res.body.error.code).toBe('ACCESS_TOKEN_EXPIRED');
  });

  it('pasadas 12 h: SESSION_EXPIRED con reason=absolute', async () => {
    const { issued } = await createUserWithSession();
    await t.prisma.session.update({
      where: { id: issued.session.id },
      data: { absoluteExpiresAt: new Date(t.clock.now().getTime() - 1000) },
    });
    const agent = t.agent();
    agent.cookies.set('nova_at', issued.accessToken);
    const res = await agent.get('/api/v1/auth/session');
    expect(res.body.error).toMatchObject({
      code: 'SESSION_EXPIRED',
      details: { reason: 'absolute' },
    });
  });
});

describe('auditoría inmutable', () => {
  it('UPDATE y TRUNCATE sobre audit_events fallan por los triggers', async () => {
    // Un evento real para que el trigger por fila tenga algo que proteger.
    await t.auth.sessions.endSession(
      (await createUserWithSession()).issued.session,
      'logout',
      '22222222-2222-4222-8222-222222222222',
    );
    await expect(
      t.prisma.$executeRawUnsafe(`UPDATE audit_events SET type = 'LOGIN_FAILED'`),
    ).rejects.toThrow(/inmutable/);
    await expect(t.prisma.$executeRawUnsafe('TRUNCATE audit_events')).rejects.toThrow(/inmutable/);
  });
});

describe('PgRateLimitStore', () => {
  it('cuenta dentro de la ventana y reinicia al vencer', async () => {
    const store = new PgRateLimitStore(t.prisma, t.clock, 'prueba');
    store.init({ windowMs: 60_000 } as Parameters<PgRateLimitStore['init']>[0]);
    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);
    expect((await store.increment('1.2.3.4')).totalHits).toBe(2);
    t.clock.advanceSeconds(61);
    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);
    await store.resetKey('1.2.3.4');
    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);
  });
});

describe('configuración (Principio VI)', () => {
  const base = { ...process.env };

  it('falta una variable requerida: no arranca', () => {
    expect(() => loadConfig({ ...base, JWT_ACCESS_SECRET: '' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('en producción, los overrides de inactividad están prohibidos', () => {
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'production', SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE: '20' }),
    ).toThrow(/prohibida en producción/);
  });

  it('el aviso debe ser menor que la inactividad', () => {
    expect(() =>
      loadConfig({
        ...base,
        SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE: '20',
        SESSION_IDLE_WARNING_SECONDS_OVERRIDE: '20',
      }),
    ).toThrow(/aviso debe ser menor/);
  });

  it('los overrides válidos llegan a SessionInfo', () => {
    const config = loadConfig({
      ...base,
      SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE: '20',
      SESSION_IDLE_WARNING_SECONDS_OVERRIDE: '8',
    });
    expect(config.session).toEqual({ idleTimeoutSeconds: 20, idleWarningSeconds: 8 });
  });
});
