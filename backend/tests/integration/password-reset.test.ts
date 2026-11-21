/** US3 — Recuperar la contraseña olvidada (spec.md; tasks.md T069). */
import { PRIVACY_POLICY_VERSION } from '@nova/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { hashPassword } from '../../src/modules/auth/password-policy.js';
import type { TestAgent } from '../helpers/agent.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase, uniqueEmail } from '../helpers/test-db.js';

const API = '/api/v1/auth';
const OLD_PASSWORD = 'Arepa con queso 2026!';
const NEW_PASSWORD = 'Empanada de pipián 2027';

let t: TestApp;
let oldHash: string;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
  oldHash = await hashPassword(OLD_PASSWORD);
});
afterAll(async () => {
  await t.close();
});
beforeEach(() => {
  t.mail.clear();
});

async function createUser(prefix = 'ana') {
  return t.prisma.user.create({
    data: {
      email: uniqueEmail(prefix),
      fullName: 'Ana Pérez',
      passwordHash: oldHash,
      passwordChangedAt: t.clock.now(),
    },
  });
}

const startReset = (agent: TestAgent, email: string) =>
  agent.post(`${API}/password-reset`, { email });

/** Recuperación hasta el paso 3: devuelve el agente con el código ya verificado. */
async function verifiedReset(email: string): Promise<TestAgent> {
  const agent = t.agent();
  expect((await startReset(agent, email)).status).toBe(202);
  await t.deliverEmails();
  const code = t.mail.lastCodeFor(email);
  expect((await agent.post(`${API}/verify-email`, { code })).status).toBe(200);
  return agent;
}

const login = (agent: TestAgent, email: string, password: string) =>
  agent.post(`${API}/login`, { email, password });

describe('US3 · escenarios de aceptación', () => {
  it('1. responde igual exista o no la cuenta, y solo envía código si existe (FR-020a)', async () => {
    const user = await createUser();
    const missing = uniqueEmail('nadie');
    const existing = await startReset(t.agent(), user.email);
    const ghost = await startReset(t.agent(), missing);
    for (const res of [existing, ghost]) {
      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({ purpose: 'password_reset', step: 'code', attemptsLeft: 5 });
    }
    expect(Object.keys(existing.body).sort()).toEqual(Object.keys(ghost.body).sort());
    await t.deliverEmails();
    expect(t.mail.to(user.email)).toHaveLength(1);
    expect(t.mail.to(user.email)[0]?.subject).toMatch(/código de Nova/);
    expect(t.mail.to(missing)).toHaveLength(0);
  });

  it('2. código correcto: pasa al paso de contraseña nueva', async () => {
    const user = await createUser();
    const agent = t.agent();
    await startReset(agent, user.email);
    await t.deliverEmails();
    const res = await agent.post(`${API}/verify-email`, { code: t.mail.lastCodeFor(user.email) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ purpose: 'password_reset', step: 'complete' });
  });

  it('3 y 4. cambia la contraseña, cierra todas las sesiones, avisa por correo y la anterior deja de servir', async () => {
    const user = await createUser('cambio');
    const browserA = t.agent();
    expect((await login(browserA, user.email, OLD_PASSWORD)).status).toBe(200);

    const browserB = await verifiedReset(user.email);
    t.mail.clear();
    const res = await browserB.post(`${API}/password-reset/complete`, { password: NEW_PASSWORD });
    expect(res.status).toBe(204);
    expect(browserB.cookies.has('nova_vf')).toBe(false);
    expect(browserB.cookies.has('nova_at')).toBe(false); // no inicia sesión

    await t.deliverEmails();
    expect(t.mail.to(user.email)[0]?.subject).toContain('Tu contraseña de Nova cambió');

    const session = await browserA.get(`${API}/session`);
    expect(session.body.error).toMatchObject({
      code: 'SESSION_EXPIRED',
      details: { reason: 'revoked' },
    });
    expect((await browserA.post(`${API}/refresh`)).status).toBe(401);

    expect((await login(t.agent(), user.email, OLD_PASSWORD)).body.error.code).toBe(
      'INVALID_CREDENTIALS',
    );
    expect((await login(t.agent(), user.email, NEW_PASSWORD)).status).toBe(200);
  });

  it('5. levanta el bloqueo por intentos fallidos (FR-020c)', async () => {
    const user = await createUser('desbloqueo');
    const blocked = t.agent();
    blocked.cookies.set('nova_dev', `dispositivo-bloqueado-${'q'.repeat(24)}`);
    for (let i = 0; i < 5; i += 1) await login(blocked, user.email, 'contraseña equivocada');
    expect((await login(blocked, user.email, OLD_PASSWORD)).body.error.code).toBe('LOGIN_LOCKED');

    const agent = await verifiedReset(user.email);
    await agent.post(`${API}/password-reset/complete`, { password: NEW_PASSWORD });
    expect((await login(blocked, user.email, NEW_PASSWORD)).status).toBe(200);
  });
});

describe('US3 · reglas y casos límite', () => {
  it('la contraseña nueva cumple FR-010', async () => {
    const user = await createUser('reglas');
    const agent = await verifiedReset(user.email);
    const common = await agent.post(`${API}/password-reset/complete`, { password: 'qwertyuiop' });
    expect(common.body.error).toMatchObject({
      code: 'PASSWORD_WEAK',
      details: { reasons: ['common'] },
    });
    const local = user.email.split('@')[0] ?? '';
    const withEmail = await agent.post(`${API}/password-reset/complete`, {
      password: `${local}-nueva`,
    });
    expect(withEmail.body.error.details.reasons).toContain('contains_email');
    const short = await agent.post(`${API}/password-reset/complete`, { password: 'corta' });
    expect(short.status).toBe(400);
  });

  it('completar antes de verificar: 409; después de 30 min: VERIFICATION_EXPIRED (FR-020b)', async () => {
    const user = await createUser('tiempos');
    const early = t.agent();
    await startReset(early, user.email);
    const before = await early.post(`${API}/password-reset/complete`, { password: NEW_PASSWORD });
    expect(before.status).toBe(409);
    expect(before.body.error.code).toBe('VERIFICATION_STEP_INVALID');

    const late = await verifiedReset(user.email);
    t.clock.advanceMinutes(31);
    const after = await late.post(`${API}/password-reset/complete`, { password: NEW_PASSWORD });
    expect(after.body.error.code).toBe('VERIFICATION_EXPIRED');
  });

  it('un flujo de registro no sirve para completar una recuperación', async () => {
    const agent = t.agent();
    await agent.post(`${API}/register`, {
      email: uniqueEmail('registro'),
      acceptedPolicyVersion: PRIVACY_POLICY_VERSION,
    });
    const res = await agent.post(`${API}/password-reset/complete`, { password: NEW_PASSWORD });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VERIFICATION_NOT_FOUND');
  });

  it('un segundo inicio de recuperación invalida el flujo anterior', async () => {
    const user = await createUser('segundo');
    const first = t.agent();
    const second = t.agent();
    await startReset(first, user.email);
    await startReset(second, user.email);
    expect((await first.get(`${API}/verification`)).status).toBe(404);
    expect((await second.get(`${API}/verification`)).status).toBe(200);
    await t.deliverEmails();
    expect(t.mail.to(user.email)).toHaveLength(1);
  });

  it('el límite de 5 códigos por hora suma registro y recuperación (FR-005)', async () => {
    const user = await createUser('suma');
    for (let i = 0; i < 3; i += 1) {
      const res = await t.agent().post(`${API}/register`, {
        email: user.email,
        acceptedPolicyVersion: PRIVACY_POLICY_VERSION,
      });
      expect(res.status).toBe(202);
    }
    for (let i = 0; i < 2; i += 1)
      expect((await startReset(t.agent(), user.email)).status).toBe(202);
    const sixth = await startReset(t.agent(), user.email);
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe('CODE_SEND_LIMIT');
  });

  it('el límite también aplica a correos sin cuenta (no revela cuáles existen)', async () => {
    const ghost = uniqueEmail('fantasma');
    for (let i = 0; i < 5; i += 1) expect((await startReset(t.agent(), ghost)).status).toBe(202);
    expect((await startReset(t.agent(), ghost)).status).toBe(429);
  });
});

describe('US3 · auditoría (FR-021)', () => {
  it('registra la solicitud, la verificación, el cambio y los cierres de sesión', async () => {
    const user = await createUser('audita');
    await login(t.agent(), user.email, OLD_PASSWORD);
    const agent = await verifiedReset(user.email);
    await agent.post(`${API}/password-reset/complete`, { password: NEW_PASSWORD });

    const events = await t.prisma.auditEvent.findMany({ where: { userId: user.id } });
    const types = events.map((e) => e.type);
    expect(types).toContain('PASSWORD_RESET_REQUESTED');
    expect(types).toContain('PASSWORD_RESET_COMPLETED');
    const ended = events.find(
      (e) =>
        e.type === 'SESSION_ENDED' &&
        (e.metadata as { reason?: string } | null)?.reason === 'password_reset',
    );
    expect(ended).toBeDefined();
    for (const event of events) expect(JSON.stringify(event.metadata)).not.toContain(NEW_PASSWORD);
  });
});
