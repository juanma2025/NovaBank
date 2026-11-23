import type { ErrorCode } from '@nova/shared';

/**
 * Catálogo único de mensajes de error de la API, en español (constitución: textos de cara al
 * usuario centralizados). La interfaz puede usar su propio texto a partir del `code`.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Revisa los datos ingresados.',
  DOMAIN_NOT_ALLOWED: 'Solo se aceptan correos institucionales de las universidades participantes.',
  POLICY_VERSION_OUTDATED:
    'La política de tratamiento de datos cambió. Recarga la página y acéptala de nuevo.',
  VERIFICATION_NOT_FOUND: 'No encontramos un proceso en curso. Empieza de nuevo.',
  VERIFICATION_STEP_INVALID: 'Esta acción no corresponde al paso en el que estás.',
  VERIFICATION_EXPIRED: 'Se acabó el tiempo para completar este paso. Empieza de nuevo.',
  CODE_INVALID: 'El código no es válido.',
  CODE_EXPIRED: 'El código venció. Pide uno nuevo.',
  CODE_ATTEMPTS_EXHAUSTED: 'Agotaste los intentos para este código. Pide uno nuevo.',
  RESEND_TOO_SOON: 'Espera un momento antes de pedir otro código.',
  CODE_SEND_LIMIT: 'Pediste demasiados códigos. Intenta más tarde.',
  PASSWORD_WEAK: 'La contraseña no cumple las reglas.',
  EMAIL_ALREADY_REGISTERED: 'Este correo ya tiene una cuenta. Inicia sesión.',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  LOGIN_LOCKED: 'Demasiados intentos fallidos. Intenta más tarde.',
  UNAUTHENTICATED: 'Inicia sesión para continuar.',
  ACCESS_TOKEN_EXPIRED: 'Tu acceso venció. Estamos renovándolo.',
  SESSION_EXPIRED: 'Tu sesión terminó. Inicia sesión de nuevo.',
  RATE_LIMITED: 'Hiciste demasiadas solicitudes. Intenta más tarde.',
  NOT_FOUND: 'No encontramos lo que buscas.',
  INTERNAL_ERROR: 'Ocurrió un error inesperado. Intenta de nuevo en unos minutos.',
  // Spec 002
  TOPUP_AMOUNT_OUT_OF_RANGE: 'El monto está fuera del rango permitido para recargar.',
  TOPUP_DAILY_LIMIT: 'Superas el tope diario de recargas.',
  IDEMPOTENCY_KEY_REUSED: 'Esta solicitud ya se usó con otros datos. Vuelve a intentarlo.',
  // Spec 003
  ALIAS_TAKEN: 'Ese alias no está disponible. Prueba con otro.',
  RECIPIENT_NOT_FOUND: 'No encontramos un estudiante de Nova con ese correo o alias.',
  TRANSFER_TO_SELF: 'No puedes enviarte dinero a ti mismo.',
  TRANSFER_AMOUNT_OUT_OF_RANGE: 'El monto está fuera de los límites permitidos.',
  TRANSFER_DAILY_LIMIT: 'Superas el tope diario de envíos.',
  INSUFFICIENT_FUNDS: 'No tienes saldo suficiente para este envío.',
  REAUTH_REQUIRED: 'Para este monto debes confirmar con tu contraseña.',
  REAUTH_FAILED: 'La contraseña no es correcta.',
  REAUTH_LOCKED: 'Demasiados intentos con la contraseña. Espera unos minutos.',
};
