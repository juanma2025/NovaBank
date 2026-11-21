/** US2 — Inicio y cierre de sesión (spec.md; tasks.md T059). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashPassword } from '../../src/modules/auth/password-policy.js';
import type { TestAgent } from '../helpers/agent.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase, uniqueEmail } from '../helpers/test-db.js';

const API = '/api/v1/auth';
const PASSWORD = 'Arepa con queso 2026!';

let t: TestApp;
let passwordHash: string;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
  passwordHash = await hashPassword(PASSWORD);
});
afterAll(async () => {
  await t.close();
});

async function createUser(prefix = 'ana') {
  return t.prisma.user.create({
    data: {
      email: uniqueEmail(prefix),
      fullName: 'Ana Pérez',
      passwordHash,
      passwordChangedAt: t.clock.now(),
    },
  });
}

let deviceCounter = 0;
/** Navegador que ya tiene su cookie de dispositivo (nova_dev), como uno que volvió a Nova. */
function deviceAgent(): TestAgent {
  deviceCounter += 1;
  const agent = t.agent();
  agent.cookies.set('nova_dev', `dispositivo-de-prueba-${deviceCounter}-${'z'.repeat(20)}`);
  return agent;
}

const login = (agent: TestAgent, email: string, password = PASSWORD) =>
  agent.post(`${API}/login`, { email, password });

async function failTimes(agent: TestAgent, email: string, times: number) {
  for (let i = 0; i < times; i += 1) await login(agent, email, 'contraseña equivocada');
}

describe('US2 · inicio de sesión', () => {
  it('credenciales correctas: 200, cookies seguras y la sesión responde', async () => {
    const user = await createUser();
    const agent = t.agent();
    const res = await login(agent, user.email);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: user.id, email: user.email, fullName: 'Ana Pérez' });
    for (const name of ['nova_at', 'nova_rt', 'nova_dev']) {
      const cookie = agent.lastSetCookie(name) ?? '';
      expect(cookie, name).toMatch(/HttpOnly/i);
      expect(cookie, name).toMatch(/Secure/i);
      expect(cookie, name).toMatch(/SameSite=Strict/i);
    }
    expect(agent.lastSetCookie('nova_rt')).toMatch(/Path=\/api\/v1\/auth/);
    expect((await agent.get(`${API}/session`)).status).toBe(200);
  });

  it('acepta el correo con mayúsculas y espacios', async () => {
    const user = await createUser();
    const res = await login(t.agent(), `  ${user.email.toUpperCase()} `);
    expect(res.status).toBe(200);
  });

  it('contraseña incorrecta y correo inexistente dan el mismo error genérico (FR-014)', async () => {
    const user = await createUser();
    const wrong = await login(t.agent(), user.email, 'otra contraseña larga');
    const missing = await login(t.agent(), uniqueEmail('nadie'));
    for (const res of [wrong, missing]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    }
    expect(wrong.body.error.message).toBe(missing.body.error.message);
  });
});

describe('US2 · bloqueo por intentos (FR-015, data-model.md LoginAttempt)', () => {
  it('el quinto fallo desde el mismo origen bloquea, con minutos restantes', async () => {
    const user = await createUser('bloqueo');
    const agent = deviceAgent();
    await failTimes(agent, user.email, 4);
    const fifth = await login(agent, user.email, 'contraseña equivocada');
    expect(fifth.status).toBe(429);
    expect(fifth.body.error.code).toBe('LOGIN_LOCKED');
    expect(fifth.body.error.details.retryAfterSeconds).toBe(15 * 60);
    expect(Number(fifth.headers['retry-after'])).toBe(15 * 60);
    // Bloqueado incluso con la contraseña correcta.
    const correct = await login(agent, user.email);
    expect(correct.body.error.code).toBe('LOGIN_LOCKED');
  });

  it('otro dispositivo (otro nova_dev) entra aunque el primero esté bloqueado', async () => {
    const user = await createUser('otrodisp');
    const blocked = deviceAgent();
    await failTimes(blocked, user.email, 5);
    expect((await login(blocked, user.email)).body.error.code).toBe('LOGIN_LOCKED');
    const other = t.agent();
    other.cookies.set('nova_dev', 'otro-dispositivo-0000000000000000000000000000');
    expect((await login(other, user.email)).status).toBe(200);
  });

  it('el bloqueo dura 15 min desde el quinto fallo y los intentos durante el bloqueo no lo alargan', async () => {
    const user = await createUser('duracion');
    const agent = deviceAgent();
    await failTimes(agent, user.email, 4);
    t.clock.advanceMinutes(10);
    await login(agent, user.email, 'contraseña equivocada'); // quinto fallo: bloquea hasta +15
    t.clock.advanceMinutes(14);
    expect((await login(agent, user.email)).body.error.code).toBe('LOGIN_LOCKED');
    t.clock.advanceMinutes(1);
    expect((await login(agent, user.email)).status).toBe(200);
  });

  it('5 fallos repartidos en más de 15 min no bloquean', async () => {
    const user = await createUser('repartidos');
    const agent = deviceAgent();
    for (let i = 0; i < 5; i += 1) {
      await login(agent, user.email, 'contraseña equivocada');
      t.clock.advanceMinutes(4);
    }
    expect((await login(agent, user.email)).status).toBe(200);
  });

  it('20 fallos en una hora desde distintos orígenes bloquean el correo en todos lados', async () => {
    const user = await createUser('global');
    for (let device = 0; device < 5; device += 1) {
      const agent = deviceAgent();
      agent.cookies.set('nova_dev', `dispositivo-${device}-${'x'.repeat(30)}`);
      await failTimes(agent, user.email, 4);
    }
    const fresh = t.agent();
    fresh.cookies.set('nova_dev', `dispositivo-nuevo-${'y'.repeat(30)}`);
    const res = await login(fresh, user.email);
    expect(res.body.error.code).toBe('LOGIN_LOCKED');
  });

  it('un inicio de sesión exitoso borra los fallos de ese origen', async () => {
    const user = await createUser('limpia');
    const agent = deviceAgent();
    await failTimes(agent, user.email, 4);
    expect((await login(agent, user.email)).status).toBe(200);
    await failTimes(agent, user.email, 4);
    expect((await login(agent, user.email)).status).toBe(200);
  });

  it('sin cookie de dispositivo, los intentos cuentan por IP (research R7)', async () => {
    const user = await createUser('sincookie');
    const agent = t.agent();
    for (let i = 0; i < 5; i += 1) {
      agent.cookies.delete('nova_dev');
      await login(agent, user.email, 'contraseña equivocada');
    }
    agent.cookies.delete('nova_dev');
    expect((await login(agent, user.email)).body.error.code).toBe('LOGIN_LOCKED');
  });

  it('el bloqueo aplica también a correos sin cuenta', async () => {
    const agent = deviceAgent();
    const email = uniqueEmail('fantasma');
    await failTimes(agent, email, 4);
    const res = await login(agent, email, 'contraseña equivocada');
    expect(res.body.error.code).toBe('LOGIN_LOCKED');
  });
});

describe('US2 · refresh y rotación (research R2)', () => {
  it('refresh rota el refresh token y emite un acceso nuevo', async () => {
    const user = await createUser('refresh');
    const agent = t.agent();
    await login(agent, user.email);
    const before = agent.cookies.get('nova_rt');
    t.clock.advanceMinutes(1);
    const res = await agent.post(`${API}/refresh`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(agent.cookies.get('nova_rt')).not.toBe(before);
    expect(agent.lastSetCookie('nova_at')).toBeDefined();
  });

  it('el refresh token anterior antes de 10 s: 200 sin cookies nuevas', async () => {
    const user = await createUser('ventana');
    const agent = t.agent();
    await login(agent, user.email);
    const old = agent.cookies.get('nova_rt') ?? '';
    await agent.post(`${API}/refresh`);
    const otherTab = t.agent();
    otherTab.cookies.set('nova_rt', old);
    t.clock.advanceSeconds(5);
    const res = await otherTab.post(`${API}/refresh`);
    expect(res.status).toBe(200);
    expect(otherTab.setCookieHeaders).toHaveLength(0);
  });

  it('el refresh token anterior después de 10 s: se considera reuso y revoca la sesión', async () => {
    const user = await createUser('reuso');
    const agent = t.agent();
    await login(agent, user.email);
    const old = agent.cookies.get('nova_rt') ?? '';
    await agent.post(`${API}/refresh`);
    const attacker = t.agent();
    attacker.cookies.set('nova_rt', old);
    t.clock.advanceSeconds(11);
    const res = await attacker.post(`${API}/refresh`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({
      code: 'SESSION_EXPIRED',
      details: { reason: 'revoked' },
    });
    // La sesión legítima también quedó revocada.
    expect((await agent.post(`${API}/refresh`)).body.error.code).toBe('SESSION_EXPIRED');
    const session = await t.prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(session.revokeReason).toBe('reuse_detected');
  });

  it('sin refresh token: 401 UNAUTHENTICATED; token desconocido: 401', async () => {
    expect((await t.agent().post(`${API}/refresh`)).body.error.code).toBe('UNAUTHENTICATED');
    const agent = t.agent();
    agent.cookies.set('nova_rt', 'token-que-no-existe');
    expect((await agent.post(`${API}/refresh`)).status).toBe(401);
  });

  it('refresh tras más de 15 min sin actividad: SESSION_EXPIRED con reason=idle', async () => {
    const user = await createUser('inactivo');
    const agent = t.agent();
    await login(agent, user.email);
    t.clock.advanceMinutes(16);
    const res = await agent.post(`${API}/refresh`);
    expect(res.body.error).toMatchObject({ code: 'SESSION_EXPIRED', details: { reason: 'idle' } });
  });

  it('refresh mantiene viva la sesión: con refresh cada 10 min no vence por inactividad', async () => {
    const user = await createUser('viva');
    const agent = t.agent();
    await login(agent, user.email);
    for (let i = 0; i < 4; i += 1) {
      t.clock.advanceMinutes(10);
      expect((await agent.post(`${API}/refresh`)).status).toBe(200);
    }
    expect((await agent.get(`${API}/session`)).status).toBe(200);
  });

  it('pasadas 12 h, ni el refresh la mantiene: SESSION_EXPIRED con reason=absolute', async () => {
    const user = await createUser('absoluta');
    const agent = t.agent();
    await login(agent, user.email);
    for (let i = 0; i < 73; i += 1) {
      t.clock.advanceMinutes(10);
      const res = await agent.post(`${API}/refresh`);
      if (res.status !== 200) {
        expect(res.body.error).toMatchObject({
          code: 'SESSION_EXPIRED',
          details: { reason: 'absolute' },
        });
        return;
      }
    }
    throw new Error('la sesión debió vencer a las 12 h');
  });
});

describe('US2 · cierre de sesión (FR-017)', () => {
  it('logout invalida la sesión al instante y borra las cookies', async () => {
    const user = await createUser('salir');
    const agent = t.agent();
    await login(agent, user.email);
    const access = agent.cookies.get('nova_at') ?? '';
    const res = await agent.post(`${API}/logout`);
    expect(res.status).toBe(204);
    expect(agent.cookies.has('nova_at')).toBe(false);
    expect(agent.cookies.has('nova_rt')).toBe(false);
    // El JWT anterior, aunque no haya vencido, ya no sirve.
    const replay = t.agent();
    replay.cookies.set('nova_at', access);
    const session = await replay.get(`${API}/session`);
    expect(session.body.error).toMatchObject({
      code: 'SESSION_EXPIRED',
      details: { reason: 'revoked' },
    });
  });

  it('logout es idempotente y funciona sin cookies', async () => {
    expect((await t.agent().post(`${API}/logout`)).status).toBe(204);
    const user = await createUser('doble');
    const agent = t.agent();
    await login(agent, user.email);
    expect((await agent.post(`${API}/logout`)).status).toBe(204);
    expect((await agent.post(`${API}/logout`)).status).toBe(204);
  });
});

describe('US2 · auditoría (FR-021)', () => {
  it('registra éxitos, fallos, bloqueos y cierres', async () => {
    const user = await createUser('audita');
    const agent = deviceAgent();
    await failTimes(agent, user.email, 5);
    t.clock.advanceMinutes(16);
    await login(agent, user.email);
    await agent.post(`${API}/logout`);
    const types = (await t.prisma.auditEvent.findMany({ where: { userId: user.id } })).map(
      (e) => e.type,
    );
    expect(types.filter((x) => x === 'LOGIN_FAILED')).toHaveLength(5);
    expect(types).toContain('LOGIN_LOCKED');
    expect(types).toContain('LOGIN_SUCCEEDED');
    expect(types).toContain('SESSION_ENDED');
  });
});
