import {
  formatCOP,
  type LedgerTransactionStatus,
  type Movement,
  type MovementType,
} from '@nova/shared';

export const MASKED_AMOUNT = '••••••';

export type MovementDirection = 'credit' | 'debit';

export interface MovementStatusLabels {
  pending: string;
  failed: string;
  reversed: string;
}

export interface MovementTypeLabels {
  topup: string;
  transfer: string;
  card_payment: string;
  savings_deposit: string;
  savings_withdrawal: string;
}

export interface PresentedMovement {
  id: string;
  transactionId: string;
  type: MovementType;
  typeLabel: string;
  description: string;
  note: string | null;
  direction: MovementDirection;
  formattedAmount: string;
  formattedDate: string;
  status: LedgerTransactionStatus;
  statusLabel: string | null;
}

const DEFAULT_STATUS_LABELS: MovementStatusLabels = {
  pending: 'Pendiente',
  failed: 'Fallida',
  reversed: 'Revertida',
};

const DEFAULT_TYPE_LABELS: MovementTypeLabels = {
  topup: 'Recarga',
  transfer: 'Transferencia',
  card_payment: 'Pago con tarjeta',
  savings_deposit: 'Aporte a meta',
  savings_withdrawal: 'Retiro de meta',
};

const bogotaDateFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Encapsula la presentación de saldos y movimientos: pesos enteros COP con `formatCOP`,
 * signo explícito (`+`/`-`), fechas en `America/Bogota`, nota opcional y máscara `••••••`.
 */
export class MovementPresenter {
  private readonly statusLabels: MovementStatusLabels;
  private readonly typeLabels: MovementTypeLabels;

  constructor(
    options: {
      statusLabels?: MovementStatusLabels;
      typeLabels?: MovementTypeLabels;
    } = {},
  ) {
    this.statusLabels = options.statusLabels ?? DEFAULT_STATUS_LABELS;
    this.typeLabels = options.typeLabels ?? DEFAULT_TYPE_LABELS;
  }

  formatBalance(balance: number, hidden: boolean): string {
    return hidden ? MASKED_AMOUNT : formatCOP(balance);
  }

  formatSignedAmount(amount: number, hidden: boolean): string {
    if (hidden) return MASKED_AMOUNT;
    return amount > 0 ? `+${formatCOP(amount)}` : formatCOP(amount);
  }

  formatDateTime(isoDate: string): string {
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) return isoDate;
    return bogotaDateFormatter.format(parsed);
  }

  formatStatus(status: LedgerTransactionStatus): string | null {
    if (status === 'completed') return null;
    return this.statusLabels[status];
  }

  present(movement: Movement, hidden: boolean): PresentedMovement {
    const trimmedNote = movement.note?.trim() ?? '';
    return {
      id: movement.id,
      transactionId: movement.transactionId,
      type: movement.type,
      typeLabel: this.typeLabels[movement.type],
      description: movement.description,
      note: trimmedNote.length > 0 ? trimmedNote : null,
      direction: movement.amount > 0 ? 'credit' : 'debit',
      formattedAmount: this.formatSignedAmount(movement.amount, hidden),
      formattedDate: this.formatDateTime(movement.createdAt),
      status: movement.status,
      statusLabel: this.formatStatus(movement.status),
    };
  }
}

export const movementPresenter = new MovementPresenter();
