import { AliasSchema } from '@nova/shared';
import { AtSign, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useId, useState } from 'react';

import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { ModalDialog } from '../../../components/ModalDialog.tsx';
import { TextField } from '../../../components/TextField.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import { PROFILE_MESSAGES } from '../../../lib/messages.ts';
import { useRemoveAlias, useSetAlias } from '../hooks/useProfile.ts';

export interface AliasSectionProps {
  currentAlias: string | null;
  onStatusMessage: (message: string | null) => void;
}

export function AliasSection({ currentAlias, onStatusMessage }: AliasSectionProps) {
  const setAliasMutation = useSetAlias();
  const removeAliasMutation = useRemoveAlias();

  const [rawAlias, setRawAlias] = useState(currentAlias ? `@${currentAlias}` : '');
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>(undefined);
  const [shakeKey, setShakeKey] = useState(0);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  const removeTitleId = useId();
  const removeDescId = useId();

  useEffect(() => {
    setRawAlias(currentAlias ? `@${currentAlias}` : '');
  }, [currentAlias]);

  const trimmed = rawAlias.trim();
  const parsedAlias = trimmed.length > 0 ? AliasSchema.safeParse(trimmed) : null;
  const formatError =
    touched && trimmed.length === 0
      ? PROFILE_MESSAGES.aliasRequired
      : trimmed.length > 0 && parsedAlias && !parsedAlias.success
        ? PROFILE_MESSAGES.aliasInvalidFormat
        : undefined;
  const displayedError = serverError ?? formatError;
  const normalizedPreview = parsedAlias?.success ? parsedAlias.data : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setTouched(true);
    setServerError(undefined);
    onStatusMessage(null);

    if (trimmed.length === 0 || !parsedAlias?.success) {
      setShakeKey((prev) => prev + 1);
      return;
    }

    try {
      const updated = await setAliasMutation.mutateAsync(parsedAlias.data);
      setTouched(false);
      if (updated.alias) onStatusMessage(PROFILE_MESSAGES.savedToast(updated.alias));
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.message);
        setShakeKey((prev) => prev + 1);
      }
    }
  }

  async function handleConfirmRemove(): Promise<void> {
    setServerError(undefined);
    onStatusMessage(null);
    try {
      await removeAliasMutation.mutateAsync();
      setRemoveDialogOpen(false);
      setTouched(false);
      onStatusMessage(PROFILE_MESSAGES.removedToast);
    } catch (error) {
      if (error instanceof ApiError) {
        setRemoveDialogOpen(false);
        setServerError(error.message);
      }
    }
  }

  return (
    <>
      <GlassCard className="space-y-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <AtSign aria-hidden="true" className="h-5 w-5 text-brand-text" />
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">
              {PROFILE_MESSAGES.aliasSectionTitle}
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">
            {PROFILE_MESSAGES.aliasSectionDescription}
          </p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
          <TextField
            label={PROFILE_MESSAGES.aliasFieldLabel}
            name="alias"
            autoComplete="off"
            placeholder={PROFILE_MESSAGES.aliasPlaceholder}
            value={rawAlias}
            disabled={setAliasMutation.isPending || removeAliasMutation.isPending}
            error={displayedError}
            shakeKey={shakeKey}
            hint={
              normalizedPreview
                ? PROFILE_MESSAGES.aliasPreview(normalizedPreview)
                : PROFILE_MESSAGES.aliasHint
            }
            onChange={(event) => {
              setRawAlias(event.target.value);
              setServerError(undefined);
              onStatusMessage(null);
            }}
            onBlur={() => setTouched(true)}
          />

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button
              type="submit"
              fullWidth
              loading={setAliasMutation.isPending}
              loadingLabel={PROFILE_MESSAGES.savingAlias}
            >
              {currentAlias ? PROFILE_MESSAGES.updateAlias : PROFILE_MESSAGES.saveAlias}
            </Button>

            {currentAlias && (
              <Button
                type="button"
                variant="secondary"
                disabled={setAliasMutation.isPending || removeAliasMutation.isPending}
                onClick={() => setRemoveDialogOpen(true)}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>{PROFILE_MESSAGES.removeAlias}</span>
              </Button>
            )}
          </div>
        </form>
      </GlassCard>

      {currentAlias && (
        <ModalDialog
          open={removeDialogOpen}
          titleId={removeTitleId}
          descriptionId={removeDescId}
          maxWidthClass="max-w-sm"
          preventClose={removeAliasMutation.isPending}
          onClose={() => setRemoveDialogOpen(false)}
        >
          <div className="space-y-5">
            <div className="space-y-1.5">
              <h2 id={removeTitleId} className="text-lg font-semibold tracking-[-0.02em] text-text">
                {PROFILE_MESSAGES.removeDialogTitle}
              </h2>
              <p id={removeDescId} className="text-sm leading-relaxed text-text-secondary">
                {PROFILE_MESSAGES.removeDialogBody(currentAlias)}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={removeAliasMutation.isPending}
                onClick={() => setRemoveDialogOpen(false)}
              >
                {PROFILE_MESSAGES.removeDialogCancel}
              </Button>
              <Button
                type="button"
                variant="danger"
                fullWidth
                loading={removeAliasMutation.isPending}
                loadingLabel={PROFILE_MESSAGES.removingAlias}
                onClick={() => void handleConfirmRemove()}
              >
                {PROFILE_MESSAGES.removeDialogConfirm}
              </Button>
            </div>
          </div>
        </ModalDialog>
      )}
    </>
  );
}
