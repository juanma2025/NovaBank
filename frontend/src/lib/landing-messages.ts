/** Textos en español (es-CO) para el selector de tema y la experiencia pública multipágina de Nova. */

export const THEME_MESSAGES = {
  switchToDark: 'Cambiar a modo oscuro',
  switchToLight: 'Cambiar a modo claro',
} as const;

export const LANDING_MESSAGES = {
  nav: {
    ariaLabel: 'Navegación principal',
    home: 'Inicio',
    features: 'Características',
    students: 'Estudiantes',
    login: 'Iniciar sesión',
    register: 'Crear cuenta',
  },
  home: {
    headline: 'Tu banca universitaria en pesos colombianos.',
    subtitle:
      'Administra tu cuenta estudiantil en COP exactos con libro contable inmutable, diseñada para tu día a día en la universidad.',
    gateways: {
      featuresTitle: 'Características',
      featuresSummary: 'Cuenta en COP, transferencias, tarjeta virtual, metas y más.',
      featuresAction: 'Ver características',
      studentsTitle: 'Estudiantes',
      studentsSummary: 'Correo institucional, sesiones seguras y Ley 1581 de 2012.',
      studentsAction: 'Ver cómo funciona',
    },
    previewCaption: 'Vista previa ilustrativa · Dinero 100 % simulado en pesos colombianos (COP).',
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
  features: {
    title: 'Qué hace Nova',
    subtitle:
      'Una banca virtual académica con libro contable de doble entrada en pesos enteros (COP), diseñada con claridad modular para la vida universitaria.',
    highlights: [
      {
        metric: 'COP exacto',
        label: 'Pesos enteros sin redondeos ni errores de punto flotante.',
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
    roadmapTitle: 'Capacidades de la plataforma',
    roadmapSubtitle:
      'Recorre los módulos que componen la experiencia Nova. Las funciones próximas se muestran solo de forma informativa.',
    cards: {
      copAccount: {
        title: 'Cuenta en COP exactos y libro contable',
        description:
          'Consulta tu saldo en pesos enteros, ocúltalo con un toque en espacios públicos, realiza recargas simuladas y revisa cada movimiento.',
        chipPrimary: 'Saldo ocultable',
        chipSecondary: 'Recarga simulada',
      },
      transfers: {
        title: 'Transferencias entre compañeros',
        description:
          'Envía dinero usando el correo institucional o alias de otro estudiante verificado, con confirmación explícita y nota opcional.',
        chipAlias: '@ana.perez',
        chipDomain: 'ucc.edu.co',
      },
      virtualCard: {
        title: 'Tarjeta virtual simulada',
        description:
          'Emite tarjetas virtuales, congélalas al instante y revela número completo o CVV únicamente tras reautenticación.',
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
          'Divide salidas, copias o proyectos del grupo en partes claras para que cada compañero pague su aporte con transparencia.',
        splitLabel: 'Proyecto Ingeniería Web',
        splitCount: '3 integrantes',
      },
      crypto: {
        title: 'Wallet cripto',
        badge: 'Muy pronto',
        description:
          'En una próxima fase podrás explorar criptoactivos y conversiones a COP desde Nova. Por ahora es una vista estrictamente informativa.',
      },
    },
    nextRouteLabel: 'Conoce la seguridad y acceso para estudiantes',
  },
  students: {
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
        title: 'Sesiones seguras con cookies HttpOnly',
        description:
          'Cookies protegidas contra scripts con atributo SameSite=Strict, cierre por inactividad de 15 minutos y límite máximo de 12 horas.',
      },
      {
        title: 'Privacidad Ley 1581 de 2012',
        description:
          'Consentimiento explícito de tratamiento de datos personales y consulta pública disponible en cualquier momento.',
        linkLabel: 'Leer política de datos',
      },
      {
        title: 'Simulación académica honesta',
        description:
          'Proyecto demostrativo de Ingeniería Web: utiliza dinero 100 % simulado en COP y no custodia fondos reales ni se conecta a redes bancarias.',
      },
    ],
    nextRouteLabel: 'Explora las características de Nova',
  },
  footer: {
    privacy: 'Privacidad',
    academicNote:
      'Proyecto académico de Ingeniería Web · Dinero 100 % simulado en COP · Sin conexión con entidades bancarias reales.',
  },
} as const;
