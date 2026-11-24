import type { PasswordRuleViolation } from '@nova/shared';

export type AuthNoticeReason = 'inactividad' | 'expirada' | 'clave-cambiada';

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

export const AUTH_EDITORIAL_MESSAGES = {
  headline: 'Tu banca universitaria, clara y protegida.',
  description:
    'Accede con tu correo institucional verificado y gestiona tu cuenta en pesos colombianos desde un entorno diseñado para estudiantes.',
  signals: [
    {
      title: 'Correo institucional verificado',
      detail: 'Validación por código de 6 dígitos de un solo uso con vigencia de 15 minutos.',
    },
    {
      title: 'Sesiones protegidas',
      detail: 'Cookies cifradas HttpOnly y cierre automático por inactividad o a las 12 horas.',
    },
    {
      title: 'Privacidad Ley 1581 de 2012',
      detail: 'Consentimiento explícito y registro inmutable de eventos de seguridad.',
    },
  ],
  academicNotice: 'Entorno académico simulado en COP · Sin conexión a redes bancarias reales.',
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
  step2Title: 'Revisa tu correo institucional',
  step2Subtitle: 'Si el correo puede registrarse, enviamos un código de 6 dígitos a',
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
