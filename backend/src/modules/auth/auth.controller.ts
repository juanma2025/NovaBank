import {
  CompleteRegistrationRequestSchema,
  type SessionResponse,
  StartRegistrationRequestSchema,
  VerifyCodeRequestSchema,
} from '@nova/shared';
import type { Request, Response } from 'express';

import type { Session } from '@nova/db';
import { appError } from '../../lib/errors.js';
import type { AuthContext } from './auth.context.js';
import {
  COOKIE,
  clearFlowCookie,
  readCookie,
  setFlowCookie,
  setSessionCookies,
} from './auth.cookies.js';
import type { RegistrationService } from './registration.service.js';
import { userRepository } from './repositories/user.repository.js';
import type { SessionService } from './session.service.js';
import type { VerificationService } from './verification.service.js';

/** Controlador: valida con Zod, orquesta los servicios y arma la respuesta HTTP. */
export function createAuthController(
  ctx: AuthContext,
  deps: {
    sessions: SessionService;
    verification: VerificationService;
    registration: RegistrationService;
  },
) {
  const { prisma, clock } = ctx;
  const { sessions, verification, registration } = deps;
  const flowToken = (req: Request): string | undefined => readCookie(req.cookies, COOKIE.flow);

  return {
    /** GET /auth/session (operación getSession). */
    async getSession(req: Request, res: Response): Promise<void> {
      const session = res.locals.session as Session;
      const user = await userRepository.findById(prisma, session.userId);
      if (!user) throw appError('UNAUTHENTICATED');
      const body: SessionResponse = {
        user: { id: user.id, email: user.email, fullName: user.fullName },
        session: sessions.toSessionInfo(session),
      };
      res.json(body);
    },

    /** POST /auth/register (operación startRegistration). */
    async startRegistration(req: Request, res: Response): Promise<void> {
      const input = StartRegistrationRequestSchema.parse(req.body);
      const result = await registration.start(
        input.email,
        input.acceptedPolicyVersion,
        req.requestId,
      );
      setFlowCookie(res, result.flowToken);
      res.status(202).json(result.state);
    },

    /** GET /auth/verification (operación getVerification). */
    async getVerification(req: Request, res: Response): Promise<void> {
      res.json(await verification.getState(flowToken(req)));
    },

    /** POST /auth/verify-email (operación verifyEmail). */
    async verifyEmail(req: Request, res: Response): Promise<void> {
      const { code } = VerifyCodeRequestSchema.parse(req.body);
      res.json(await verification.verify(flowToken(req), code, req.requestId));
    },

    /** POST /auth/register/complete (operación completeRegistration). */
    async completeRegistration(req: Request, res: Response): Promise<void> {
      const input = CompleteRegistrationRequestSchema.parse(req.body);
      const { issued, response } = await registration.complete(
        flowToken(req),
        input.fullName,
        input.password,
        req.requestId,
      );
      setSessionCookies(
        res,
        {
          accessToken: issued.accessToken,
          refreshToken: issued.refreshToken,
          absoluteExpiresAt: issued.session.absoluteExpiresAt,
        },
        clock.now(),
      );
      clearFlowCookie(res);
      res.status(201).json(response);
    },
  };
}

export type AuthController = ReturnType<typeof createAuthController>;
