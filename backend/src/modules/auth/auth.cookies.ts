import type { CookieOptions, Response } from 'express';

/** Nombres de cookies del contrato (contracts/auth.openapi.json, info.description). */
export const COOKIE = {
  access: 'nova_at',
  refresh: 'nova_rt',
  flow: 'nova_vf',
  device: 'nova_dev',
} as const;

const AUTH_PATH = '/api/v1/auth';
const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const FLOW_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const DEVICE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/** Todas las cookies: HttpOnly, Secure y SameSite=Strict (Principio III). */
const base: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict' };

export function setSessionCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; absoluteExpiresAt: Date },
  now: Date,
): void {
  res.cookie(COOKIE.access, tokens.accessToken, {
    ...base,
    path: '/api',
    maxAge: ACCESS_MAX_AGE_MS,
  });
  res.cookie(COOKIE.refresh, tokens.refreshToken, {
    ...base,
    path: AUTH_PATH,
    maxAge: Math.max(0, tokens.absoluteExpiresAt.getTime() - now.getTime()),
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(COOKIE.access, { ...base, path: '/api' });
  res.clearCookie(COOKIE.refresh, { ...base, path: AUTH_PATH });
}

/** Cookie del flujo de verificación: tope de 2 h; la validez real la decide el servidor (R4). */
export function setFlowCookie(res: Response, flowToken: string): void {
  res.cookie(COOKIE.flow, flowToken, { ...base, path: AUTH_PATH, maxAge: FLOW_MAX_AGE_MS });
}

export function clearFlowCookie(res: Response): void {
  res.clearCookie(COOKIE.flow, { ...base, path: AUTH_PATH });
}

export function setDeviceCookie(res: Response, deviceId: string): void {
  res.cookie(COOKIE.device, deviceId, { ...base, path: AUTH_PATH, maxAge: DEVICE_MAX_AGE_MS });
}

/** Lee una cookie como string (cookie-parser deja `req.cookies` sin tipar). */
export function readCookie(cookies: unknown, name: string): string | undefined {
  if (typeof cookies !== 'object' || cookies === null) return undefined;
  const value = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
