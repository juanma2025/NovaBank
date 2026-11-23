/**
 * SC-005 / FR-022 (tasks.md T081): ninguna contraseña, código de verificación ni valor de cookie
 * aparece en los logs durante registro, login, recuperación y reenvío.
 */
import { Writable } from 'node:stream';

import { PRIVACY_POLICY_VERSION } from '@nova/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLogger } from '../../src/lib/logger.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase, uniqueEmail } from '../helpers/test-db.js';

const API = '/api/v1/auth';
const PASSWORD = 'Arepa con queso 2026!';
const NEW_PASSWORD = 'Empanada de pipián 2027';

const lines: string[] = [];
const sink = new Writable({
  write(chunk: Buffer, _encoding, done) {
    lines.push(chunk.toString('utf8'));
    done();
  },
});

let t: TestApp;
const secrets = new Set<string>([PASSWORD, NEW_PASSWORD]);

beforeAll(async () => {
  await resetDatabase();
  // Nivel trace: se registra todo lo que la aplicación podría llegar a escribir.
  t = createTestApp({}, { logger: createLogger('trace', sink) });
});
afterAll(async () => {
  await t.close();
});

function remember(cookies: Map<string, string>): void {
  for (const value of cookies.values()) secrets.add(value);
}

describe('los logs no contienen secretos (SC-005)', () => {
  it('registro, reenvío, sesión, recuperación y errores', async () => {
    const email = uniqueEmail('logs');
    const agent = t.agent();

    // US1 + US4: registro con un reenvío y un código equivocado.
    await agent.post(`${API}/register`, { email, acceptedPolicyVersion: PRIVACY_POLICY_VERSION });
    remember(agent.cookies);
    t.clock.advanceSeconds(61);
    await agent.post(`${API}/resend-verification`);
    await t.deliverEmails();
    const code = t.mail.lastCodeFor(email);
    secrets.add(code);
    await agent.post(`${API}/verify-email`, { code: code === '000000' ? '111111' : '000000' });
    await agent.post(`${API}/verify-email`, { code });
    await agent.post(`${API}/register/complete`, { fullName: 'Ana Pérez', password: PASSWORD });
    remember(agent.cookies);

    // US2: sesión, refresh, logout y un login fallido.
    await agent.get(`${API}/session`);
    await agent.post(`${API}/refresh`);
    remember(agent.cookies);
    await agent.post(`${API}/logout`);
    await agent.post(`${API}/login`, { email, password: 'equivocada pero larga' });
    await agent.post(`${API}/login`, { email, password: PASSWORD });
    remember(agent.cookies);

    // US3: recuperación completa.
    const reset = t.agent();
    await reset.post(`${API}/password-reset`, { email });
    remember(reset.cookies);
    await t.deliverEmails();
    const resetCode = t.mail.lastCodeFor(email);
    secrets.add(resetCode);
    await reset.post(`${API}/verify-email`, { code: resetCode });
    await reset.post(`${API}/password-reset/complete`, { password: NEW_PASSWORD });

    const output = lines.join('');
    // La prueba solo tiene sentido si hubo logs de las solicitudes.
    expect(output).toContain('/api/v1/auth/register');
    expect(output).toContain('/api/v1/auth/login');
    // Las cabeceras de cookies sí llegaron al logger y se ocultaron (no pasa por omisión).
    expect(output).toContain('[redactado]');

    for (const secret of secrets) {
      expect(output.includes(secret), `un secreto apareció en los logs`).toBe(false);
    }
    expect(output).not.toMatch(/nova_(at|rt|vf|dev)=[^;\s"]{8,}/);
  });
});
