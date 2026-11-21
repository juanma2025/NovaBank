/** US4 — Pedir un código nuevo cuando no llega o vence (spec.md; tasks.md T075). */
import { PRIVACY_POLICY_VERSION } from '@nova/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { RETRY_DELAYS_SECONDS } from '../../src/lib/mail/outbox-worker.js';
import type { TestAgent } from '../helpers/agent.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase, uniqueEmail } from '../helpers/test-db.js';

const API = '/api/v1/auth';

let t: TestApp;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
});
afterAll(async () => {
  await t.close();
});
beforeEach(() => {
  t.mail.clear();
  t.mail.failNext = 0;
});

const register = (agent: TestAgent, email: string) =>
  agent.post(`${API}/register`, { email, acceptedPolicyVersion: PRIVACY_POLICY_VERSION });
const resend = (agent: TestAgent) => agent.post(`${API}/resend-verification`);
const verify = (agent: TestAgent, code: string) => agent.post(`${API}/verify-email`, { code });
const wrongCode = (code: string) => (code === '000000' ? '111111' : '000000');

async function startWithCode(agent: TestAgent, email: string): Promise<string> {
  expect((await register(agent, email)).status).toBe(202);
  await t.deliverEmails();
  return t.mail.lastCodeFor(email);
}

describe('US4 · escenarios de aceptación', () => {
  it('1. tras la espera, llega un código nuevo y el anterior deja de servir', async () => {
    const email = uniqueEmail();
    const agent = t.agent();
    const first = await startWithCode(agent, email);
    t.clock.advanceSeconds(61);
    const res = await resend(agent);
    expect(res.status).toBe(202);
    expect(res.body.step).toBe('code');
    await t.deliverEmails();
    const second = t.mail.lastCodeFor(email);
    expect(t.mail.to(email)).toHaveLength(2);
    if (second !== first) {
      expect((await verify(agent, first)).body.error.code).toBe('CODE_INVALID');
    }
    expect((await verify(agent, second)).status).toBe(200);
  });

  it('2. antes de 60 s: 429 RESEND_TOO_SOON con los segundos que faltan', async () => {
    const agent = t.agent();
    const started = await register(agent, uniqueEmail());
    expect(new Date(started.body.resendAvailableAt as string).getTime()).toBe(
      t.clock.now().getTime() + 60_000,
    );
    t.clock.advanceSeconds(20);
    const res = await resend(agent);
    expect(res.status).toBe(429);
    expect(res.body.error).toMatchObject({
      code: 'RESEND_TOO_SOON',
      details: { retryAfterSeconds: 40 },
    });
    expect(res.headers['retry-after']).toBe('40');
  });

  it('3. con el código vencido, se puede pedir uno nuevo y funciona', async () => {
    const email = uniqueEmail('vencido');
    const agent = t.agent();
    const old = await startWithCode(agent, email);
    t.clock.advanceMinutes(16);
    expect((await verify(agent, old)).body.error.code).toBe('CODE_EXPIRED');
    expect((await resend(agent)).status).toBe(202);
    await t.deliverEmails();
    expect((await verify(agent, t.mail.lastCodeFor(email))).status).toBe(200);
  });

  it('4. con los intentos agotados, el código nuevo reinicia los intentos', async () => {
    const email = uniqueEmail('agotado');
    const agent = t.agent();
    const code = await startWithCode(agent, email);
    for (let i = 0; i < 5; i += 1) await verify(agent, wrongCode(code));
    expect((await verify(agent, code)).body.error.code).toBe('CODE_ATTEMPTS_EXHAUSTED');
    t.clock.advanceSeconds(61);
    const res = await resend(agent);
    expect(res.body.attemptsLeft).toBe(5);
    await t.deliverEmails();
    expect((await verify(agent, t.mail.lastCodeFor(email))).status).toBe(200);
  });
});

describe('US4 · límites y casos límite', () => {
  it('el sexto código en una hora da CODE_SEND_LIMIT, contando el inicio (FR-005)', async () => {
    const agent = t.agent();
    await register(agent, uniqueEmail('limite'));
    for (let i = 0; i < 4; i += 1) {
      t.clock.advanceSeconds(61);
      expect((await resend(agent)).status).toBe(202);
    }
    t.clock.advanceSeconds(61);
    const res = await resend(agent);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('CODE_SEND_LIMIT');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('si el envío anterior sigue reintentando, se descarta y solo llega el código nuevo', async () => {
    const email = uniqueEmail('pendiente');
    const agent = t.agent();
    // Vacía la bandeja: el fallo simulado debe tocarle al correo de esta prueba.
    while ((await t.deliverEmails()) > 0);
    t.mail.clear();
    await register(agent, email);
    t.mail.failNext = 1;
    await t.deliverEmails(); // falla: queda pendiente para reintentar
    t.clock.advanceSeconds(61);
    await resend(agent);
    t.clock.advanceSeconds(RETRY_DELAYS_SECONDS[0]);
    await t.deliverEmails();
    await t.deliverEmails();
    expect(t.mail.to(email)).toHaveLength(1);
    expect((await verify(agent, t.mail.lastCodeFor(email))).status).toBe(200);
  });

  it('un flujo señuelo de registro responde igual y reenvía el aviso «ya tienes cuenta»', async () => {
    const email = uniqueEmail('senuelo');
    await t.prisma.user.create({
      data: { email, fullName: 'Ana', passwordHash: 'x', passwordChangedAt: t.clock.now() },
    });
    const agent = t.agent();
    await register(agent, email);
    t.clock.advanceSeconds(61);
    const res = await resend(agent);
    expect(res.status).toBe(202);
    await t.deliverEmails();
    const sent = t.mail.to(email);
    expect(sent).toHaveLength(2);
    for (const message of sent) expect(message.subject).toContain('Ya tienes una cuenta');
  });

  it('un flujo señuelo de recuperación responde igual, no envía nada y cuenta para el límite', async () => {
    const email = uniqueEmail('sincuenta');
    const agent = t.agent();
    await agent.post(`${API}/password-reset`, { email });
    for (let i = 0; i < 4; i += 1) {
      t.clock.advanceSeconds(61);
      expect((await resend(agent)).status).toBe(202);
    }
    t.clock.advanceSeconds(61);
    expect((await resend(agent)).body.error.code).toBe('CODE_SEND_LIMIT');
    await t.deliverEmails();
    expect(t.mail.to(email)).toHaveLength(0);
  });

  it('con el código ya verificado: 409 VERIFICATION_STEP_INVALID', async () => {
    const agent = t.agent();
    const code = await startWithCode(agent, uniqueEmail('verificado'));
    await verify(agent, code);
    t.clock.advanceSeconds(61);
    const res = await resend(agent);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VERIFICATION_STEP_INVALID');
  });

  it('sin flujo en este navegador: 404 VERIFICATION_NOT_FOUND', async () => {
    const res = await resend(t.agent());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('VERIFICATION_NOT_FOUND');
  });
});
