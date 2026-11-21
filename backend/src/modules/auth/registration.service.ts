import { Prisma } from '@nova/db';
import {
  PRIVACY_POLICY_VERSION,
  type SessionResponse,
  type VerificationState,
  emailDomain,
} from '@nova/shared';

import { randomToken } from '../../lib/crypto.js';
import { appError } from '../../lib/errors.js';
import { outboxRepository } from '../../lib/mail/outbox.repository.js';
import type { AuthContext } from './auth.context.js';
import { checkPassword, hashPassword } from './password-policy.js';
import { consentRepository } from './repositories/consent.repository.js';
import { userRepository } from './repositories/user.repository.js';
import type { IssuedSession, SessionService } from './session.service.js';
import type { VerificationService } from './verification.service.js';

export interface StartResult {
  flowToken: string;
  state: VerificationState;
}

export interface CompleteResult {
  issued: IssuedSession;
  response: SessionResponse;
}

/** Registro en tres pasos (US1): correo + consentimiento → código → nombre + contraseña. */
export function createRegistrationService(
  ctx: AuthContext,
  deps: { sessions: SessionService; verification: VerificationService },
) {
  const { config, prisma, clock, audit } = ctx;
  const { sessions, verification } = deps;

  /** Paso 1 (FR-001, FR-002, FR-005, FR-008). `email` llega normalizado por el esquema. */
  async function start(
    email: string,
    acceptedPolicyVersion: string,
    requestId: string,
  ): Promise<StartResult> {
    if (!config.STUDENT_EMAIL_DOMAINS.includes(emailDomain(email))) {
      throw appError('DOMAIN_NOT_ALLOWED');
    }
    if (acceptedPolicyVersion !== PRIVACY_POLICY_VERSION) {
      throw appError('POLICY_VERSION_OUTDATED');
    }
    const flowToken = randomToken();
    const flow = await prisma.$transaction(async (tx) => {
      await verification.assertSendLimit(tx, email);
      const existing = await userRepository.findByEmail(tx, email);
      const created = await verification.createFlow(tx, {
        email,
        purpose: 'registration',
        flowToken,
        consent: { policyVersion: acceptedPolicyVersion, acceptedAt: clock.now() },
      });
      // Correo ya registrado: flujo señuelo con la misma respuesta y un aviso en vez del código.
      const updated = await verification.requestCode(tx, created, { decoy: existing !== null });
      if (existing) {
        await outboxRepository.enqueue(tx, {
          template: 'already_registered',
          to: email,
          now: clock.now(),
        });
      }
      await audit.record(tx, 'REGISTRATION_STARTED', { email, requestId });
      return updated;
    });
    return { flowToken, state: verification.toState(flow) };
  }

  /** Paso 3 (FR-006, FR-007, FR-009, FR-010–FR-012): crea la cuenta e inicia la sesión. */
  async function complete(
    flowToken: string | undefined,
    fullName: string,
    password: string,
    requestId: string,
  ): Promise<CompleteResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        const flow = await verification.lockForCompletion(tx, flowToken, 'registration');
        const violations = checkPassword(password, flow.email);
        if (violations.length > 0) throw appError('PASSWORD_WEAK', { reasons: violations });
        if (!flow.consentPolicyVersion || !flow.consentAcceptedAt) {
          throw appError('VERIFICATION_NOT_FOUND');
        }
        const now = clock.now();
        const user = await userRepository.create(tx, {
          email: flow.email,
          fullName,
          passwordHash: await hashPassword(password),
          now,
        });
        await consentRepository.create(tx, {
          userId: user.id,
          policyVersion: flow.consentPolicyVersion,
          acceptedAt: flow.consentAcceptedAt,
        });
        await verification.markCompleted(tx, flow.id);
        const issued = await sessions.create(tx, user.id);
        await audit.record(tx, 'ACCOUNT_CREATED', { userId: user.id, requestId });
        return {
          issued,
          response: {
            user: { id: user.id, email: user.email, fullName: user.fullName },
            session: sessions.toSessionInfo(issued.session),
          },
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw appError('EMAIL_ALREADY_REGISTERED');
      }
      throw error;
    }
  }

  return { start, complete };
}

export type RegistrationService = ReturnType<typeof createRegistrationService>;
