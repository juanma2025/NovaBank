import { CARD_NICKNAME_MAX_LENGTH, CardNicknameRequestSchema } from '@nova/shared';
import { type FormEvent, useEffect, useId, useState } from 'react';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { ModalDialog } from '../../../components/ModalDialog.tsx';
import { TextField } from '../../../components/TextField.tsx';
import { CARDS_MESSAGES } from '../../../lib/messages.ts';

export interface CardNicknameDialogProps {
  open: boolean;
  mode: 'create' | 'rename';
  initialNickname?: string;
  isSubmitting: boolean;
  serverError?: string;
  onSubmit: (nickname: string) => void;
  onCancel: () => void;
}

export function CardNicknameDialog({
  open,
  mode,
  initialNickname = '',
  isSubmitting,
  serverError,
  onSubmit,
  onCancel,
}: CardNicknameDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [nickname, setNickname] = useState(initialNickname);
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (open) {
      setNickname(initialNickname);
      setLocalError(undefined);
    }
  }, [open, initialNickname]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmed = nickname.trim();
    if (trimmed.length === 0) {
      setLocalError(CARDS_MESSAGES.nicknameRequired);
      setShakeKey((prev) => prev + 1);
      return;
    }

    const parsed = CardNicknameRequestSchema.safeParse({ nickname: trimmed });
    if (!parsed.success) {
      setLocalError(CARDS_MESSAGES.nicknameTooLong(CARD_NICKNAME_MAX_LENGTH));
      setShakeKey((prev) => prev + 1);
      return;
    }

    setLocalError(undefined);
    onSubmit(parsed.data.nickname);
  }

  const isCreate = mode === 'create';

  return (
    <ModalDialog
      open={open}
      titleId={titleId}
      descriptionId={descriptionId}
      maxWidthClass="max-w-sm"
      preventClose={isSubmitting}
      onClose={onCancel}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <h2 id={titleId} className="text-xl font-semibold tracking-[-0.025em] text-text">
            {isCreate ? CARDS_MESSAGES.nicknameCreateTitle : CARDS_MESSAGES.nicknameRenameTitle}
          </h2>
          <p id={descriptionId} className="text-sm leading-relaxed text-text-secondary">
            {isCreate
              ? CARDS_MESSAGES.nicknameCreateSubtitle
              : CARDS_MESSAGES.nicknameRenameSubtitle}
          </p>
        </div>

        <TextField
          label={CARDS_MESSAGES.nicknameLabel}
          name="cardNickname"
          placeholder={CARDS_MESSAGES.nicknamePlaceholder}
          maxLength={CARD_NICKNAME_MAX_LENGTH}
          value={nickname}
          disabled={isSubmitting}
          error={localError}
          shakeKey={shakeKey}
          onChange={(event) => {
            setNickname(event.target.value);
            setLocalError(undefined);
          }}
        />

        {serverError && <Alert variant="error">{serverError}</Alert>}

        <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={isSubmitting}
            onClick={onCancel}
          >
            {CARDS_MESSAGES.dialogCancel}
          </Button>
          <Button
            type="submit"
            fullWidth
            loading={isSubmitting}
            loadingLabel={
              isCreate ? CARDS_MESSAGES.nicknameCreating : CARDS_MESSAGES.nicknameRenaming
            }
          >
            {isCreate ? CARDS_MESSAGES.nicknameCreateSubmit : CARDS_MESSAGES.nicknameRenameSubmit}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
