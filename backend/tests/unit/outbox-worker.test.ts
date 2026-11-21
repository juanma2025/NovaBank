import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { OutboxWorker, RETRY_DELAYS_SECONDS } from '../../src/lib/mail/outbox-worker.js';
import { outboxRepository } from '../../src/lib/mail/outbox.repository.js';
import { createLogger } from '../../src/lib/logger.js';
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
beforeEach(() => {
  t.mail.clear();
  t.mail.failNext = 0;
});

const enqueue = (to: string, template: 'already_registered' | 'password_changed') =>
  outboxRepository.enqueue(t.prisma, { template, to, now: t.clock.now() });

describe('OutboxWorker (research R6)', () => {
  it('envía con la plantilla y marca la fila como sent', async () => {
    const to = uniqueEmail();
    await enqueue(to, 'already_registered');
    expect(await t.deliverEmails()).toBe(1);
    expect(t.mail.to(to)).toHaveLength(1);
    expect(t.mail.to(to)[0]?.subject).toContain('Ya tienes una cuenta');
    const row = await t.prisma.emailOutbox.findFirstOrThrow({ where: { toEmail: to } });
    expect(row.status).toBe('sent');
    expect(row.sentAt).not.toBeNull();
  });

  it('un preparador que devuelve null descarta la fila sin enviar', async () => {
    const worker = new OutboxWorker(t.prisma, t.mail, t.clock, createLogger('silent'));
    worker.registerPreparer('password_changed', () => Promise.resolve(null));
    const to = uniqueEmail();
    await enqueue(to, 'password_changed');
    await worker.processBatch();
    expect(t.mail.to(to)).toHaveLength(0);
    const row = await t.prisma.emailOutbox.findFirstOrThrow({ where: { toEmail: to } });
    expect(row.status).toBe('discarded');
  });

  it('un envío fallido revierte lo preparado y reintenta con espera; tras 5 queda failed', async () => {
    const to = uniqueEmail();
    await enqueue(to, 'password_changed');
    t.mail.failNext = 99;
    for (const [index, delay] of RETRY_DELAYS_SECONDS.entries()) {
      await t.deliverEmails();
      const row = await t.prisma.emailOutbox.findFirstOrThrow({ where: { toEmail: to } });
      expect(row.attempts).toBe(index + 1);
      if (index < RETRY_DELAYS_SECONDS.length - 1) {
        expect(row.status).toBe('pending');
        expect(row.nextAttemptAt.getTime() - t.clock.now().getTime()).toBe(delay * 1000);
        expect(row.lastError).toContain('SMTP caído');
      } else {
        expect(row.status).toBe('failed');
      }
      t.clock.advanceSeconds(delay);
    }
    expect(t.mail.to(to)).toHaveLength(0);
  });

  it('no reintenta antes de next_attempt_at', async () => {
    const to = uniqueEmail();
    await enqueue(to, 'password_changed');
    t.mail.failNext = 1;
    await t.deliverEmails();
    await t.deliverEmails();
    expect(t.mail.to(to)).toHaveLength(0);
    t.clock.advanceSeconds(RETRY_DELAYS_SECONDS[0]);
    await t.deliverEmails();
    expect(t.mail.to(to)).toHaveLength(1);
  });

  it('dos workers a la vez no envían duplicados (SKIP LOCKED)', async () => {
    const recipients = Array.from({ length: 6 }, () => uniqueEmail('lote'));
    for (const to of recipients) await enqueue(to, 'already_registered');
    const second = new OutboxWorker(t.prisma, t.mail, t.clock, createLogger('silent'));
    await Promise.all([t.deliverEmails(), second.processBatch()]);
    for (const to of recipients) expect(t.mail.to(to)).toHaveLength(1);
  });

  it('el payload no admite secretos', async () => {
    await expect(
      outboxRepository.enqueue(t.prisma, {
        template: 'password_changed',
        to: uniqueEmail(),
        payload: { code: '123456' },
        now: t.clock.now(),
      }),
    ).rejects.toThrow(/no puede incluir/);
  });

  it('ninguna fila de la bandeja contiene un código de 6 dígitos', async () => {
    const rows = await t.prisma.emailOutbox.findMany();
    for (const row of rows) expect(JSON.stringify(row.payload)).not.toMatch(/\b\d{6}\b/);
  });
});

describe('Maintenance', () => {
  it('cada limpieza registrada borra solo su propia tabla', async () => {
    t.clock.advanceMinutes(8 * 24 * 60);
    await outboxRepository.enqueue(t.prisma, {
      template: 'password_changed',
      to: uniqueEmail(),
      now: t.clock.now(),
    });
    const before = await t.prisma.emailOutbox.count();
    t.maintenance.registerCleanup('email_outbox', (now) =>
      outboxRepository.deleteFinishedBefore(t.prisma, new Date(now.getTime() - 7 * 86_400_000)),
    );
    const results = await t.maintenance.runAll();
    expect(results['email_outbox']).toBeGreaterThan(0);
    const after = await t.prisma.emailOutbox.count();
    // La fila recién encolada (pending) sigue; las terminadas hace más de 7 días se borraron.
    expect(after).toBeLessThan(before);
    expect(await t.prisma.emailOutbox.count({ where: { status: 'pending' } })).toBeGreaterThan(0);
  });
});
