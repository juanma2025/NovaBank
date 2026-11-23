import { pino, type Logger } from 'pino';

/**
 * Rutas que nunca deben aparecer en los logs (FR-022, Principio III): contraseñas, códigos,
 * tokens, cookies y datos de tarjeta (spec 004, regla de dominio 8).
 */
export const REDACT_PATHS = [
  'password',
  '*.password',
  'verificationCode',
  '*.verificationCode',
  'token',
  '*.token',
  'accessToken',
  'refreshToken',
  'flowToken',
  'cardNumber',
  '*.cardNumber',
  'cvv',
  '*.cvv',
  'number',
  '*.number',
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  'req.body',
];

export function createLogger(level: string, destination?: NodeJS.WritableStream): Logger {
  const options = { level, redact: { paths: REDACT_PATHS, censor: '[redactado]' } };
  return destination ? pino(options, destination) : pino(options);
}

export type { Logger };
