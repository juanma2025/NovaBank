import { type PasswordRuleViolation, validatePasswordRules } from '@nova/shared';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, type Ref, useId, useState } from 'react';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { PasswordField } from '../../../components/PasswordField.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import { RESET_MESSAGES } from '../../../lib/messages.ts';
import { PasswordRules } from '../components/PasswordRules.tsx';

export interface NewPasswordStepProps {
  email: string;
  headingRef?: Ref<HTMLHeadingElement>;
  onCompleted: () => void;
  onFlowExpired: (message: string) => void;
}

export function NewPasswordStep({
  email,
  headingRef,
  onCompleted,
  onFlowExpired,
}: NewPasswordStepProps) {
  const { authService } = useAuthServices();
  const rulesId = useId();
  const [password, setPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [serverPasswordError, setServerPasswordError] = useState<string | undefined>(undefined);
  const [serverViolations, setServerViolations] = useState<PasswordRuleViolation[]>([]);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [shakeKey, setShakeKey] = useState(0);

  const mutation = useMutation({
    mutationFn: (newPassword: string) =>
      authService.completePasswordReset({ password: newPassword }),
    onSuccess: () => {
      onCompleted();
    },
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPasswordTouched(true);
    setFormError(undefined);
    setServerPasswordError(undefined);
    setServerViolations([]);

    const violations = validatePasswordRules(password, email);
    if (violations.length > 0) {
      setShakeKey((prev) => prev + 1);
      return;
    }

    try {
      await mutation.mutateAsync(password);
    } catch (error) {
      if (!(error instanceof ApiError)) return;

      if (error.code === 'VERIFICATION_EXPIRED' || error.code === 'VERIFICATION_NOT_FOUND') {
        onFlowExpired(error.message);
        return;
      }

      if (error.code === 'PASSWORD_WEAK') {
        setServerViolations(error.details?.reasons ?? []);
        setServerPasswordError(error.message);
        setShakeKey((prev) => prev + 1);
        return;
      }

      if (error.code === 'VALIDATION_ERROR' && error.details?.fields?.password) {
        setServerPasswordError(error.details.fields.password);
        setShakeKey((prev) => prev + 1);
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
          className="text-2xl font-semibold tracking-[-0.025em] text-text focus:outline-none"
        >
          {RESET_MESSAGES.step3Title}
        </h1>
        <p className="text-sm leading-relaxed text-text-secondary">
          {RESET_MESSAGES.step3Subtitle}
        </p>
      </div>

      {formError && <Alert variant="error">{formError}</Alert>}

      <div className="space-y-2">
        <PasswordField
          label={RESET_MESSAGES.passwordLabel}
          name="password"
          autoComplete="new-password"
          placeholder={RESET_MESSAGES.passwordPlaceholder}
          value={password}
          disabled={mutation.isPending}
          error={serverPasswordError}
          shakeKey={shakeKey}
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
        loadingLabel={RESET_MESSAGES.step3Submitting}
      >
        {RESET_MESSAGES.step3Submit}
      </Button>
    </form>
  );
}
