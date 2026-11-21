import {
  CompletePasswordResetRequestSchema,
  CompleteRegistrationRequestSchema,
  LoginRequestSchema,
  type SessionResponse,
  StartPasswordResetRequestSchema,
  StartRegistrationRequestSchema,
  VerifyCodeRequestSchema,
} from '@nova/shared';
import type { Request, Response } from 'express';

import type { Session } from '@nova/db';
import { randomToken } from '../../lib/crypto.js';
import { appError } from '../../lib/errors.js';
import type { AuthContext } from './auth.context.js';
import {
  COOKIE,
  clearFlowCookie,
  clearSessionCookies,
  readCookie,
  setDeviceCookie,
  setFlowCookie,
  setSessionCookies,
} from './auth.cookies.js';
import type { LoginService } from './login.service.js';
import type { PasswordResetService } from './password-reset.service.js';
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
    login: LoginService;
    passwordReset: PasswordResetService;
  },
) {
  const { prisma, clock } = ctx;
  const { sessions, verification, registration } = deps;
  const flowToken = (req: Request): string | undefined => readCookie(req.cookies, COOKIE.flow);

  /** Identificador de dispositivo válido de la cookie nova_dev (research R7). */
  const deviceId = (req: Request): string | undefined => {
    const value = readCookie(req.cookies, COOKIE.device);
    return value && /^[A-Za-z0-9_-]{20,100}$/.test(value) ? value : undefined;
  };

  async function sessionResponse(session: Session): Promise<SessionResponse> {
    const user = await userRepository.findById(prisma, session.userId);
    if (!user) throw appError('UNAUTHENTICATED');
    return {
      user: { id: user.id, email: user.email, fullName: user.fullName },
      session: sessions.toSessionInfo(session),
    };
  }

  return {
    /** GET /auth/session (operación getSession). */
    async getSession(_req: Request, res: Response): Promise<void> {
      res.json(await sessionResponse(res.locals.session as Session));
    },

    /** POST /auth/login (operación login). */
    async login(req: Request, res: Response): Promise<void> {
      const input = LoginRequestSchema.parse(req.body);
      const device = deviceId(req);
      // Sin cookie, este intento cuenta por IP y se entrega un dispositivo para los siguientes.
      if (!device) setDeviceCookie(res, randomToken());
      const { issued, response } = await deps.login.login({
        email: input.email,
        password: input.password,
        device: { ...(device ? { id: device } : {}), ip: req.ip ?? 'desconocida' },
        requestId: req.requestId,
      });
      setSessionCookies(
        res,
        {
          accessToken: issued.accessToken,
          refreshToken: issued.refreshToken,
          absoluteExpiresAt: issued.session.absoluteExpiresAt,
        },
        clock.now(),
      );
      res.json(response);
    },

    /** POST /auth/refresh (operación refreshSession). */
    async refresh(req: Request, res: Response): Promise<void> {
      const { session, tokens } = await sessions.refresh(
        readCookie(req.cookies, COOKIE.refresh),
        req.requestId,
      );
      if (tokens) {
        setSessionCookies(
          res,
          { ...tokens, absoluteExpiresAt: session.absoluteExpiresAt },
          clock.now(),
        );
      }
      res.json(await sessionResponse(session));
    },

    /** POST /auth/logout (operación logout). Idempotente. */
    async logout(req: Request, res: Response): Promise<void> {
      const refreshToken = readCookie(req.cookies, COOKIE.refresh);
      const accessToken = readCookie(req.cookies, COOKIE.access);
      await sessions.logout(
        { ...(refreshToken ? { refreshToken } : {}), ...(accessToken ? { accessToken } : {}) },
        req.requestId,
      );
      clearSessionCookies(res);
      res.status(204).end();
    },

    /** POST /auth/password-reset (operación startPasswordReset). */
    async startPasswordReset(req: Request, res: Response): Promise<void> {
      const { email } = StartPasswordResetRequestSchema.parse(req.body);
      const result = await deps.passwordReset.start(email, req.requestId);
      setFlowCookie(res, result.flowToken);
      res.status(202).json(result.state);
    },

    /** POST /auth/password-reset/complete (operación completePasswordReset). */
    async completePasswordReset(req: Request, res: Response): Promise<void> {
      const { password } = CompletePasswordResetRequestSchema.parse(req.body);
      await deps.passwordReset.complete(flowToken(req), password, req.requestId);
      clearFlowCookie(res);
      res.status(204).end();
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
