import { RECIPIENT_QUERY_MIN_LENGTH, type RecipientPreview } from '@nova/shared';
import { Search, ShieldCheck, UserCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Button } from '../../../components/Button.tsx';
import { TextField } from '../../../components/TextField.tsx';
import { TRANSFER_MESSAGES } from '../../../lib/messages.ts';

export interface RecipientFieldProps {
  recipient: RecipientPreview | null;
  isSearching: boolean;
  serverError?: string;
  onSearch: (query: string) => void;
  onChangeRecipient: () => void;
  onClearError: () => void;
}

/**
 * Campo de búsqueda y vista previa del destinatario por correo o alias (spec 003, T018).
 * Muestra únicamente el nombre parcial y el correo enmascarado (FR-002).
 */
export function RecipientField({
  recipient,
  isSearching,
  serverError,
  onSearch,
  onChangeRecipient,
  onClearError,
}: RecipientFieldProps) {
  const [query, setQuery] = useState('');
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const [shakeKey, setShakeKey] = useState(0);

  const displayedError = serverError ?? localError;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < RECIPIENT_QUERY_MIN_LENGTH) {
      setLocalError(TRANSFER_MESSAGES.recipientMinLength);
      setShakeKey((prev) => prev + 1);
      return;
    }
    setLocalError(undefined);
    onSearch(trimmed);
  }

  if (recipient) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface-subtle/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-success-border bg-success-bg text-success">
            <UserCheck aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[15px] font-semibold text-text">
                {recipient.displayName}
              </p>
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-success-border bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success">
                <ShieldCheck aria-hidden="true" className="h-3 w-3 shrink-0" />
                <span>{TRANSFER_MESSAGES.recipientConfirmedBadge}</span>
              </span>
            </div>
            <p className="truncate text-sm text-text-secondary">{recipient.maskedEmail}</p>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            onChangeRecipient();
            setLocalError(undefined);
          }}
        >
          {TRANSFER_MESSAGES.changeRecipient}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label={TRANSFER_MESSAGES.recipientLabel}
        name="recipientQuery"
        autoComplete="off"
        placeholder={TRANSFER_MESSAGES.recipientPlaceholder}
        value={query}
        disabled={isSearching}
        error={displayedError}
        shakeKey={shakeKey}
        hint={TRANSFER_MESSAGES.recipientHint}
        onChange={(event) => {
          setQuery(event.target.value);
          setLocalError(undefined);
          onClearError();
        }}
      />

      <Button
        type="submit"
        fullWidth
        loading={isSearching}
        loadingLabel={TRANSFER_MESSAGES.searchingRecipient}
      >
        <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>{TRANSFER_MESSAGES.searchRecipient}</span>
      </Button>
    </form>
  );
}
