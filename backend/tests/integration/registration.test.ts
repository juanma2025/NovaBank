/** US1 — Registro con correo institucional verificado (spec.md; tasks.md T047). */
import { PRIVACY_POLICY_VERSION } from '@nova/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { TestAgent } from '../helpers/agent.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase, uniqueEmail } from '../helpers/test-db.js';

const API = '/api/v1/auth';
const PASSWORD = 'Arepa con queso 2026!';

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
});

async function start(agent: TestAgent, email: string, policy = PRIVACY_POLICY_VERSION) {
  return agent.post(`${API}/register`, { email, acceptedPolicyVersion: policy });
}

/** Paso 1 + entrega del correo: devuelve el código recibido. */
async function startAndGetCode(agent: TestAgent, email: string): Promise<string> {
  expect((await start(agent, email)).status).toBe(202);
  await t.deliverEmails();
  // El correo se envía a la dirección normalizada.
  return t.mail.lastCodeFor(email.trim().toLowerCase());
}

async function verified(email: string): Promise<TestAgent> {
  const agent = t.agent();
  const code = await startAndGetCode(agent, email);
  expect((await agent.post(`${API}/verify-email`, { code })).status).toBe(200);
  return agent;
}

describe('US1 · escenarios de aceptación', () => {
  it('1. paso 1 con dominio permitido: 202, cookie del flujo y código por correo', async () => {
    const agent = t.agent();
    const email = uniqueEmail('ana');
    const res = await start(agent, email);
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      purpose: 'registration',
      step: 'code',
      attemptsLeft: 5,
      completeBy: null,
    });
    expect(res.body.maskedEmail).toMatch(/^an\*\*\*@nova-test\.edu\.co$/);
    const cookie = agent.lastSetCookie('nova_vf') ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    await t.deliverEmails();
    expect(t.mail.lastCodeFor(email)).toMatch(/^\d{6}$/);
  });

  it('2. código correcto: pasa al paso de nombre y contraseña', async () => {
    const agent = t.agent();
    const code = await startAndGetCode(agent, uniqueEmail());
    const res = await agent.post(`${API}/verify-email`, { code });
    expect(res.status).toBe(200);
    expect(res.body.step).toBe('complete');
    expect(res.body.completeBy).not.toBeNull();
  });

  it('3. nombre y contraseña válidos: crea la cuenta, inicia sesión y borra la cookie del flujo', async () => {
    const email = uniqueEmail('maria');
    const agent = await verified(email);
    const res = await agent.post(`${API}/register/complete`, {
      fullName: 'María-José Peña',
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, fullName: 'María-José Peña' });
    expect(res.body.session.idleTimeoutSeconds).toBe(900);
    expect(agent.cookies.has('nova_at')).toBe(true);
    expect(agent.cookies.has('nova_rt')).toBe(true);
    expect(agent.cookies.has('nova_vf')).toBe(false);
    expect(agent.lastSetCookie('nova_rt')).toMatch(/Path=\/api\/v1\/auth/);
    const session = await agent.get(`${API}/session`);
    expect(session.status).toBe(200);
    expect(session.body.user.fullName).toBe('María-José Peña');
  });

  it('4. dominio no permitido: 422 DOMAIN_NOT_ALLOWED y ningún correo', async () => {
    const res = await start(t.agent(), 'ana@gmail.com');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DOMAIN_NOT_ALLOWED');
    await t.deliverEmails();
    expect(t.mail.messages).toHaveLength(0);
  });

  it('5. sin aceptar la política: 400; con una versión vieja: 422 POLICY_VERSION_OUTDATED', async () => {
    const email = uniqueEmail();
    const missing = await t.agent().post(`${API}/register`, { email });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
    const outdated = await start(t.agent(), email, '2020-01-01');
    expect(outdated.status).toBe(422);
    expect(outdated.body.error.code).toBe('POLICY_VERSION_OUTDATED');
  });

  it('6. código incorrecto: 422 CODE_INVALID con los intentos restantes', async () => {
    const agent = t.agent();
    const code = await startAndGetCode(agent, uniqueEmail());
    const wrong = code === '000000' ? '111111' : '000000';
    const res = await agent.post(`${API}/verify-email`, { code: wrong });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'CODE_INVALID', details: { attemptsLeft: 4 } });
  });

  it('7. contraseña que no cumple las reglas: 422 PASSWORD_WEAK con la regla', async () => {
    const email = uniqueEmail('pedro');
    const agent = await verified(email);
    const common = await agent.post(`${API}/register/complete`, {
      fullName: 'Pedro Gómez',
      password: 'qwertyuiop',
    });
    expect(common.status).toBe(422);
    expect(common.body.error).toMatchObject({
      code: 'PASSWORD_WEAK',
      details: { reasons: ['common'] },
    });
    const local = email.split('@')[0] ?? '';
    const withEmail = await agent.post(`${API}/register/complete`, {
      fullName: 'Pedro Gómez',
      password: `${local}-2026`,
    });
    expect(withEmail.body.error.details.reasons).toContain('contains_email');
    const short = await agent.post(`${API}/register/complete`, {
      fullName: 'Pedro Gómez',
      password: 'corta',
    });
    expect(short.status).toBe(400);
  });
});

describe('US1 · casos límite', () => {
  it('normaliza mayúsculas y espacios del correo', async () => {
    const email = uniqueEmail('normal');
    const agent = await verified(`  ${email.toUpperCase()} `);
    await agent.post(`${API}/register/complete`, { fullName: 'Ana Pérez', password: PASSWORD });
    expect(await t.prisma.user.findUnique({ where: { email } })).not.toBeNull();
  });

  it('un subdominio no listado se rechaza', async () => {
    const res = await start(t.agent(), 'ana@campus.nova-test.edu.co');
    expect(res.body.error.code).toBe('DOMAIN_NOT_ALLOWED');
  });

  it('correo ya registrado: misma respuesta, aviso por correo y ningún código válido (FR-008)', async () => {
    const email = uniqueEmail('repetido');
    const first = await verified(email);
    await first.post(`${API}/register/complete`, { fullName: 'Ana Pérez', password: PASSWORD });
    t.mail.clear();

    const agent = t.agent();
    const res = await start(agent, email);
    expect(res.status).toBe(202);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'attemptsLeft',
        'codeExpiresAt',
        'completeBy',
        'maskedEmail',
        'purpose',
        'resendAvailableAt',
        'step',
      ].sort(),
    );
    await t.deliverEmails();
    const sent = t.mail.to(email);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toContain('Ya tienes una cuenta');
    expect(sent[0]?.text).not.toMatch(/\b\d{6}\b/);
    const verify = await agent.post(`${API}/verify-email`, { code: '123456' });
    expect(verify.body.error.code).toBe('CODE_INVALID');
  });

  it('GET /verification retoma el paso tras recargar (FR-009a) y otro navegador no tiene flujo', async () => {
    const agent = t.agent();
    const code = await startAndGetCode(agent, uniqueEmail());
    expect((await agent.get(`${API}/verification`)).body.step).toBe('code');
    await agent.post(`${API}/verify-email`, { code });
    expect((await agent.get(`${API}/verification`)).body.step).toBe('complete');
    const other = await t.agent().get(`${API}/verification`);
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe('VERIFICATION_NOT_FOUND');
  });

  it('un flujo nuevo del mismo correo reemplaza al anterior y solo llega el último código', async () => {
    const email = uniqueEmail('dos');
    const a = t.agent();
    const b = t.agent();
    await start(a, email);
    await start(b, email);
    await t.deliverEmails();
    expect(t.mail.to(email)).toHaveLength(1);
    expect((await a.get(`${API}/verification`)).status).toBe(404);
    const code = t.mail.lastCodeFor(email);
    expect((await b.post(`${API}/verify-email`, { code })).status).toBe(200);
  });

  it('dos completes simultáneos crean una sola cuenta (FR-009)', async () => {
    const email = uniqueEmail('carrera');
    const agent = await verified(email);
    const body = { fullName: 'Ana Pérez', password: PASSWORD };
    const results = await Promise.all([
      agent.post(`${API}/register/complete`, body),
      agent.post(`${API}/register/complete`, body),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 404]);
    expect(await t.prisma.user.count({ where: { email } })).toBe(1);
  });

  it('si la cuenta se creó por otra vía antes de completar: 409 EMAIL_ALREADY_REGISTERED', async () => {
    const email = uniqueEmail('otra');
    const agent = await verified(email);
    await t.prisma.user.create({
      data: { email, fullName: 'Otra', passwordHash: 'x', passwordChangedAt: t.clock.now() },
    });
    const res = await agent.post(`${API}/register/complete`, {
      fullName: 'Ana',
      password: PASSWORD,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('completar antes de verificar: 409 VERIFICATION_STEP_INVALID', async () => {
    const agent = t.agent();
    await start(agent, uniqueEmail());
    const res = await agent.post(`${API}/register/complete`, {
      fullName: 'Ana',
      password: PASSWORD,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VERIFICATION_STEP_INVALID');
  });

  it('completar después de 30 min: 422 VERIFICATION_EXPIRED (FR-007)', async () => {
    const agent = await verified(uniqueEmail());
    t.clock.advanceMinutes(31);
    const res = await agent.post(`${API}/register/complete`, {
      fullName: 'Ana',
      password: PASSWORD,
    });
    expect(res.body.error.code).toBe('VERIFICATION_EXPIRED');
  });

  it('código vencido: CODE_EXPIRED, pero el flujo sigue disponible para pedir otro', async () => {
    const agent = t.agent();
    const code = await startAndGetCode(agent, uniqueEmail());
    t.clock.advanceMinutes(16);
    const res = await agent.post(`${API}/verify-email`, { code });
    expect(res.body.error.code).toBe('CODE_EXPIRED');
    expect((await agent.get(`${API}/verification`)).status).toBe(200);
  });

  it('5 intentos fallidos agotan el código (FR-004)', async () => {
    const agent = t.agent();
    const code = await startAndGetCode(agent, uniqueEmail());
    const wrong = code === '000000' ? '111111' : '000000';
    for (let left = 4; left >= 0; left -= 1) {
      const res = await agent.post(`${API}/verify-email`, { code: wrong });
      expect(res.body.error.details.attemptsLeft).toBe(left);
    }
    const res = await agent.post(`${API}/verify-email`, { code });
    expect(res.body.error.code).toBe('CODE_ATTEMPTS_EXHAUSTED');
  });

  it('más de 5 códigos por hora: 429 CODE_SEND_LIMIT con Retry-After (FR-005)', async () => {
    const email = uniqueEmail('limite');
    for (let i = 0; i < 5; i += 1) expect((await start(t.agent(), email)).status).toBe(202);
    const res = await start(t.agent(), email);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('CODE_SEND_LIMIT');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});

describe('US1 · datos guardados', () => {
  it('consentimiento, auditoría y código solo como hash', async () => {
    const email = uniqueEmail('datos');
    const agent = t.agent();
    const code = await startAndGetCode(agent, email);
    const flow = await t.prisma.verificationFlow.findFirstOrThrow({ where: { email } });
    expect(flow.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(flow.codeHash).not.toContain(code);
    const outbox = await t.prisma.emailOutbox.findMany({ where: { toEmail: email } });
    for (const row of outbox) expect(JSON.stringify(row.payload)).not.toContain(code);

    await agent.post(`${API}/verify-email`, { code });
    const res = await agent.post(`${API}/register/complete`, {
      fullName: 'Ana',
      password: PASSWORD,
    });
    const userId = res.body.user.id as string;

    const user = await t.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { consent: true },
    });
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(user.consent?.policyVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(user.consent?.acceptedAt).toBeInstanceOf(Date);

    const types = (await t.prisma.auditEvent.findMany({ orderBy: { createdAt: 'asc' } })).map(
      (e) => e.type,
    );
    expect(types).toEqual(
      expect.arrayContaining(['REGISTRATION_STARTED', 'EMAIL_VERIFIED', 'ACCOUNT_CREATED']),
    );
    const created = await t.prisma.auditEvent.findFirstOrThrow({
      where: { type: 'ACCOUNT_CREATED', userId },
    });
    expect(JSON.stringify(created.metadata)).not.toContain(PASSWORD);
  });
});
