import {
  type ErrorCode,
  type ErrorDetails,
  ErrorResponseSchema,
  type SessionEndReason,
} from '@nova/shared';

import { formatApiErrorMessage, NETWORK_ERROR_MESSAGE } from './messages.ts';

const API_BASE = '/api/v1';

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
type ContactListener = (timestamp: number) => void;

let lastServerContactAtValue: number | null = null;
let onSessionExpiredHandler: SessionExpiredHandler | null = null;
let activeRefreshPromise: Promise<void> | null = null;
const contactListeners = new Set<ContactListener>();

/** Marca de tiempo (ms) de la última respuesta 2xx del servidor (research R3). */
export function getLastServerContactAt(): number | null {
  return lastServerContactAtValue;
}

export function subscribeServerContact(listener: ContactListener): () => void {
  contactListeners.add(listener);
  return () => {
    contactListeners.delete(listener);
  };
}

export function resetLastServerContactAt(): void {
  lastServerContactAtValue = null;
}

export function setOnSessionExpired(handler: SessionExpiredHandler | null): void {
  onSessionExpiredHandler = handler;
}

function recordServerContact(): void {
  const now = Date.now();
  lastServerContactAtValue = now;
  for (const listener of contactListeners) {
    listener(now);
  }
}

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

async function parseErrorResponse(response: Response): Promise<ApiError> {
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

async function runWithRefreshLock(task: () => Promise<void>): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    await navigator.locks.request('nova-refresh', async () => {
      await task();
    });
    return;
  }
  await task();
}

async function performRefresh(): Promise<void> {
  if (activeRefreshPromise) {
    await activeRefreshPromise;
    return;
  }

  const refreshTask = runWithRefreshLock(async () => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new ApiError({ code: 'NETWORK', status: 0, message: NETWORK_ERROR_MESSAGE });
    }

    if (!response.ok) {
      const apiError = await parseErrorResponse(response);
      if (apiError.code === 'SESSION_EXPIRED') {
        onSessionExpiredHandler?.(apiError.details?.reason);
      }
      throw apiError;
    }

    recordServerContact();
  });

  activeRefreshPromise = refreshTask;
  try {
    await refreshTask;
  } finally {
    if (activeRefreshPromise === refreshTask) {
      activeRefreshPromise = null;
    }
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Evita reintentos automáticos en rutas que ya son refresh/login/logout. */
  skipRefreshRetry?: boolean;
}

const NO_REFRESH_PATHS = new Set(['/auth/refresh', '/auth/login', '/auth/logout']);

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, skipRefreshRetry = false } = options;

  const execute = async (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    let serializedBody: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      serializedBody = JSON.stringify(body);
    }

    try {
      return await fetch(`${API_BASE}${path}`, {
        method,
        credentials: 'same-origin',
        headers,
        ...(serializedBody !== undefined ? { body: serializedBody } : {}),
        ...(signal !== undefined ? { signal } : {}),
      });
    } catch {
      throw new ApiError({ code: 'NETWORK', status: 0, message: NETWORK_ERROR_MESSAGE });
    }
  };

  let response = await execute();

  if (!response.ok) {
    const error = await parseErrorResponse(response);
    const canRetry =
      error.code === 'ACCESS_TOKEN_EXPIRED' && !skipRefreshRetry && !NO_REFRESH_PATHS.has(path);

    if (canRetry) {
      await performRefresh();
      response = await execute();
      if (!response.ok) {
        const retryError = await parseErrorResponse(response);
        if (retryError.code === 'SESSION_EXPIRED') {
          onSessionExpiredHandler?.(retryError.details?.reason);
        }
        throw retryError;
      }
    } else {
      if (error.code === 'SESSION_EXPIRED') {
        onSessionExpiredHandler?.(error.details?.reason);
      }
      throw error;
    }
  }

  recordServerContact();

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiRequestVoid(path: string, options: ApiRequestOptions = {}): Promise<void> {
  await apiRequest<unknown>(path, options);
}
