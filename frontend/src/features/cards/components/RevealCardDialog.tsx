import { CARD_SECRETS_VISIBLE_SECONDS, type CardSecrets } from '@nova/shared';
import { Check, Copy, ShieldCheck } from 'lucide-react';
import { type FormEvent, useEffect, useId, useState } from 'react';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { ModalDialog } from '../../../components/ModalDialog.tsx';
import { PasswordField } from '../../../components/PasswordField.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import { CARDS_MESSAGES } from '../../../lib/messages.ts';
import { formatCardExpiry, formatCardNumberGroups } from '../utils/card-expiry.ts';

export interface RevealCardDialogProps {
  open: boolean;
  cardId: string;
  onClose: () => void;
}

/**
 * Diálogo de revelación de datos sensibles de tarjeta (spec 004, T023, FR-008 y FR-009).
 * Los secretos viven exclusivamente en estado local (`useState`), nunca en TanStack Query,
 * `localStorage` ni logs, y se borran a los 60 s, al cerrar o al desmontar.
 */
export function RevealCardDialog({ open, cardId, onClose }: RevealCardDialogProps) {
  const { cardService } = useAuthServices();
  const titleId = useId();
  const descriptionId = useId();

  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [serverError, setServerError] = useState<string | undefined>(undefined);
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [secrets, setSecrets] = useState<CardSecrets | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(CARD_SECRETS_VISIBLE_SECONDS);
  const [copied, setCopied] = useState(false);

  // Limpia secretos y contraseña al cerrar el diálogo o al desmontar el componente.
  useEffect(() => {
    if (!open) {
      setSecrets(null);
      setPassword('');
      setPasswordError(undefined);
      setServerError(undefined);
      setLocked(false);
      setCopied(false);
      setSecondsLeft(CARD_SECRETS_VISIBLE_SECONDS);
    }
    return () => {
      setSecrets(null);
      setPassword('');
    };
  }, [open]);

  // Cuenta regresiva de 60 s mientras los datos están visibles (FR-009).
  useEffect(() => {
    if (!secrets) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setSecrets(null);
          return CARD_SECRETS_VISIBLE_SECONDS;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => clearInterval(timer);
  }, [secrets]);

  async function handleReveal(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;

    if (password.length === 0) {
      setPasswordError(CARDS_MESSAGES.revealPasswordRequired);
      setShakeKey((prev) => prev + 1);
      return;
    }

    setSubmitting(true);
    setPasswordError(undefined);
    setServerError(undefined);

    try {
      const revealed = await cardService.revealCard(cardId, password);
      setPassword('');
      setSecondsLeft(CARD_SECRETS_VISIBLE_SECONDS);
      setSecrets(revealed);
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.message);
        setLocked(error.code === 'REAUTH_LOCKED');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyNumber(): Promise<void> {
    if (!secrets) return;
    try {
      await navigator.clipboard.writeText(secrets.number);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <ModalDialog
      open={open}
      titleId={titleId}
      descriptionId={descriptionId}
      maxWidthClass="max-w-md"
      preventClose={submitting}
      onClose={onClose}
    >
      {secrets ? (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <h2 id={titleId} className="text-xl font-semibold tracking-[-0.025em] text-text">
              {CARDS_MESSAGES.revealTitle}
            </h2>
            <p
              id={descriptionId}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-text tabular-nums"
            >
              <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{CARDS_MESSAGES.revealCountdown(secondsLeft)}</span>
            </p>
          </div>

          <dl className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface-subtle/65 p-4">
            <div className="space-y-1">
              <dt className="text-xs font-medium text-text-secondary">
                {CARDS_MESSAGES.revealNumberLabel}
              </dt>
              <dd className="text-lg font-semibold tracking-[0.12em] text-text tabular-nums">
                {formatCardNumberGroups(secrets.number)}
              </dd>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
              <div className="space-y-0.5">
                <dt className="text-xs font-medium text-text-secondary">
                  {CARDS_MESSAGES.revealExpiryLabel}
                </dt>
                <dd className="text-base font-semibold text-text tabular-nums">
                  {formatCardExpiry(secrets.expMonth, secrets.expYear)}
                </dd>
              </div>

              <div className="space-y-0.5">
                <dt className="text-xs font-medium text-text-secondary">
                  {CARDS_MESSAGES.revealCvvLabel}
                </dt>
                <dd className="text-base font-semibold text-text tabular-nums">{secrets.cvv}</dd>
              </div>
            </div>
          </dl>

          <div className="flex flex-col gap-2.5 border-t border-border pt-4 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => void handleCopyNumber()}
            >
              {copied ? (
                <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-success" />
              ) : (
                <Copy aria-hidden="true" className="h-4 w-4 shrink-0" />
              )}
              <span>{copied ? CARDS_MESSAGES.revealCopied : CARDS_MESSAGES.revealCopyNumber}</span>
            </Button>

            <Button type="button" fullWidth onClick={onClose}>
              {CARDS_MESSAGES.revealClose}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={(event) => void handleReveal(event)} noValidate className="space-y-5">
          <div className="space-y-1.5">
            <h2 id={titleId} className="text-xl font-semibold tracking-[-0.025em] text-text">
              {CARDS_MESSAGES.revealTitle}
            </h2>
            <p id={descriptionId} className="text-sm leading-relaxed text-text-secondary">
              {CARDS_MESSAGES.revealSubtitle}
            </p>
          </div>

          <PasswordField
            label={CARDS_MESSAGES.revealPasswordLabel}
            name="revealCardPassword"
            autoComplete="current-password"
            placeholder={CARDS_MESSAGES.revealPasswordPlaceholder}
            value={password}
            disabled={submitting || locked}
            error={passwordError}
            shakeKey={shakeKey}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(undefined);
            }}
          />

          {serverError && <Alert variant={locked ? 'warning' : 'error'}>{serverError}</Alert>}

          <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={submitting}
              onClick={onClose}
            >
              {CARDS_MESSAGES.dialogCancel}
            </Button>
            <Button
              type="submit"
              fullWidth
              disabled={locked}
              loading={submitting}
              loadingLabel={CARDS_MESSAGES.revealSubmitting}
            >
              {CARDS_MESSAGES.revealSubmit}
            </Button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
}
