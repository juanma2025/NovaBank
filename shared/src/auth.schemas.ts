/**
 * Esquemas de la API de autenticación (spec 001). Cada esquema corresponde a un
 * `components.schemas` de specs/001-auth-onboarding/contracts/auth.openapi.json.
 */
import { z } from 'zod';

import {
  CODE_LENGTH,
  CODE_MAX_ATTEMPTS,
  EMAIL_MAX_LENGTH,
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  POLICY_VERSION_MAX_LENGTH,
} from './constants.js';
import { InstitutionalEmailSchema } from './email.js';
import { PasswordSchema } from './password.js';

// --- Campos -----------------------------------------------------------------

/** Nombre completo: letras Unicode, espacio, guion y apóstrofo (FR-012; data-model.md `User.full_name`). */
export const FullNameSchema = z
  .string()
  .trim()
  .min(FULL_NAME_MIN_LENGTH)
  .max(FULL_NAME_MAX_LENGTH)
  .regex(/^\p{L}[\p{L} '-]*\p{L}$/u);

/** Código de verificación de 6 dígitos (FR-003). */
export const VerificationCodeSchema = z.string().regex(new RegExp(`^[0-9]{${CODE_LENGTH}}$`));

export const VerificationPurposeSchema = z.enum(['registration', 'password_reset']);
export type VerificationPurpose = z.infer<typeof VerificationPurposeSchema>;

export const VerificationStepSchema = z.enum(['code', 'complete']);
export type VerificationStep = z.infer<typeof VerificationStepSchema>;

// --- Requests ---------------------------------------------------------------

export const StartRegistrationRequestSchema = z.strictObject({
  email: InstitutionalEmailSchema,
  acceptedPolicyVersion: z.string().max(POLICY_VERSION_MAX_LENGTH),
});
export type StartRegistrationRequest = z.infer<typeof StartRegistrationRequestSchema>;

export const StartPasswordResetRequestSchema = z.strictObject({
  email: InstitutionalEmailSchema,
});
export type StartPasswordResetRequest = z.infer<typeof StartPasswordResetRequestSchema>;

export const VerifyCodeRequestSchema = z.strictObject({
  code: VerificationCodeSchema,
});
export type VerifyCodeRequest = z.infer<typeof VerifyCodeRequestSchema>;

export const CompleteRegistrationRequestSchema = z.strictObject({
  fullName: FullNameSchema,
  password: PasswordSchema,
});
export type CompleteRegistrationRequest = z.infer<typeof CompleteRegistrationRequestSchema>;

export const CompletePasswordResetRequestSchema = z.strictObject({
  password: PasswordSchema,
});
export type CompletePasswordResetRequest = z.infer<typeof CompletePasswordResetRequestSchema>;

/** Login: solo formato y longitud; sin reglas de fortaleza (FR-013). */
export const LoginRequestSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email().max(EMAIL_MAX_LENGTH)),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// --- Responses --------------------------------------------------------------

export const VerificationStateSchema = z.object({
  purpose: VerificationPurposeSchema,
  step: VerificationStepSchema,
  maskedEmail: z.string(),
  /** Provisional hasta que el correo se envía; luego, envío + 15 min. */
  codeExpiresAt: z.iso.datetime(),
  resendAvailableAt: z.iso.datetime(),
  attemptsLeft: z.int().min(0).max(CODE_MAX_ATTEMPTS),
  /** Límite para el paso 3; null mientras step = code. */
  completeBy: z.iso.datetime().nullable(),
});
export type VerificationState = z.infer<typeof VerificationStateSchema>;

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  fullName: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const SessionInfoSchema = z.object({
  /** 900 en producción; menor solo en desarrollo y E2E. */
  idleTimeoutSeconds: z.int().min(1),
  /** 60 en producción; siempre menor que idleTimeoutSeconds. */
  idleWarningSeconds: z.int().min(1),
  lastActivityAt: z.iso.datetime(),
  absoluteExpiresAt: z.iso.datetime(),
});
export type SessionInfo = z.infer<typeof SessionInfoSchema>;

export const SessionResponseSchema = z.object({
  user: UserSchema,
  session: SessionInfoSchema,
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
