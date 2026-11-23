import { formatCOP, type RecipientPreview } from '@nova/shared';
import { Equal, Trash2 } from 'lucide-react';

import { Button } from '../../../components/Button.tsx';
import { SPLITS_MESSAGES } from '../../../lib/messages.ts';
import { AmountInput } from '../../topups/components/AmountInput.tsx';

export interface ParticipantEntry {
  recipient: RecipientPreview;
  rawAmount: string;
  amount: number | null;
}

export interface SplitSharesEditorProps {
  parsedTotal: number | null;
  rawCreatorShare: string;
  creatorShare: number;
  participants: readonly ParticipantEntry[];
  disabled: boolean;
  onResetEven: () => void;
  onCreatorShareChange: (parsed: number | null, formatted: string) => void;
  onParticipantShareChange: (recipientId: string, parsed: number | null, formatted: string) => void;
  onRemoveParticipant: (recipientId: string) => void;
}

/** Editor de partes propuestas y ajustables con suma exacta siempre visible (spec 007). */
export function SplitSharesEditor({
  parsedTotal,
  rawCreatorShare,
  creatorShare,
  participants,
  disabled,
  onResetEven,
  onCreatorShareChange,
  onParticipantShareChange,
  onRemoveParticipant,
}: SplitSharesEditorProps) {
  const participantsSum = participants.reduce((acc, item) => acc + (item.amount ?? 0), 0);
  const currentSum = creatorShare + participantsSum;
  const sumMatches = parsedTotal !== null && currentSum === parsedTotal;

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{SPLITS_MESSAGES.sharesSectionTitle}</h3>
        <Button
          type="button"
          variant="secondary"
          disabled={parsedTotal === null || disabled}
          onClick={onResetEven}
        >
          <Equal aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{SPLITS_MESSAGES.splitEvenlyAction}</span>
        </Button>
      </div>

      <AmountInput
        label={SPLITS_MESSAGES.creatorShareInputLabel}
        placeholder="0"
        value={rawCreatorShare}
        disabled={disabled}
        onValueChange={onCreatorShareChange}
      />

      <ul className="space-y-3">
        {participants.map((entry) => (
          <li
            key={entry.recipient.recipientId}
            className="flex flex-col gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle/50 p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">
                  {entry.recipient.displayName}
                </p>
                <p className="truncate text-xs text-text-muted">{entry.recipient.maskedEmail}</p>
              </div>
              <button
                type="button"
                aria-label={SPLITS_MESSAGES.removeParticipantAction(entry.recipient.displayName)}
                onClick={() => onRemoveParticipant(entry.recipient.recipientId)}
                className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-text-secondary hover:bg-danger-bg hover:text-danger"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <AmountInput
              label={SPLITS_MESSAGES.participantShareInputLabel(entry.recipient.displayName)}
              placeholder="30.000"
              value={entry.rawAmount}
              disabled={disabled}
              onValueChange={(parsed, formatted) =>
                onParticipantShareChange(entry.recipient.recipientId, parsed, formatted)
              }
            />
          </li>
        ))}
      </ul>

      {parsedTotal !== null && (
        <p
          className={`text-sm font-semibold tabular-nums ${sumMatches ? 'text-success' : 'text-danger'}`}
        >
          {sumMatches
            ? SPLITS_MESSAGES.sumMatchesLabel(formatCOP(currentSum))
            : SPLITS_MESSAGES.sumMismatchLabel(formatCOP(currentSum), formatCOP(parsedTotal))}
        </p>
      )}
    </div>
  );
}
