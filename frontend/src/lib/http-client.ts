import {
  type ErrorCode,
  type ErrorDetails,
  ErrorResponseSchema,
  type SessionEndReason,
} from '@nova/shared';

import { formatApiErrorMessage, NETWORK_ERROR_MESSAGE } from './messages.ts';

export type ApiErrorCode = ErrorCode | 'NETWORK';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: ErrorDetails;
  readonly retryAfterSeconds?: number;

  constructor(options: {
    code: ApiErrorCode;
    status: number;
    message: string;
    requestId?: string;
    details?: ErrorDetails;
    retryAfterSeconds?: number;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    if (options.requestId !== undefined) this.requestId = options.requestId;
    if (options.details !== undefined) this.details = options.details;
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
  }
}

export type SessionExpiredHandler = (reason: SessionEndReason | undefined) => void;
export type ContactListener = (timestamp: number) => void;

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Evita reintentos automáticos en rutas que ya son refresh/login/logout. */
  skipRefreshRetry?: boolean;
}

export interface HttpClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

const NO_REFRESH_PATHS = new Set(['/auth/refresh', '/auth/login', '/auth/logout']);

function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const parsed = Number.parseInt(headerValue, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : undefined;
}

function fallbackCodeForStatus(status: number): ErrorCode {
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  return 'INTERNAL_ERROR';
}

/**
 * Cliente HTTP orientado a objetos para la API `/api/v1` de Nova.
 * Encapsula cookies `same-origin`, JSON, seguimiento de `lastServerContactAt`, parseo
 * de `ErrorResponseSchema`, refresh único con `navigator.locks` y aviso `SESSION_EXPIRED`.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly customFetch?: typeof fetch;
  private lastServerContactAtValue: number | null = null;
  private onSessionExpiredHandler: SessionExpiredHandler | null = null;
  private activeRefreshPromise: Promise<void> | null = null;
  private readonly contactListeners = new Set<ContactListener>();

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/api/v1';
    if (options.fetchImpl) this.customFetch = options.fetchImpl;
  }

  /** Marca de tiempo (ms) de la última respuesta 2xx del servidor (research R3). */
  get lastServerContactAt(): number | null {
    return this.lastServerContactAtValue;
  }

  subscribeServerContact(listener: ContactListener): () => void {
    this.contactListeners.add(listener);
    return () => {
      this.contactListeners.delete(listener);
    };
  }

  resetLastServerContactAt(): void {
    this.lastServerContactAtValue = null;
  }

  setOnSessionExpired(handler: SessionExpiredHandler | null): void {
    this.onSessionExpiredHandler = handler;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers, signal, skipRefreshRetry = false } = options;

    let response = await this.executeFetch(path, method, body, headers, signal);

    if (!response.ok) {
      const error = await this.parseErrorResponse(response);
      const canRetry =
        error.code === 'ACCESS_TOKEN_EXPIRED' && !skipRefreshRetry && !NO_REFRESH_PATHS.has(path);

      if (canRetry) {
        await this.performRefresh();
        response = await this.executeFetch(path, method, body, headers, signal);
        if (!response.ok) {
          const retryError = await this.parseErrorResponse(response);
          this.notifyIfSessionExpired(retryError);
          throw retryError;
        }
      } else {
        this.notifyIfSessionExpired(error);
        throw error;
      }
    }

    this.recordServerContact();

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async requestVoid(path: string, options: ApiRequestOptions = {}): Promise<void> {
    await this.request<unknown>(path, options);
  }

  private getFetch(): typeof fetch {
    return this.customFetch ?? globalThis.fetch;
  }

  private async executeFetch(
    path: string,
    method: NonNullable<ApiRequestOptions['method']>,
    body: unknown,
    extraHeaders?: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json', ...extraHeaders };
    let serializedBody: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      serializedBody = JSON.stringify(body);
    }

    try {
      const fetcher = this.getFetch();
      return await fetcher(`${this.baseUrl}${path}`, {
        method,
        credentials: 'same-origin',
        headers,
        ...(serializedBody !== undefined ? { body: serializedBody } : {}),
        ...(signal !== undefined ? { signal } : {}),
      });
    } catch {
      throw new ApiError({ code: 'NETWORK', status: 0, message: NETWORK_ERROR_MESSAGE });
    }
  }

  private recordServerContact(): void {
    const now = Date.now();
    this.lastServerContactAtValue = now;
    for (const listener of this.contactListeners) {
      listener(now);
    }
  }

  private notifyIfSessionExpired(error: ApiError): void {
    if (error.code === 'SESSION_EXPIRED') {
      this.onSessionExpiredHandler?.(error.details?.reason);
    }
  }

  private async parseErrorResponse(response: Response): Promise<ApiError> {
    const retryAfterHeader = parseRetryAfter(response.headers.get('Retry-After'));
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      raw = null;
    }

    const parsed = ErrorResponseSchema.safeParse(raw);
    if (parsed.success) {
      const { code, message, requestId, details } = parsed.data.error;
      const retryAfterSeconds = details?.retryAfterSeconds ?? retryAfterHeader;
      const mergedDetails =
        retryAfterSeconds !== undefined && details?.retryAfterSeconds === undefined
          ? { ...details, retryAfterSeconds }
          : details;
      return new ApiError({
        code,
        status: response.status,
        message: formatApiErrorMessage(code, mergedDetails, message),
        requestId,
        ...(mergedDetails !== undefined ? { details: mergedDetails } : {}),
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      });
    }

    const fallbackCode = fallbackCodeForStatus(response.status);
    return new ApiError({
      code: fallbackCode,
      status: response.status,
      message: formatApiErrorMessage(
        fallbackCode,
        retryAfterHeader !== undefined ? { retryAfterSeconds: retryAfterHeader } : undefined,
      ),
      ...(retryAfterHeader !== undefined ? { retryAfterSeconds: retryAfterHeader } : {}),
    });
  }

  private async runWithRefreshLock(task: () => Promise<void>): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      await navigator.locks.request('nova-refresh', async () => {
        await task();
      });
      return;
    }
    await task();
  }

  private async performRefresh(): Promise<void> {
    if (this.activeRefreshPromise) {
      await this.activeRefreshPromise;
      return;
    }

    const refreshTask = this.runWithRefreshLock(async () => {
      let response: Response;
      try {
        const fetcher = this.getFetch();
        response = await fetcher(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
      } catch {
        throw new ApiError({ code: 'NETWORK', status: 0, message: NETWORK_ERROR_MESSAGE });
      }

      if (!response.ok) {
        const apiError = await this.parseErrorResponse(response);
        this.notifyIfSessionExpired(apiError);
        throw apiError;
      }

      this.recordServerContact();
    });

    this.activeRefreshPromise = refreshTask;
    try {
      await refreshTask;
    } finally {
      if (this.activeRefreshPromise === refreshTask) {
        this.activeRefreshPromise = null;
      }
    }
  }
}
