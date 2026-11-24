import { type RecipientPreview, SPLIT_MAX_PARTICIPANTS } from '@nova/shared';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../../../components/Button.tsx';
import { TextField } from '../../../components/TextField.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import { SPLITS_MESSAGES } from '../../../lib/messages.ts';
import { useRecipient } from '../../transfers/hooks/useRecipient.ts';

export interface ParticipantAdderProps {
  existingIds: readonly string[];
  disabled?: boolean;
  onAdd: (recipient: RecipientPreview) => void;
}

/**
 * Buscador de participantes reutilizando la vista previa de destinatario de la spec 003
 * (nombre parcial y correo enmascarado, nunca correo completo · FR-013).
 */
export function ParticipantAdder({ existingIds, disabled = false, onAdd }: ParticipantAdderProps) {
  const recipientMutation = useRecipient();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [shakeKey, setShakeKey] = useState(0);

  async function handleAdd(): Promise<void> {
    if (disabled || recipientMutation.isPending) return;
    setError(undefined);

    if (existingIds.length >= SPLIT_MAX_PARTICIPANTS) {
      setError(SPLITS_MESSAGES.maxParticipantsError(SPLIT_MAX_PARTICIPANTS));
      setShakeKey((prev) => prev + 1);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setError(SPLITS_MESSAGES.noParticipantsError);
      setShakeKey((prev) => prev + 1);
      return;
    }

    try {
      const preview = await recipientMutation.mutateAsync(trimmed);
      if (existingIds.includes(preview.recipientId)) {
        setError(SPLITS_MESSAGES.duplicateParticipantError);
        setShakeKey((prev) => prev + 1);
        return;
      }
      onAdd(preview);
      setQuery('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setShakeKey((prev) => prev + 1);
      }
    }
  }

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <TextField
          label={SPLITS_MESSAGES.participantSearchLabel}
          name="participantQuery"
          placeholder={SPLITS_MESSAGES.participantSearchPlaceholder}
          value={query}
          disabled={disabled || recipientMutation.isPending}
          error={error}
          shakeKey={shakeKey}
          onChange={(event) => {
            setQuery(event.target.value);
            if (error) setError(undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleAdd();
            }
          }}
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        loading={recipientMutation.isPending}
        loadingLabel={SPLITS_MESSAGES.searchingParticipant}
        onClick={() => {
          void handleAdd();
        }}
      >
        <UserPlus aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{SPLITS_MESSAGES.addParticipantAction}</span>
      </Button>
    </div>
  );
}
