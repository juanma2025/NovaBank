/** Textos en español (es-CO) para el selector de tema y la Landing Page pública de Nova. */

export const THEME_MESSAGES = {
  switchToDark: 'Cambiar a modo oscuro',
  switchToLight: 'Cambiar a modo claro',
} as const;

export const LANDING_MESSAGES = {
  nav: {
    ariaLabel: 'Navegación principal',
    whatIs: 'Qué es',
    features: 'Características',
    forStudents: 'Para estudiantes',
    login: 'Iniciar sesión',
    register: 'Crear cuenta',
  },
  hero: {
    headline: 'La banca universitaria pensada para tu día a día en Colombia.',
    subtitle:
      'Administra tu cuenta estudiantil en pesos colombianos (COP) exactos, mueve dinero con tus compañeros y aprende finanzas digitales en un entorno académico rápido, claro y seguro.',
    primaryCta: 'Crear cuenta',
    secondaryCta: 'Iniciar sesión',
    previewCaption:
      'Vista previa ilustrativa · Entorno académico con dinero 100 % simulado en pesos colombianos (COP).',
    previewBalanceLabel: 'Saldo disponible',
    previewCurrency: 'COP',
    previewAccountTag: 'Cuenta verificada',
    previewCardTitle: 'Tarjeta virtual Nova',
    previewCardStatus: 'Activa',
    previewCardLast4: '•••• 4821',
    previewCardHolder: 'ESTUDIANTE NOVA',
    previewMovementsTitle: 'Actividad reciente',
    previewMovementTopup: 'Recarga simulada',
    previewMovementCampus: 'Cafetería Campus',
    previewMovementPeer: 'Transferencia · Laura M.',
  },
  whatIs: {
    title: 'Qué hace Nova',
    description:
      'Nova es una banca virtual diseñada exclusivamente para estudiantes universitarios en Colombia. Cada operación queda registrada en un libro contable de doble entrada inmutable en pesos enteros, sin decimales, sin comisiones ocultas y con seguridad desde el primer acceso.',
    highlights: [
      {
        metric: 'COP exacto',
        label: 'Pesos enteros sin errores de redondeo ni punto flotante.',
      },
      {
        metric: 'Doble entrada',
        label: 'Libro contable inmutable que verifica el equilibrio de cada asiento.',
      },
      {
        metric: '100 % académico',
        label: 'Dinero de demostración para probar flujos reales sin riesgo bancario.',
      },
    ],
  },
  features: {
    title: 'Todo lo que construye tu experiencia bancaria',
    subtitle:
      'Una hoja de ruta modular diseñada con la claridad de las mejores apps financieras, adaptada a la vida universitaria.',
    cards: {
      copAccount: {
        title: 'Cuenta en COP exactos y libro contable',
        description:
          'Consulta tu saldo en pesos enteros, ocúltalo con un toque en lugares públicos, recarga con dinero de demostración y revisa tu historial completo.',
        chipPrimary: 'Saldo ocultable',
        chipSecondary: 'Recarga simulada',
      },
      transfers: {
        title: 'Transferencias entre compañeros',
        description:
          'Envía dinero al instante usando el correo institucional o alias de otro estudiante verificado, con confirmación explícita y nota opcional.',
        chipAlias: '@ana.perez',
        chipDomain: 'ucc.edu.co',
      },
      virtualCard: {
        title: 'Tarjeta virtual simulada',
        description:
          'Emite tarjetas virtuales, congélalas o descongélalas al instante y revela número completo o CVV únicamente tras reautenticación.',
        chipStatus: 'Congelamiento inmediato',
        chipDigits: '•••• 4821',
      },
      goalsAndBudgets: {
        title: 'Metas de ahorro y presupuestos',
        description:
          'Aparta dinero en subcuentas dedicadas para tus metas del semestre y recibe alertas informativas por categoría sin bloquear tus pagos.',
        goalLabel: 'Portátil semestre',
        goalProgress: '68 %',
      },
      splits: {
        title: 'Gastos compartidos',
        description:
          'Divide salidas, copias o proyectos del grupo en partes claras para que cada compañero pague su aporte con total transparencia.',
        splitLabel: 'Proyecto Ingeniería Web',
        splitCount: '3 integrantes',
      },
      crypto: {
        title: 'Wallet cripto',
        badge: 'Muy pronto',
        description:
          'En una próxima fase podrás explorar criptoactivos y conversiones a COP desde Nova. Por ahora es solo una vista informativa de nuestra hoja de ruta.',
      },
    },
  },
  audience: {
    title: 'Diseñada para estudiantes universitarios en Colombia',
    subtitle:
      'El acceso es exclusivo para estudiantes con correo institucional verificado (como @ucc.edu.co en esta demo académica), garantizando un entorno confiable entre pares.',
    pillars: [
      {
        title: 'Verificación por correo institucional',
        description:
          'Activación mediante código de 6 dígitos de un solo uso, con vigencia de 15 minutos e intentos limitados.',
      },
      {
        title: 'Privacidad Ley 1581 de 2012',
        description:
          'Consentimiento explícito de tratamiento de datos personales y consulta transparente en cualquier momento.',
        linkLabel: 'Leer política de datos',
      },
      {
        title: 'Sesiones seguras con cookies HttpOnly',
        description:
          'Tokens rotativos protegidos del acceso desde scripts, cierre por inactividad de 15 min y límite máximo de 12 horas.',
      },
      {
        title: 'Simulación académica honesta',
        description:
          'Proyecto demostrativo de Ingeniería Web: no custodia fondos reales ni se conecta a redes bancarias ni pasarelas externas.',
      },
    ],
  },
  closing: {
    title: 'Empieza con tu correo institucional en minutos',
    description:
      'Verifica tu cuenta estudiantil, prueba una recarga de demostración en COP y recorre la experiencia completa de Nova.',
    primaryCta: 'Crear cuenta',
    secondaryCta: 'Iniciar sesión',
  },
  footer: {
    privacy: 'Privacidad',
    academicNote:
      'Proyecto académico de Ingeniería Web · Dinero 100 % simulado en COP · Sin conexión con entidades bancarias reales.',
  },
} as const;
