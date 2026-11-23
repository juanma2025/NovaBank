import type {
  CompletePasswordResetRequest,
  CompleteRegistrationRequest,
  LoginRequest,
  SessionResponse,
  StartPasswordResetRequest,
  StartRegistrationRequest,
  VerificationState,
  VerifyCodeRequest,
} from '@nova/shared';

import { httpClient } from '../../lib/api-client.ts';
import { AuthService, type HealthResponse } from './services/auth-service.ts';

export { AuthService, type HealthResponse } from './services/auth-service.ts';

/** Instancia compartida por defecto de `AuthService` (los hooks consumen vía `useAuthServices`). */
export const authService = new AuthService(httpClient);

export const getHealth = (signal?: AbortSignal): Promise<HealthResponse> =>
  authService.getHealth(signal);

export const startRegistration = (input: StartRegistrationRequest): Promise<VerificationState> =>
  authService.startRegistration(input);

export const startPasswordReset = (input: StartPasswordResetRequest): Promise<VerificationState> =>
  authService.startPasswordReset(input);

export const getVerification = (signal?: AbortSignal): Promise<VerificationState> =>
  authService.getVerification(signal);

export const verifyEmail = (input: VerifyCodeRequest): Promise<VerificationState> =>
  authService.verifyEmail(input);

export const resendVerification = (): Promise<VerificationState> =>
  authService.resendVerification();

export const completeRegistration = (
  input: CompleteRegistrationRequest,
): Promise<SessionResponse> => authService.completeRegistration(input);

export const completePasswordReset = (input: CompletePasswordResetRequest): Promise<void> =>
  authService.completePasswordReset(input);

export const login = (input: LoginRequest): Promise<SessionResponse> => authService.login(input);

export const refreshSession = (): Promise<SessionResponse> => authService.refreshSession();

export const logout = (): Promise<void> => authService.logout();

export const getSession = (signal?: AbortSignal): Promise<SessionResponse> =>
  authService.getSession(signal);
