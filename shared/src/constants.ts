/** Versión vigente de la política de tratamiento de datos (Ley 1581 de 2012). FR-002. */
export const PRIVACY_POLICY_VERSION = '2026-11-20';

/** Dígitos del código de verificación. FR-003. */
export const CODE_LENGTH = 6;

/** Inactividad máxima de la sesión en producción (15 min). FR-016. */
export const SESSION_IDLE_TIMEOUT_SECONDS = 900;

/** Anticipación del aviso «Seguir conectado» en producción (60 s). FR-016a. */
export const SESSION_IDLE_WARNING_SECONDS = 60;

/** Longitud de la contraseña. FR-010. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/** Longitud del nombre completo. FR-012 · data-model.md `User.full_name`. */
export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 100;

/** Longitud máxima de un correo. data-model.md `User.email`. */
export const EMAIL_MAX_LENGTH = 254;

/** Longitud máxima de la versión de política aceptada. data-model.md `DataConsent.policy_version`. */
export const POLICY_VERSION_MAX_LENGTH = 20;

/** Intentos por código. FR-004. */
export const CODE_MAX_ATTEMPTS = 5;

// --- Spec 002: cuentas, libro contable y recargas ---------------------------

/** Montos sugeridos para recargar con un toque (FR-014). */
export const SUGGESTED_TOPUP_AMOUNTS = [20_000, 50_000, 100_000] as const;

/** Cabecera obligatoria en los POST que mueven dinero (constitución, regla de dominio 4). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/** Tamaño de página del historial (FR-020). */
export const MOVEMENTS_PAGE_SIZE = 20;

/** Movimientos recientes en la pantalla de inicio (FR-015). */
export const RECENT_MOVEMENTS = 5;
