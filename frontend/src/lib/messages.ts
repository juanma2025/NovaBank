import type { ErrorCode, ErrorDetails, PasswordRuleViolation } from '@nova/shared';

export type AuthNoticeReason = 'inactividad' | 'expirada' | 'clave-cambiada';

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

export const PASSWORD_RULE_MESSAGES: Record<PasswordRuleViolation, string> = {
  too_short: 'Al menos 10 caracteres',
  too_long: 'Máximo 128 caracteres',
  contains_email: 'No puede contener tu correo ni tu nombre de usuario',
  common: 'No puede ser una contraseña común o fácil de adivinar',
};

export const PASSWORD_RULE_STATUS_SR = {
  valid: 'Cumplida: ',
  invalid: 'No cumplida: ',
} as const;

export const AUTH_REASON_BANNERS: Record<
  AuthNoticeReason,
  { variant: 'info' | 'warning' | 'success'; title: string; body: string }
> = {
  inactividad: {
    variant: 'warning',
    title: 'Sesión cerrada por inactividad',
    body: 'Cerramos tu sesión tras 15 minutos sin actividad para proteger tu cuenta. Ingresa de nuevo para continuar.',
  },
  expirada: {
    variant: 'info',
    title: 'Tu sesión terminó',
    body: 'Por tu seguridad, vuelve a iniciar sesión para retomar donde estabas.',
  },
  'clave-cambiada': {
    variant: 'success',
    title: 'Contraseña actualizada',
    body: 'Cerramos tus sesiones anteriores. Ya puedes ingresar con tu contraseña nueva.',
  },
};

export function isAuthNoticeReason(value: string | null): value is AuthNoticeReason {
  return value === 'inactividad' || value === 'expirada' || value === 'clave-cambiada';
}

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
  pendingRouteTitle: 'Pantalla en construcción',
  pendingRouteDescription: 'Esta vista se habilitará en el siguiente bloque de implementación.',
} as const;

export const VALIDATION_MESSAGES = {
  emailRequired: 'Escribe tu correo institucional.',
  emailInvalid: 'Ingresa un correo electrónico válido (ej. nombre@ucc.edu.co).',
  passwordRequired: 'Escribe tu contraseña.',
  fullNameRequired: 'Escribe tu nombre completo.',
  fullNameInvalid:
    'Usa entre 2 y 100 caracteres, solo letras, espacios, guiones o apóstrofos (sin números).',
  consentRequired: 'Debes aceptar la política de tratamiento de datos para continuar.',
  codeIncomplete: 'Ingresa los 6 dígitos del código.',
} as const;

export const LOGIN_MESSAGES = {
  title: 'Inicia sesión en Nova',
  subtitle: 'Usa tu correo institucional para entrar a tu cuenta.',
  emailLabel: 'Correo institucional',
  emailPlaceholder: 'nombre.apellido@ucc.edu.co',
  passwordLabel: 'Contraseña',
  passwordPlaceholder: 'Ingresa tu contraseña',
  submit: 'Ingresar',
  submitting: 'Ingresando…',
  forgotPassword: '¿Olvidaste tu contraseña?',
  noAccountPrompt: '¿Aún no tienes cuenta?',
  createAccount: 'Crear cuenta',
} as const;

export const REGISTER_MESSAGES = {
  step1Title: 'Crea tu cuenta en Nova',
  step1Subtitle: 'Regístrate con tu correo universitario para empezar.',
  step1Submit: 'Enviar código',
  step1Submitting: 'Enviando código…',
  step1InfoNotice:
    'Te enviaremos un código de 6 dígitos si el correo puede registrarse en una universidad participante.',
  step2Title: 'Revisa tu correo institucional',
  step2Subtitle: 'Ingresa el código de 6 dígitos que enviamos a',
  step3Title: 'Completa tu perfil',
  step3Subtitle: 'Solo falta tu nombre completo y una contraseña segura.',
  fullNameLabel: 'Nombre completo',
  fullNamePlaceholder: 'Ana María Pérez',
  passwordLabel: 'Crea una contraseña',
  passwordPlaceholder: 'Mínimo 10 caracteres',
  step3Submit: 'Crear cuenta',
  step3Submitting: 'Creando cuenta…',
  hasAccountPrompt: '¿Ya tienes cuenta?',
  goToLogin: 'Iniciar sesión',
  consentPrefix: 'Acepto la ',
  consentLink: 'política de tratamiento de datos personales',
  consentSuffix: ' (Ley 1581 de 2012).',
} as const;

export const RESET_MESSAGES = {
  step1Title: 'Recupera tu contraseña',
  step1Subtitle: 'Escribe tu correo institucional. Si tiene cuenta, te enviaremos un código.',
  step1Submit: 'Enviar código',
  step1Submitting: 'Enviando código…',
  step2Title: 'Ingresa el código de recuperación',
  step2Subtitle: 'Si el correo tiene cuenta, enviamos un código de 6 dígitos a',
  step3Title: 'Crea una contraseña nueva',
  step3Subtitle: 'Al guardarla cerraremos tus sesiones abiertas en otros dispositivos.',
  passwordLabel: 'Contraseña nueva',
  passwordPlaceholder: 'Mínimo 10 caracteres',
  step3Submit: 'Guardar contraseña',
  step3Submitting: 'Guardando…',
} as const;

export const VERIFICATION_MESSAGES = {
  codeLabel: 'Código de verificación de 6 dígitos',
  codeDigitLabel: (index: number) => `Dígito ${index + 1} de 6`,
  verifySubmit: 'Verificar código',
  verifying: 'Verificando código…',
  useAnotherEmail: 'Usar otro correo',
  resendButton: 'Reenviar código',
  resendProminent: 'Pedir código nuevo',
  resending: 'Enviando código nuevo…',
  resendCountdown: (seconds: number) => `Reenviar código en ${seconds} s`,
  resendSuccess: 'Enviamos un código nuevo. El código anterior dejó de ser válido.',
  stepProgress: (step: number, total: number) => `Paso ${step} de ${total}`,
} as const;

export const WELCOME_MESSAGES = {
  greeting: (firstName: string) => `Hola, ${firstName}`,
  subtitle: 'Tu cuenta estudiantil en Nova está verificada y lista.',
  accountBadge: 'Correo institucional verificado',
  nextStepNote:
    'Muy pronto verás aquí tu saldo en pesos colombianos (COP), tus movimientos y tus metas de ahorro.',
} as const;

export const INACTIVITY_MESSAGES = {
  title: '¿Sigues ahí?',
  description: (seconds: number) =>
    `Por tu seguridad, tu sesión se cerrará en ${formatSecondsRemaining(seconds)} por inactividad.`,
  stayConnected: 'Seguir conectado',
  stayingConnected: 'Renovando sesión…',
  logoutNow: 'Cerrar sesión',
} as const;

export const PRIVACY_POLICY_MESSAGES = {
  title: 'Política de tratamiento de datos personales',
  versionLabel: (version: string) => `Versión vigente: ${version}`,
  intro:
    'En cumplimiento de la Ley 1581 de 2012 (Habeas Data) de la República de Colombia, Nova informa cómo recolecta y protege tus datos personales dentro de este proyecto académico de banca virtual universitaria.',
  sections: [
    {
      heading: '1. Datos recolectados',
      body: 'Para crear y operar tu cuenta recolectamos únicamente tu correo electrónico institucional, tu nombre completo, el hash seguro de tu contraseña y la fecha y versión de esta autorización.',
    },
    {
      heading: '2. Finalidad del tratamiento',
      body: 'Tus datos se utilizan exclusivamente para verificar tu identidad estudiantil, autenticar tu sesión, enviar códigos de verificación y avisos de seguridad, y registrar eventos de auditoría.',
    },
    {
      heading: '3. Seguridad y privacidad',
      body: 'Las contraseñas se protegen con Argon2id y las sesiones se gestionan mediante cookies seguras. No compartimos tus datos con terceros ni manejamos fondos bancarios reales.',
    },
    {
      heading: '4. Tus derechos',
      body: 'Como titular de los datos tienes derecho a conocer, actualizar y rectificar tu información conforme a la Ley 1581 de 2012 y sus decretos reglamentarios.',
    },
  ],
  backToRegister: 'Volver al registro',
} as const;
