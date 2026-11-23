import type { APIRequestContext } from '@playwright/test';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export interface MailpitMessageSummary {
  ID: string;
  Subject?: string;
}

export interface MailpitMessageDetail {
  ID: string;
  Subject: string;
  Text: string;
  HTML: string;
}

interface MailpitSearchResponse {
  messages?: MailpitMessageSummary[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Lista los mensajes actuales en Mailpit para un destinatario concreto. */
export async function listMessagesFor(
  request: APIRequestContext,
  email: string,
): Promise<MailpitMessageSummary[]> {
  const url = `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`;
  const res = await request.get(url);
  if (!res.ok()) return [];
  const data = (await res.json()) as MailpitSearchResponse;
  return data.messages ?? [];
}

/** Descarga el cuerpo completo de un mensaje en Mailpit por su ID. */
export async function getMessageDetail(
  request: APIRequestContext,
  id: string,
): Promise<MailpitMessageDetail | null> {
  const res = await request.get(`${MAILPIT_URL}/api/v1/message/${id}`);
  if (!res.ok()) return null;
  const raw = (await res.json()) as Partial<MailpitMessageDetail>;
  return {
    ID: raw.ID ?? id,
    Subject: raw.Subject ?? '',
    Text: raw.Text ?? '',
    HTML: raw.HTML ?? '',
  };
}

/** Espera hasta que llegue un mensaje nuevo (no incluido en `excludeIds`) para `email`. */
export async function waitForNewMessage(
  request: APIRequestContext,
  email: string,
  options: { excludeIds?: ReadonlySet<string>; timeoutMs?: number } = {},
): Promise<MailpitMessageDetail> {
  const exclude = options.excludeIds ?? new Set<string>();
  const timeoutMs = options.timeoutMs ?? 15_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const messages = await listMessagesFor(request, email);
    const fresh = messages.find((msg) => !exclude.has(msg.ID));
    if (fresh) {
      const detail = await getMessageDetail(request, fresh.ID);
      if (detail) return detail;
    }
    await delay(250);
  }

  throw new Error(`No llegó un correo nuevo en Mailpit para ${email} en ${timeoutMs} ms`);
}

/** Extrae el primer código numérico de 6 dígitos del cuerpo del mensaje. */
export function extractSixDigitCode(detail: MailpitMessageDetail): string | null {
  const combined = `${detail.Text} ${detail.HTML}`;
  const match = /\b(\d{6})\b/.exec(combined);
  return match?.[1] ?? null;
}

/** Espera un correo nuevo en Mailpit para `email` que contenga un código de 6 dígitos. */
export async function waitForNewCode(
  request: APIRequestContext,
  email: string,
  options: { excludeIds?: ReadonlySet<string>; timeoutMs?: number } = {},
): Promise<{ id: string; code: string }> {
  const exclude = new Set(options.excludeIds ?? []);
  const timeoutMs = options.timeoutMs ?? 15_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const messages = await listMessagesFor(request, email);
    for (const summary of messages) {
      if (exclude.has(summary.ID)) continue;
      const detail = await getMessageDetail(request, summary.ID);
      if (!detail) continue;
      const code = extractSixDigitCode(detail);
      if (code) return { id: detail.ID, code };
    }
    await delay(250);
  }

  throw new Error(`No llegó código de 6 dígitos en Mailpit para ${email} en ${timeoutMs} ms`);
}
