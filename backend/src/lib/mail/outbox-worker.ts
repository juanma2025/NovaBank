import type { EmailTemplate } from '@nova/db';

import type { Clock } from '../clock.js';
import { addSeconds } from '../clock.js';
import type { Db, PrismaClient } from '../db.js';
import type { Logger } from '../logger.js';
import type { MailProvider } from './mail-provider.js';
import { outboxRepository, type OutboxRow } from './outbox.repository.js';
import { renderTemplate, type TemplateData } from './templates/index.js';

/**
 * Prepara el contenido de un correo al momento de enviarlo, dentro de la transacción del envío.
 * Devuelve `null` para descartarlo (research R6). Lo registra el módulo dueño de la plantilla.
 */
export type Preparer = (row: OutboxRow, tx: Db) => Promise<TemplateData | null>;

/** Espera antes de cada reintento: 10 s, 30 s, 1 min, 2 min, 5 min; luego `failed`. */
export const RETRY_DELAYS_SECONDS = [10, 30, 60, 120, 300] as const;
const MAX_ATTEMPTS = RETRY_DELAYS_SECONDS.length;
const BATCH_SIZE = 20;

class SendFailure extends Error {
  constructor(readonly original: unknown) {
    super('envío fallido');
  }
}

type Outcome = 'none' | 'sent' | 'discarded';

/** Worker de la bandeja de salida (research R6). Nunca accede a tablas de otros módulos. */
export class OutboxWorker {
  private readonly preparers = new Map<EmailTemplate, Preparer>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly mail: MailProvider,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  registerPreparer(template: EmailTemplate, preparer: Preparer): void {
    this.preparers.set(template, preparer);
  }

  /** Procesa un lote; devuelve cuántas filas atendió. Seguro con varias instancias (SKIP LOCKED). */
  async processBatch(): Promise<number> {
    let handled = 0;
    while (handled < BATCH_SIZE) {
      const outcome = await this.processOne();
      if (outcome === 'none') break;
      handled += 1;
    }
    return handled;
  }

  private async processOne(): Promise<Outcome> {
    let failed: { row: OutboxRow; error: unknown } | null = null;
    let outcome: Outcome;
    try {
      outcome = await this.prisma.$transaction(
        async (tx) => {
          const row = await outboxRepository.claimNext(tx, this.clock.now());
          if (!row) return 'none';
          const preparer = this.preparers.get(row.template);
          const data = preparer ? await preparer(row, tx) : (row.payload as TemplateData);
          if (data === null) {
            await outboxRepository.markDiscarded(tx, row.id);
            return 'discarded';
          }
          try {
            await this.mail.send({ to: row.to_email, ...renderTemplate(row.template, data) });
          } catch (error) {
            failed = { row, error };
            throw new SendFailure(error);
          }
          await outboxRepository.markSent(tx, row.id, this.clock.now());
          return 'sent';
        },
        { timeout: 30_000 },
      );
    } catch (error) {
      if (!(error instanceof SendFailure) || !failed) throw error;
      // La transacción se revirtió (y con ella el código preparado); se registra el intento aparte.
      await this.recordFailure(failed);
      return 'sent';
    }
    return outcome;
  }

  private async recordFailure({ row, error }: { row: OutboxRow; error: unknown }): Promise<void> {
    const attempts = row.attempts + 1;
    const delay = RETRY_DELAYS_SECONDS[row.attempts];
    const next = attempts < MAX_ATTEMPTS && delay ? addSeconds(this.clock.now(), delay) : null;
    const message = error instanceof Error ? error.message : 'error desconocido';
    await outboxRepository.markRetry(this.prisma, row.id, attempts, next, message.slice(0, 500));
    this.logger.warn(
      { outboxId: row.id, template: row.template, attempts, giveUp: next === null },
      'envío de correo fallido',
    );
  }

  start(intervalMs = 2000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.running) return;
      this.running = true;
      this.processBatch()
        .catch((error: unknown) => this.logger.error({ err: error }, 'outbox: error en el lote'))
        .finally(() => {
          this.running = false;
        });
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
