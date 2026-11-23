import {
  InstitutionalEmailSchema,
  normalizeEmail,
  type VerificationPurpose,
  type VerificationState,
} from '@nova/shared';
import { type FormEvent, type Ref, useState } from 'react';

import { Alert, type AlertVariant } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { TextField } from '../../../components/TextField.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import {
  LOGIN_MESSAGES,
  REGISTER_MESSAGES,
  RESET_MESSAGES,
  VALIDATION_MESSAGES,
} from '../../../lib/messages.ts';
import { ConsentCheckbox } from '../components/ConsentCheckbox.tsx';

export interface EmailStepProps {
  purpose: VerificationPurpose;
  initialEmail?: string;
  isSubmitting: boolean;
  banner?: { variant: AlertVariant; message: string } | null;
  headingRef?: Ref<HTMLHeadingElement>;
  onSubmit: (normalizedEmail: string) => Promise<VerificationState>;
  onSuccess: (state: VerificationState, normalizedEmail: string) => void;
}

export function EmailStep({
  purpose,
  initialEmail = '',
  isSubmitting,
  banner = null,
  headingRef,
  onSubmit,
  onSuccess,
}: EmailStepProps) {
  const isRegistration = purpose === 'registration';
  const [email, setEmail] = useState(initialEmail);
  const [emailTouched, setEmailTouched] = useState(false);
  const [acceptedConsent, setAcceptedConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | undefined>(undefined);
  const [serverEmailError, setServerEmailError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [shakeKey, setShakeKey] = useState(0);

  function validateEmailField(raw: string): string | undefined {
    if (raw.trim().length === 0) return VALIDATION_MESSAGES.emailRequired;
    const parsed = InstitutionalEmailSchema.safeParse(raw);
    return parsed.success ? undefined : VALIDATION_MESSAGES.emailInvalid;
  }

  const liveEmailError = emailTouched ? validateEmailField(email) : undefined;
  const displayedEmailError = serverEmailError ?? liveEmailError;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setEmailTouched(true);
    setFormError(undefined);
    setServerEmailError(undefined);

    const emailErr = validateEmailField(email);
    const missingConsent = isRegistration && !acceptedConsent;
    setConsentError(missingConsent ? VALIDATION_MESSAGES.consentRequired : undefined);

    if (emailErr || missingConsent) {
      if (emailErr) setShakeKey((prev) => prev + 1);
      return;
    }

    const normalized = normalizeEmail(email);
    try {
      const nextState = await onSubmit(normalized);
      onSuccess(nextState, normalized);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'DOMAIN_NOT_ALLOWED') {
          setServerEmailError(error.message);
          setShakeKey((prev) => prev + 1);
          return;
        }
        if (error.code === 'VALIDATION_ERROR' && error.details?.fields?.email) {
          setServerEmailError(error.details.fields.email);
          setShakeKey((prev) => prev + 1);
          return;
        }
        setFormError(error.message);
      }
    }
  }

  const title = isRegistration ? REGISTER_MESSAGES.step1Title : RESET_MESSAGES.step1Title;
  const subtitle = isRegistration ? REGISTER_MESSAGES.step1Subtitle : RESET_MESSAGES.step1Subtitle;
  const submitLabel = isRegistration ? REGISTER_MESSAGES.step1Submit : RESET_MESSAGES.step1Submit;
  const submittingLabel = isRegistration
    ? REGISTER_MESSAGES.step1Submitting
    : RESET_MESSAGES.step1Submitting;

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-[-0.025em] text-text focus:outline-none"
        >
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-text-secondary">{subtitle}</p>
      </div>

      {banner && <Alert variant={banner.variant}>{banner.message}</Alert>}
      {formError && <Alert variant="error">{formError}</Alert>}

      <TextField
        label={LOGIN_MESSAGES.emailLabel}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder={LOGIN_MESSAGES.emailPlaceholder}
        value={email}
        disabled={isSubmitting}
        error={displayedEmailError}
        shakeKey={shakeKey}
        onChange={(event) => {
          setEmail(event.target.value);
          setServerEmailError(undefined);
          if (emailTouched) setFormError(undefined);
        }}
        onBlur={() => setEmailTouched(true)}
      />

      {isRegistration && (
        <ConsentCheckbox
          checked={acceptedConsent}
          disabled={isSubmitting}
          error={consentError}
          onChange={(checked) => {
            setAcceptedConsent(checked);
            if (checked) setConsentError(undefined);
          }}
        />
      )}

      <Button type="submit" fullWidth loading={isSubmitting} loadingLabel={submittingLabel}>
        {submitLabel}
      </Button>
    </form>
  );
}
