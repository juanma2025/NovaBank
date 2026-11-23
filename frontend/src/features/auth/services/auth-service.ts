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

import type { HttpClient } from '../../../lib/http-client.ts';

export interface HealthResponse {
  status: 'ok';
}

/**
 * Servicio orientado a objetos para las 12 operaciones del contrato OpenAPI de la spec 001.
 * Recibe `HttpClient` por inyección en el constructor para desacoplar red y facilitar pruebas.
 */
export class AuthService {
  constructor(private readonly http: HttpClient) {}

  getHealth(signal?: AbortSignal): Promise<HealthResponse> {
    return this.http.request<HealthResponse>('/health', {
      method: 'GET',
      skipRefreshRetry: true,
      ...(signal ? { signal } : {}),
    });
  }

  async startRegistration(input: StartRegistrationRequest): Promise<VerificationState> {
    const data = await this.http.request<unknown>('/auth/register', {
      method: 'POST',
      body: input,
      skipRefreshRetry: true,
    });
    return VerificationStateSchema.parse(data);
  }

  async startPasswordReset(input: StartPasswordResetRequest): Promise<VerificationState> {
    const data = await this.http.request<unknown>('/auth/password-reset', {
      method: 'POST',
      body: input,
      skipRefreshRetry: true,
    });
    return VerificationStateSchema.parse(data);
  }

  async getVerification(signal?: AbortSignal): Promise<VerificationState> {
    const data = await this.http.request<unknown>('/auth/verification', {
      method: 'GET',
      skipRefreshRetry: true,
      ...(signal ? { signal } : {}),
    });
    return VerificationStateSchema.parse(data);
  }

  async verifyEmail(input: VerifyCodeRequest): Promise<VerificationState> {
    const data = await this.http.request<unknown>('/auth/verify-email', {
      method: 'POST',
      body: input,
      skipRefreshRetry: true,
    });
    return VerificationStateSchema.parse(data);
  }

  async resendVerification(): Promise<VerificationState> {
    const data = await this.http.request<unknown>('/auth/resend-verification', {
      method: 'POST',
      skipRefreshRetry: true,
    });
    return VerificationStateSchema.parse(data);
  }

  async completeRegistration(input: CompleteRegistrationRequest): Promise<SessionResponse> {
    const data = await this.http.request<unknown>('/auth/register/complete', {
      method: 'POST',
      body: input,
      skipRefreshRetry: true,
    });
    return SessionResponseSchema.parse(data);
  }

  completePasswordReset(input: CompletePasswordResetRequest): Promise<void> {
    return this.http.requestVoid('/auth/password-reset/complete', {
      method: 'POST',
      body: input,
      skipRefreshRetry: true,
    });
  }

  async login(input: LoginRequest): Promise<SessionResponse> {
    const data = await this.http.request<unknown>('/auth/login', {
      method: 'POST',
      body: input,
      skipRefreshRetry: true,
    });
    return SessionResponseSchema.parse(data);
  }

  async refreshSession(): Promise<SessionResponse> {
    const data = await this.http.request<unknown>('/auth/refresh', {
      method: 'POST',
      skipRefreshRetry: true,
    });
    return SessionResponseSchema.parse(data);
  }

  logout(): Promise<void> {
    return this.http.requestVoid('/auth/logout', {
      method: 'POST',
      skipRefreshRetry: true,
    });
  }

  async getSession(signal?: AbortSignal): Promise<SessionResponse> {
    const data = await this.http.request<unknown>('/auth/session', {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return SessionResponseSchema.parse(data);
  }
}
