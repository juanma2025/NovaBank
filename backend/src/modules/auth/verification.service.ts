import type { VerificationFlow, VerificationPurpose } from '@nova/db';
import { CODE_MAX_ATTEMPTS, type VerificationState } from '@nova/shared';

import { addSeconds, secondsUntil } from '../../lib/clock.js';
import { hmacSha256Hex, randomCode, safeEqualHex, sha256Hex } from '../../lib/crypto.js';
import type { Db } from '../../lib/db.js';
import { appError, type AppError } from '../../lib/errors.js';
import type { OutboxRow } from '../../lib/mail/outbox.repository.js';
import { outboxRepository } from '../../lib/mail/outbox.repository.js';
import type { TemplateData } from '../../lib/mail/templates/index.js';
import type { AuthContext } from './auth.context.js';
import { codeSendRepository } from './repositories/code-send.repository.js';
import { verificationFlowRepository as flows } from './repositories/verification-flow.repository.js';

export const CODE_TTL_SECONDS = 15 * 60;
export const COMPLETE_TTL_SECONDS = 30 * 60;
/** Margen tras vencer el código para poder pedir uno nuevo (US4, escenario 3). */
export const RESEND_GRACE_SECONDS = 30 * 60;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_SENDS_PER_HOUR = 5;

const ACTIVE_STATUSES = new Set(['awaiting_code', 'verified']);

/** «an***@ucc.edu.co»: no revela el correo completo. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Flujo de verificación por código compartido por registro y recuperación (research R4, R6). */
export function createVerificationService(ctx: AuthContext) {
  const { config, prisma, clock, audit } = ctx;
  const codeHash = (flowId: string, code: string): string =>
    hmacSha256Hex(config.CODE_HMAC_SECRET, `${flowId}:${code}`);

  function isLive(flow: VerificationFlow | null, now: Date): flow is VerificationFlow {
    return !!flow && ACTIVE_STATUSES.has(flow.status) && now < flow.expiresAt;
  }

  function toState(flow: VerificationFlow): VerificationState {
    return {
      purpose: flow.purpose,
      step: flow.status === 'verified' ? 'complete' : 'code',
      maskedEmail: maskEmail(flow.email),
      codeExpiresAt: flow.codeExpiresAt.toISOString(),
      resendAvailableAt: addSeconds(flow.lastCodeSentAt, RESEND_COOLDOWN_SECONDS).toISOString(),
      attemptsLeft: Math.max(0, CODE_MAX_ATTEMPTS - flow.codeAttempts),
      completeBy: flow.completeBy?.toISOString() ?? null,
    };
  }

  /** Lanza CODE_SEND_LIMIT si el correo ya pidió 5 códigos en la última hora (FR-005). */
  async function assertSendLimit(db: Db, email: string): Promise<void> {
    const now = clock.now();
    const sends = await codeSendRepository.lastHour(db, email, now);
    const oldest = sends[0];
    if (sends.length >= MAX_SENDS_PER_HOUR && oldest) {
      throw appError('CODE_SEND_LIMIT', {
        retryAfterSeconds: secondsUntil(now, addSeconds(oldest, 60 * 60)),
      });
    }
  }

  /**
   * Solicita un código: fija la espera, un vencimiento provisional y registra el envío (también
   * en señuelos). Si no es señuelo, descarta los correos pendientes del flujo y encola uno nuevo;
   * el código lo genera el worker al enviar (research R6).
   */
  async function requestCode(
    db: Db,
    flow: VerificationFlow,
    { decoy }: { decoy: boolean },
  ): Promise<VerificationFlow> {
    const now = clock.now();
    const codeExpiresAt = addSeconds(now, CODE_TTL_SECONDS);
    const updated = await flows.update(db, flow.id, {
      lastCodeSentAt: now,
      codeExpiresAt,
      expiresAt: addSeconds(codeExpiresAt, RESEND_GRACE_SECONDS),
      codeHash: null,
      codeAttempts: 0,
    });
    await codeSendRepository.insert(db, flow.email, flow.purpose, now);
    if (!decoy) {
      await outboxRepository.discardPendingCodeEmails(db, flow.id);
      await outboxRepository.enqueue(db, {
        template: flow.purpose === 'registration' ? 'verification_code' : 'password_reset_code',
        to: flow.email,
        flowId: flow.id,
        now,
      });
    }
    return updated;
  }

  /** Preparador del worker: genera el código al enviar y guarda solo su HMAC. */
  async function prepareCodeEmail(row: OutboxRow, tx: Db): Promise<TemplateData | null> {
    if (!row.verification_flow_id) return null;
    const flow = await flows.lockById(tx, row.verification_flow_id);
    const now = clock.now();
    if (!flow || flow.status !== 'awaiting_code' || now >= flow.expiresAt) return null;
    if (row.created_at < flow.lastCodeSentAt) return null;
    const code = randomCode();
    const codeExpiresAt = addSeconds(now, CODE_TTL_SECONDS);
    await flows.update(tx, flow.id, {
      codeHash: codeHash(flow.id, code),
      codeExpiresAt,
      expiresAt: addSeconds(codeExpiresAt, RESEND_GRACE_SECONDS),
    });
    return { code, minutes: CODE_TTL_SECONDS / 60 };
  }

  async function getState(flowToken: string | undefined): Promise<VerificationState> {
    const flow = flowToken ? await flows.findByTokenHash(prisma, sha256Hex(flowToken)) : null;
    if (!isLive(flow, clock.now())) throw appError('VERIFICATION_NOT_FOUND');
    return toState(flow);
  }

  /**
   * Verifica el código (máquina de estados de data-model.md). Los intentos fallidos se confirman
   * antes de lanzar el error, para que cuenten aunque la respuesta sea 422.
   */
  async function verify(
    flowToken: string | undefined,
    code: string,
    requestId: string,
  ): Promise<VerificationState> {
    if (!flowToken) throw appError('VERIFICATION_NOT_FOUND');
    const outcome = await prisma.$transaction(async (tx): Promise<VerificationState | AppError> => {
      const flow = await flows.lockByTokenHash(tx, sha256Hex(flowToken));
      const now = clock.now();
      if (!isLive(flow, now)) return appError('VERIFICATION_NOT_FOUND');
      if (flow.status === 'verified') return appError('VERIFICATION_STEP_INVALID');
      if (flow.codeAttempts >= CODE_MAX_ATTEMPTS) return appError('CODE_ATTEMPTS_EXHAUSTED');
      if (now >= flow.codeExpiresAt) return appError('CODE_EXPIRED');
      if (!flow.codeHash || !safeEqualHex(flow.codeHash, codeHash(flow.id, code))) {
        const updated = await flows.update(tx, flow.id, { codeAttempts: { increment: 1 } });
        return appError('CODE_INVALID', {
          attemptsLeft: Math.max(0, CODE_MAX_ATTEMPTS - updated.codeAttempts),
        });
      }
      const completeBy = addSeconds(now, COMPLETE_TTL_SECONDS);
      const verified = await flows.update(tx, flow.id, {
        status: 'verified',
        verifiedAt: now,
        completeBy,
        expiresAt: completeBy,
        codeHash: null,
      });
      await audit.record(tx, 'EMAIL_VERIFIED', {
        email: flow.email,
        requestId,
        metadata: { purpose: flow.purpose },
      });
      return toState(verified);
    });
    if (outcome instanceof Error) throw outcome;
    return outcome;
  }

  /** Crea un flujo nuevo reemplazando los activos del mismo correo y propósito. */
  async function createFlow(
    db: Db,
    input: {
      email: string;
      purpose: VerificationPurpose;
      flowToken: string;
      consent?: { policyVersion: string; acceptedAt: Date };
    },
  ): Promise<VerificationFlow> {
    const now = clock.now();
    await flows.supersedeActive(db, input.email, input.purpose);
    return flows.create(db, {
      purpose: input.purpose,
      email: input.email,
      flowTokenHash: sha256Hex(input.flowToken),
      status: 'awaiting_code',
      codeExpiresAt: addSeconds(now, CODE_TTL_SECONDS),
      lastCodeSentAt: now,
      expiresAt: addSeconds(now, CODE_TTL_SECONDS + RESEND_GRACE_SECONDS),
      consentPolicyVersion: input.consent?.policyVersion ?? null,
      consentAcceptedAt: input.consent?.acceptedAt ?? null,
      createdAt: now,
    });
  }

  /** Bloquea un flujo `verified` y vigente para el paso 3 (registro o recuperación). */
  async function lockForCompletion(
    tx: Db,
    flowToken: string | undefined,
    purpose: VerificationPurpose,
  ): Promise<VerificationFlow> {
    if (!flowToken) throw appError('VERIFICATION_NOT_FOUND');
    const flow = await flows.lockByTokenHash(tx, sha256Hex(flowToken));
    const now = clock.now();
    if (!flow || flow.purpose !== purpose || !ACTIVE_STATUSES.has(flow.status)) {
      throw appError('VERIFICATION_NOT_FOUND');
    }
    if (flow.status === 'awaiting_code') {
      if (now >= flow.expiresAt) throw appError('VERIFICATION_NOT_FOUND');
      throw appError('VERIFICATION_STEP_INVALID');
    }
    if (!flow.completeBy || now >= flow.completeBy) throw appError('VERIFICATION_EXPIRED');
    return flow;
  }

  async function markCompleted(tx: Db, flowId: string): Promise<void> {
    await flows.update(tx, flowId, { status: 'completed' });
  }

  return {
    assertSendLimit,
    requestCode,
    prepareCodeEmail,
    getState,
    verify,
    createFlow,
    lockForCompletion,
    markCompleted,
    toState,
  };
}

export type VerificationService = ReturnType<typeof createVerificationService>;
