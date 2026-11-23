import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SESSION_IDLE_TIMEOUT_SECONDS, SESSION_IDLE_WARNING_SECONDS } from '@nova/shared';
import { z } from 'zod';

/** Convierte cadenas vacías (`SMTP_USER=`) en `undefined` antes de validar. */
const optionalString = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());
const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');
const optionalPositiveInt = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    APP_ORIGIN: z.url(),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SERVE_FRONTEND: booleanString,
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres'),
    CODE_HMAC_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres'),
    STUDENT_EMAIL_DOMAINS: z
      .string()
      .transform((s) =>
        s
          .split(',')
          .map((d) => d.trim().toLowerCase())
          .filter((d) => d.length > 0),
      )
      .pipe(z.array(z.string().min(3)).min(1, 'debe incluir al menos un dominio')),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_SECURE: booleanString,
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    MAIL_FROM: z.string().min(1),
    SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE: optionalPositiveInt,
    SESSION_IDLE_WARNING_SECONDS_OVERRIDE: optionalPositiveInt,
    // Spec 002: límites de recarga en pesos enteros (research R7).
    TOPUP_MIN_AMOUNT: z.coerce.number().int().min(1).default(1000),
    TOPUP_MAX_AMOUNT: z.coerce.number().int().min(1).default(500_000),
    TOPUP_DAILY_LIMIT: z.coerce.number().int().min(1).default(2_000_000),
  })
  .superRefine((env, ctx) => {
    const overrides = [
      'SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE',
      'SESSION_IDLE_WARNING_SECONDS_OVERRIDE',
    ] as const;
    if (env.NODE_ENV === 'production') {
      for (const key of overrides) {
        if (env[key] !== undefined) {
          ctx.addIssue({ code: 'custom', path: [key], message: 'prohibida en producción' });
        }
      }
    }
    if (!(
      env.TOPUP_MIN_AMOUNT <= env.TOPUP_MAX_AMOUNT && env.TOPUP_MAX_AMOUNT <= env.TOPUP_DAILY_LIMIT
    )) {
      ctx.addIssue({
        code: 'custom',
        path: ['TOPUP_MAX_AMOUNT'],
        message: 'debe cumplirse TOPUP_MIN_AMOUNT ≤ TOPUP_MAX_AMOUNT ≤ TOPUP_DAILY_LIMIT',
      });
    }
    const timeout = env.SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE ?? SESSION_IDLE_TIMEOUT_SECONDS;
    const warning = env.SESSION_IDLE_WARNING_SECONDS_OVERRIDE ?? SESSION_IDLE_WARNING_SECONDS;
    if (warning >= timeout) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_IDLE_WARNING_SECONDS_OVERRIDE'],
        message: 'el aviso debe ser menor que el tiempo de inactividad',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export interface AppConfig extends Env {
  session: { idleTimeoutSeconds: number; idleWarningSeconds: number };
  topups: { minAmount: number; maxAmount: number; dailyLimit: number };
}

export class EnvValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Configuración inválida:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/** Carga `.env` de la raíz del repositorio (fuera de pruebas) con el cargador nativo de Node. */
function loadDotEnv(): void {
  if (process.env.NODE_ENV === 'test') return;
  const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
}

/** Valida las variables de entorno (Principio VI): si falta una requerida, lanza un error claro. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  if (source === process.env) loadDotEnv();
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`),
    );
  }
  const env = result.data;
  return {
    ...env,
    topups: {
      minAmount: env.TOPUP_MIN_AMOUNT,
      maxAmount: env.TOPUP_MAX_AMOUNT,
      dailyLimit: env.TOPUP_DAILY_LIMIT,
    },
    session: {
      idleTimeoutSeconds: env.SESSION_IDLE_TIMEOUT_SECONDS_OVERRIDE ?? SESSION_IDLE_TIMEOUT_SECONDS,
      idleWarningSeconds: env.SESSION_IDLE_WARNING_SECONDS_OVERRIDE ?? SESSION_IDLE_WARNING_SECONDS,
    },
  };
}
