import { randomUUID } from 'node:crypto';

import { IDEMPOTENCY_HEADER, PRIVACY_POLICY_VERSION } from '@nova/shared';
import { type APIRequestContext, expect, type Page } from '@playwright/test';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const DEFAULT_PASSWORD = 'ClaveSegura#2026';

interface MailpitSearchResponse {
  messages?: { ID: string }[];
}

interface MailpitMessageResponse {
  Text?: string;
  HTML?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Genera un correo institucional único permitido por `STUDENT_EMAIL_DOMAINS` en E2E. */
export function uniqueStudentEmail(prefix: string): string {
  const token = randomUUID().slice(0, 8);
  return `${prefix}-${token}@nova-test.edu.co`;
}

/** Espera en Mailpit el correo de verificación enviado al estudiante y extrae el código de 6 dígitos. */
export async function waitForVerificationCode(
  request: APIRequestContext,
  email: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const searchUrl = `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`;
    const listRes = await request.get(searchUrl);
    if (listRes.ok()) {
      const payload = (await listRes.json()) as MailpitSearchResponse;
      const latestId = payload.messages?.[0]?.ID;
      if (latestId) {
        const msgRes = await request.get(`${MAILPIT_URL}/api/v1/message/${latestId}`);
        if (msgRes.ok()) {
          const msg = (await msgRes.json()) as MailpitMessageResponse;
          const body = `${msg.Text ?? ''} ${msg.HTML ?? ''}`;
          const match = /\b(\d{6})\b/.exec(body);
          if (match?.[1]) return match[1];
        }
      }
    }
    await delay(250);
  }

  throw new Error(`No llegó código de verificación a Mailpit para ${email} en ${timeoutMs} ms`);
}

export interface StudentCredentials {
  email: string;
  fullName: string;
  password?: string;
}

/** Registra un estudiante verificado vía API real + Mailpit dejando sus cookies HttpOnly en `page`. */
export async function registerVerifiedStudent(
  page: Page,
  { email, fullName, password = DEFAULT_PASSWORD }: StudentCredentials,
): Promise<void> {
  const startRes = await page.request.post('/api/v1/auth/register', {
    data: { email, acceptedPolicyVersion: PRIVACY_POLICY_VERSION },
  });
  expect(startRes.status(), `POST /auth/register falló para ${email}`).toBe(202);

  const code = await waitForVerificationCode(page.request, email);

  const verifyRes = await page.request.post('/api/v1/auth/verify-email', {
    data: { code },
  });
  expect(verifyRes.status(), `POST /auth/verify-email falló para ${email}`).toBe(200);

  const completeRes = await page.request.post('/api/v1/auth/register/complete', {
    data: { fullName, password },
  });
  expect(completeRes.status(), `POST /auth/register/complete falló para ${email}`).toBe(201);
}

/** Intenta iniciar sesión con una cuenta existente; devuelve `true` si la sesión quedó activa. */
export async function tryLoginStudent(
  page: Page,
  email: string,
  password = DEFAULT_PASSWORD,
): Promise<boolean> {
  const res = await page.request.post('/api/v1/auth/login', {
    data: { email, password },
  });
  return res.status() === 200;
}

/** Aplica una recarga simulada directamente por la API con `Idempotency-Key` única. */
export async function seedTopup(page: Page, amount: number): Promise<void> {
  const res = await page.request.post('/api/v1/topups', {
    headers: { [IDEMPOTENCY_HEADER]: randomUUID() },
    data: { amount },
  });
  expect(res.status(), `POST /topups (${amount}) falló con ${res.status()}`).toBe(201);
}

/** Verifica ausencia total de desbordamiento horizontal (crítico para el proyecto `movil-360`). */
export async function assertNoHorizontalOverflow(page: Page, routeLabel: string): Promise<void> {
  const metrics = await page.evaluate<{ scrollWidth: number; innerWidth: number }>(
    '({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })',
  );
  expect(
    metrics.scrollWidth,
    `Desbordamiento horizontal en ${routeLabel} (${metrics.scrollWidth}px > ${metrics.innerWidth}px)`,
  ).toBeLessThanOrEqual(metrics.innerWidth);
}
