import {
  FullNameSchema,
  type PasswordRuleViolation,
  type SessionResponse,
  validatePasswordRules,
} from '@nova/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, type Ref, useId, useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { PasswordField } from '../../../components/PasswordField.tsx';
import { TextField } from '../../../components/TextField.tsx';
import { ApiError } from '../../../lib/api-client.ts';
import { REGISTER_MESSAGES, VALIDATION_MESSAGES } from '../../../lib/messages.ts';
import { completeRegistration } from '../api.ts';
import { PasswordRules } from '../components/PasswordRules.tsx';
import { SESSION_QUERY_KEY } from '../hooks/useSession.ts';

export interface ProfileStepProps {
  email: string;
  headingRef?: Ref<HTMLHeadingElement>;
  onCompleted: (session: SessionResponse) => void;
  onFlowExpired: (message: string) => void;
}

export function ProfileStep({ email, headingRef, onCompleted, onFlowExpired }: ProfileStepProps) {
  const queryClient = useQueryClient();
  const rulesId = useId();
  const [fullName, setFullName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [serverNameError, setServerNameError] = useState<string | undefined>(undefined);
  const [serverPasswordError, setServerPasswordError] = useState<string | undefined>(undefined);
  const [serverViolations, setServerViolations] = useState<PasswordRuleViolation[]>([]);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const mutation = useMutation<SessionResponse, ApiError, { fullName: string; password: string }>({
    mutationFn: completeRegistration,
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
      onCompleted(session);
    },
  });

  function validateNameField(raw: string): string | undefined {
    if (raw.trim().length === 0) return VALIDATION_MESSAGES.fullNameRequired;
    return FullNameSchema.safeParse(raw).success ? undefined : VALIDATION_MESSAGES.fullNameInvalid;
  }

  const liveNameError = nameTouched ? validateNameField(fullName) : undefined;
  const displayedNameError = serverNameError ?? liveNameError;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setNameTouched(true);
    setPasswordTouched(true);
    setFormError(undefined);
    setAlreadyRegistered(false);
    setServerNameError(undefined);
    setServerPasswordError(undefined);
    setServerViolations([]);

    const nameErr = validateNameField(fullName);
    const passwordViolations = validatePasswordRules(password, email);

    if (nameErr || passwordViolations.length > 0) {
      return;
    }

    try {
      await mutation.mutateAsync({ fullName: fullName.trim(), password });
    } catch (error) {
      if (!(error instanceof ApiError)) return;

      if (error.code === 'VERIFICATION_EXPIRED' || error.code === 'VERIFICATION_NOT_FOUND') {
        onFlowExpired(error.message);
        return;
      }

      if (error.code === 'PASSWORD_WEAK') {
        setServerViolations(error.details?.reasons ?? []);
        setServerPasswordError(error.message);
        return;
      }

      if (error.code === 'EMAIL_ALREADY_REGISTERED') {
        setAlreadyRegistered(true);
        setFormError(error.message);
        return;
      }

      if (error.code === 'VALIDATION_ERROR' && error.details?.fields) {
        if (error.details.fields.fullName) setServerNameError(error.details.fields.fullName);
        if (error.details.fields.password) setServerPasswordError(error.details.fields.password);
        if (!error.details.fields.fullName && !error.details.fields.password) {
          setFormError(error.message);
        }
        return;
      }

      setFormError(error.message);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-[-0.02em] text-text focus:outline-none"
        >
          {REGISTER_MESSAGES.step3Title}
        </h1>
        <p className="text-sm text-text-secondary">{REGISTER_MESSAGES.step3Subtitle}</p>
      </div>

      {formError && (
        <Alert
          variant={alreadyRegistered ? 'warning' : 'error'}
          action={
            alreadyRegistered ? (
              <Link
                to="/ingresar"
                className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] font-semibold underline"
              >
                {REGISTER_MESSAGES.goToLogin}
              </Link>
            ) : undefined
          }
        >
          {formError}
        </Alert>
      )}

      <TextField
        label={REGISTER_MESSAGES.fullNameLabel}
        name="fullName"
        autoComplete="name"
        placeholder={REGISTER_MESSAGES.fullNamePlaceholder}
        value={fullName}
        disabled={mutation.isPending}
        error={displayedNameError}
        onChange={(event) => {
          setFullName(event.target.value);
          setServerNameError(undefined);
        }}
        onBlur={() => setNameTouched(true)}
      />

      <div className="space-y-2">
        <PasswordField
          label={REGISTER_MESSAGES.passwordLabel}
          name="password"
          autoComplete="new-password"
          placeholder={REGISTER_MESSAGES.passwordPlaceholder}
          value={password}
          disabled={mutation.isPending}
          error={serverPasswordError}
          aria-describedby={rulesId}
          onChange={(event) => {
            setPassword(event.target.value);
            setServerPasswordError(undefined);
            setServerViolations([]);
          }}
          onBlur={() => setPasswordTouched(true)}
        />

        <PasswordRules
          id={rulesId}
          password={password}
          email={email}
          serverViolations={serverViolations}
          touched={passwordTouched}
        />
      </div>

      <Button
        type="submit"
        fullWidth
        loading={mutation.isPending}
        loadingLabel={REGISTER_MESSAGES.step3Submitting}
      >
        {REGISTER_MESSAGES.step3Submit}
      </Button>
    </form>
  );
}
