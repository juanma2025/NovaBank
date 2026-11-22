import {
  type CompletePasswordResetRequest,
  type CompleteRegistrationRequest,
  type LoginRequest,
  type SessionResponse,
  SessionResponseSchema,
  type StartPasswordResetRequest,
  type StartRegistrationRequest,
  type VerificationState,
  VerificationStateSchema,
  type VerifyCodeRequest,
} from '@nova/shared';

import { apiRequest, apiRequestVoid } from '../../lib/api-client.ts';

export interface HealthResponse {
  status: 'ok';
}

/** GET /api/v1/health (getHealth). */
export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health', {
    method: 'GET',
    skipRefreshRetry: true,
    ...(signal ? { signal } : {}),
  });
}

/** POST /api/v1/auth/register (startRegistration). */
export async function startRegistration(
  input: StartRegistrationRequest,
): Promise<VerificationState> {
  const data = await apiRequest<unknown>('/auth/register', {
    method: 'POST',
    body: input,
    skipRefreshRetry: true,
  });
  return VerificationStateSchema.parse(data);
}

/** POST /api/v1/auth/password-reset (startPasswordReset). */
export async function startPasswordReset(
  input: StartPasswordResetRequest,
): Promise<VerificationState> {
  const data = await apiRequest<unknown>('/auth/password-reset', {
    method: 'POST',
    body: input,
    skipRefreshRetry: true,
  });
  return VerificationStateSchema.parse(data);
}

/** GET /api/v1/auth/verification (getVerification). */
export async function getVerification(signal?: AbortSignal): Promise<VerificationState> {
  const data = await apiRequest<unknown>('/auth/verification', {
    method: 'GET',
    skipRefreshRetry: true,
    ...(signal ? { signal } : {}),
  });
  return VerificationStateSchema.parse(data);
}

/** POST /api/v1/auth/verify-email (verifyEmail). */
export async function verifyEmail(input: VerifyCodeRequest): Promise<VerificationState> {
  const data = await apiRequest<unknown>('/auth/verify-email', {
    method: 'POST',
    body: input,
    skipRefreshRetry: true,
  });
  return VerificationStateSchema.parse(data);
}

/** POST /api/v1/auth/resend-verification (resendVerification). */
export async function resendVerification(): Promise<VerificationState> {
  const data = await apiRequest<unknown>('/auth/resend-verification', {
    method: 'POST',
    skipRefreshRetry: true,
  });
  return VerificationStateSchema.parse(data);
}

/** POST /api/v1/auth/register/complete (completeRegistration). */
export async function completeRegistration(
  input: CompleteRegistrationRequest,
): Promise<SessionResponse> {
  const data = await apiRequest<unknown>('/auth/register/complete', {
    method: 'POST',
    body: input,
    skipRefreshRetry: true,
  });
  return SessionResponseSchema.parse(data);
}

/** POST /api/v1/auth/password-reset/complete (completePasswordReset). */
export function completePasswordReset(input: CompletePasswordResetRequest): Promise<void> {
  return apiRequestVoid('/auth/password-reset/complete', {
    method: 'POST',
    body: input,
    skipRefreshRetry: true,
  });
}

/** POST /api/v1/auth/login (login). */
export async function login(input: LoginRequest): Promise<SessionResponse> {
  const data = await apiRequest<unknown>('/auth/login', {
    method: 'POST',
    body: input,
    skipRefreshRetry: true,
  });
  return SessionResponseSchema.parse(data);
}

/** POST /api/v1/auth/refresh (refreshSession). */
export async function refreshSession(): Promise<SessionResponse> {
  const data = await apiRequest<unknown>('/auth/refresh', {
    method: 'POST',
    skipRefreshRetry: true,
  });
  return SessionResponseSchema.parse(data);
}

/** POST /api/v1/auth/logout (logout). */
export function logout(): Promise<void> {
  return apiRequestVoid('/auth/logout', {
    method: 'POST',
    skipRefreshRetry: true,
  });
}

/** GET /api/v1/auth/session (getSession). */
export async function getSession(signal?: AbortSignal): Promise<SessionResponse> {
  const data = await apiRequest<unknown>('/auth/session', {
    method: 'GET',
    ...(signal ? { signal } : {}),
  });
  return SessionResponseSchema.parse(data);
}
