import { type ErrorCode, type ErrorDetails, formatCOP } from '@nova/shared';

export * from './landing-messages.ts';
export * from './messages-auth.ts';
export * from './messages-banking.ts';

/** Catálogo único de errores de la API en español (es-CO). */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Revisa los datos ingresados e intenta de nuevo.',
  DOMAIN_NOT_ALLOWED: 'Solo se aceptan correos institucionales de las universidades participantes.',
  POLICY_VERSION_OUTDATED:
    'La política de tratamiento de datos cambió. Recarga la página y acéptala de nuevo.',
  VERIFICATION_NOT_FOUND: 'No encontramos un proceso en curso. Empieza de nuevo.',
  VERIFICATION_STEP_INVALID: 'Esta acción no corresponde al paso en el que estás.',
  VERIFICATION_EXPIRED: 'Se acabó el tiempo para completar este paso. Empieza de nuevo.',
  CODE_INVALID: 'El código no es válido. Revísalo e intenta de nuevo.',
  CODE_EXPIRED: 'El código venció. Pide uno nuevo para continuar.',
  CODE_ATTEMPTS_EXHAUSTED: 'Agotaste los intentos para este código. Pide uno nuevo.',
  RESEND_TOO_SOON: 'Espera un momento antes de pedir otro código.',
  CODE_SEND_LIMIT: 'Pediste demasiados códigos en la última hora. Intenta más tarde.',
  PASSWORD_WEAK: 'La contraseña no cumple todas las reglas de seguridad.',
  EMAIL_ALREADY_REGISTERED: 'Este correo ya tiene una cuenta en Nova. Inicia sesión.',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  LOGIN_LOCKED: 'Demasiados intentos fallidos. Intenta de nuevo más tarde.',
  UNAUTHENTICATED: 'Inicia sesión para continuar.',
  ACCESS_TOKEN_EXPIRED: 'Tu acceso venció. Estamos renovándolo.',
  SESSION_EXPIRED: 'Tu sesión terminó. Inicia sesión de nuevo.',
  RATE_LIMITED: 'Hiciste demasiadas solicitudes. Espera un momento e intenta de nuevo.',
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
  // Spec 004
  CARD_LIMIT_REACHED: 'Alcanzaste el máximo de 3 tarjetas. Cancela una para emitir otra.',
  CARD_CANCELED: 'Esta tarjeta está cancelada.',
  CARD_NOT_ACTIVE: 'La tarjeta no está activa. Descongélala para pagar.',
  CARD_DECLINED: 'Pago rechazado. Revisa los datos de la tarjeta.',
  CARD_PAYMENTS_LOCKED: 'Demasiados pagos rechazados. Espera unos minutos.',
  PAYMENT_AMOUNT_OUT_OF_RANGE: 'El monto está fuera de los límites permitidos.',
  PAYMENT_DAILY_LIMIT: 'Superas el tope diario de pagos con tarjeta.',
  // Spec 005
  GOAL_LIMIT_REACHED: 'Alcanzaste el máximo de 5 metas activas. Cierra una para crear otra.',
  GOAL_CLOSED: 'Esta meta está cerrada.',
  SAVINGS_AMOUNT_OUT_OF_RANGE: 'El monto está fuera de los límites permitidos.',
  SAVINGS_DAILY_LIMIT: 'Superas el tope diario de movimientos entre tu cuenta y tus metas.',
  // Spec 007
  SPLIT_SHARES_MISMATCH: 'Las partes no suman el total del gasto.',
  SPLIT_SHARE_OUT_OF_RANGE: 'Cada parte debe estar dentro de los límites de una transferencia.',
  SPLIT_CLOSED: 'Esta división ya está cerrada.',
  SHARE_NOT_PENDING: 'Esta parte ya no está pendiente.',
  SPLIT_REMINDER_TOO_SOON: 'Ya enviaste un recordatorio hoy. Podrás enviar otro más tarde.',
};

export const NETWORK_ERROR_MESSAGE =
  'No pudimos conectarnos con Nova. Revisa tu conexión a internet e intenta de nuevo.';

export function formatMinutesRemaining(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}

export function formatSecondsRemaining(seconds: number): string {
  const safe = Math.max(1, Math.ceil(seconds));
  return safe === 1 ? '1 segundo' : `${safe} segundos`;
}

export function formatAttemptsLeft(attemptsLeft: number): string {
  if (attemptsLeft <= 0) return ERROR_MESSAGES.CODE_ATTEMPTS_EXHAUSTED;
  return attemptsLeft === 1
    ? 'El código no es válido. Te queda 1 intento.'
    : `El código no es válido. Te quedan ${attemptsLeft} intentos.`;
}

export function formatApiErrorMessage(
  code: ErrorCode | 'NETWORK',
  details?: ErrorDetails,
  fallbackMessage?: string,
): string {
  if (code === 'NETWORK') return NETWORK_ERROR_MESSAGE;
  if (code === 'CODE_INVALID' && details?.attemptsLeft !== undefined) {
    return formatAttemptsLeft(details.attemptsLeft);
  }
  if (code === 'LOGIN_LOCKED' && details?.retryAfterSeconds !== undefined) {
    return `Demasiados intentos fallidos. Vuelve a intentarlo en ${formatMinutesRemaining(details.retryAfterSeconds)}.`;
  }
  if (code === 'RESEND_TOO_SOON' && details?.retryAfterSeconds !== undefined) {
    return `Espera ${formatSecondsRemaining(details.retryAfterSeconds)} antes de pedir otro código.`;
  }
  if (code === 'CODE_SEND_LIMIT' && details?.retryAfterSeconds !== undefined) {
    return `Alcanzaste el límite de códigos por hora. Podrás pedir otro en ${formatMinutesRemaining(details.retryAfterSeconds)}.`;
  }
  if (code === 'RATE_LIMITED' && details?.retryAfterSeconds !== undefined) {
    return `Hiciste demasiadas solicitudes. Intenta de nuevo en ${formatMinutesRemaining(details.retryAfterSeconds)}.`;
  }
  if (
    code === 'TOPUP_AMOUNT_OUT_OF_RANGE' &&
    details?.minAmount !== undefined &&
    details?.maxAmount !== undefined
  ) {
    return `El monto debe estar entre ${formatCOP(details.minAmount)} y ${formatCOP(details.maxAmount)}.`;
  }
  if (code === 'TOPUP_DAILY_LIMIT' && details?.remainingToday !== undefined) {
    if (details.remainingToday <= 0) {
      return 'Ya alcanzaste tu tope diario de recargas. Vuelve mañana para continuar.';
    }
    return `Superas el tope diario. Puedes recargar hasta ${formatCOP(details.remainingToday)} hoy.`;
  }
  return ERROR_MESSAGES[code] ?? fallbackMessage ?? ERROR_MESSAGES.INTERNAL_ERROR;
}

export const APP_MESSAGES = {
  brandName: 'Nova',
  brandTagline: 'Banca universitaria en Colombia',
  loadingSession: 'Verificando tu sesión…',
  loadingPage: 'Cargando…',
  retry: 'Reintentar',
  backToLogin: 'Volver a iniciar sesión',
  backHome: 'Ir al inicio',
  logout: 'Cerrar sesión',
  loggingOut: 'Cerrando sesión…',
  showPassword: 'Mostrar contraseña',
  hidePassword: 'Ocultar contraseña',
  notFoundTitle: 'No encontramos esta página',
  notFoundDescription: 'El enlace puede estar incompleto o la dirección ya no existe.',
} as const;

export const INACTIVITY_MESSAGES = {
  title: '¿Sigues ahí?',
  description: (seconds: number) =>
    `Por tu seguridad, tu sesión se cerrará en ${formatSecondsRemaining(seconds)} por inactividad.`,
  stayConnected: 'Seguir conectado',
  stayingConnected: 'Renovando sesión…',
  logoutNow: 'Cerrar sesión',
} as const;
