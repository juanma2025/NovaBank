import { BUDGET_CATEGORY_LABELS, type BudgetCategory, type BudgetStatus } from '@nova/shared';

/** Catálogo de textos en español (es-CO) para presupuesto mensual y alertas (spec 006). */
export const BUDGET_MESSAGES = {
  pageTitle: 'Presupuesto mensual',
  pageSubtitle: 'Controla cuánto gastas por categoría cada mes sin bloquear tus operaciones.',
  backToHome: 'Volver al inicio',
  infoNotice: 'Tu presupuesto es informativo: nunca bloquea ni rechaza pagos ni transferencias.',
  monthSelectorLabel: 'Mes a consultar',
  currentMonthTag: 'Mes actual',
  pastMonthNotice:
    'Estás consultando un mes anterior en modo solo lectura. Los topes mostrados corresponden a los vigentes ese mes.',
  totalSpentLabel: 'Total gastado en el mes',
  configuredCount: (count: number, total: number) => `${count} de ${total} categorías con tope`,
  emptyPromptTitle: 'Pon tu primer tope',
  emptyPromptBody:
    'Define cuánto quieres gastar en Comida, Transporte o Libros y recibe alertas al llegar al 80 % y al pasar el 100 %.',
  emptyPromptAction: 'Definir primer tope',
  categoriesTitle: 'Categorías del mes',
  noLimitLabel: 'Sin tope',
  spentOfLimit: (spent: string, limit: string) => `${spent} de ${limit}`,
  exceededByLabel: (excess: string) => `Exceso de ${excess}`,
  remainingBudgetLabel: (remaining: string) => `Quedan ${remaining}`,
  setLimitAction: 'Poner tope',
  editLimitAction: 'Cambiar tope',
  statusLabels: {
    none: 'Sin tope',
    ok: 'Normal',
    warning: 'Cerca del tope',
    exceeded: 'Superado',
  } satisfies Record<BudgetStatus, string>,
  dialogSetTitle: (category: BudgetCategory) => `Tope para ${BUDGET_CATEGORY_LABELS[category]}`,
  dialogSubtitle: 'Este tope aplica desde este mes y se repetirá cada mes hasta que lo cambies.',
  limitInputLabel: 'Tope mensual',
  limitPlaceholder: '200.000',
  limitHint: (min: string, max: string) => `Entre ${min} y ${max} por mes.`,
  validationRequired: 'Escribe un tope mensual para guardar.',
  validationInvalid: 'Ingresa un monto entero en pesos colombianos.',
  validationRange: (min: string, max: string) => `El tope debe estar entre ${min} y ${max}.`,
  saveLimitAction: 'Guardar tope',
  savingLimit: 'Guardando…',
  removeLimitAction: 'Quitar tope',
  removingLimit: 'Quitando…',
  cancelAction: 'Cancelar',
  loadError: 'No pudimos cargar tu presupuesto. Intenta de nuevo.',
  transfersTitle: 'Transferencias enviadas del mes',
  transfersSubtitle:
    'Por defecto cuentan en «Transferencias», pero puedes reclasificar cada una a otra categoría.',
  transfersEmpty: 'No enviaste transferencias en este mes.',
  transfersError: 'No pudimos cargar tus transferencias del mes.',
  transfersLoadMore: 'Cargar más',
  transfersLoadingMore: 'Cargando más…',
  categorySelectLabel: (description: string) => `Categoría de ${description}`,
  reclassifying: 'Actualizando…',
  alertWarningTitle: (category: BudgetCategory, percent: number) =>
    `Te estás acercando a tu presupuesto de ${BUDGET_CATEGORY_LABELS[category]} (${percent} %)`,
  alertExceededTitle: (category: BudgetCategory) =>
    `Superaste tu presupuesto de ${BUDGET_CATEGORY_LABELS[category]}`,
  alertSpentDetail: (spent: string, limit: string) => `Llevas ${spent} de ${limit} este mes.`,
  alertDismiss: 'Entendido',
  alertGoToBudget: 'Ver presupuesto',
  bannerTitle: 'Avisos de presupuesto este mes',
  bannerLink: 'Ver presupuesto',
  bannerExceededItem: (category: BudgetCategory, percent: number) =>
    `${BUDGET_CATEGORY_LABELS[category]} superado (${percent} %)`,
  bannerWarningItem: (category: BudgetCategory, percent: number) =>
    `${BUDGET_CATEGORY_LABELS[category]} cerca del tope (${percent} %)`,
} as const;
