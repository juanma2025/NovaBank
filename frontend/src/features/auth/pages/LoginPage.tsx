import { LoginRequestSchema, normalizeEmail } from '@nova/shared';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AuthLayout } from '../../../components/AuthLayout.tsx';
import { Button } from '../../../components/Button.tsx';
import { PasswordField } from '../../../components/PasswordField.tsx';
import { TextField } from '../../../components/TextField.tsx';
import { ApiError } from '../../../lib/api-client.ts';
import {
  AUTH_REASON_BANNERS,
  isAuthNoticeReason,
  LOGIN_MESSAGES,
  VALIDATION_MESSAGES,
} from '../../../lib/messages.ts';
import { safeRedirect } from '../../../lib/safe-redirect.ts';
import { useLogin } from '../hooks/useLogin.ts';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginMutation = useLogin();

  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [serverEmailError, setServerEmailError] = useState<string | undefined>(undefined);
  const [serverPasswordError, setServerPasswordError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<{
    variant: 'error' | 'warning';
    message: string;
  } | null>(null);
  const [dismissNotice, setDismissNotice] = useState(false);

  const motivoParam = searchParams.get('motivo');
  const reasonBanner =
    !dismissNotice && isAuthNoticeReason(motivoParam) ? AUTH_REASON_BANNERS[motivoParam] : null;
  const redirectTarget = safeRedirect(searchParams.get('redirect'), '/inicio');

  function validateEmailField(raw: string): string | undefined {
    if (raw.trim().length === 0) return VALIDATION_MESSAGES.emailRequired;
    return LoginRequestSchema.shape.email.safeParse(raw).success
      ? undefined
      : VALIDATION_MESSAGES.emailInvalid;
  }

  function validatePasswordField(raw: string): string | undefined {
    return raw.length === 0 ? VALIDATION_MESSAGES.passwordRequired : undefined;
  }

  const displayedEmailError =
    serverEmailError ?? (emailTouched ? validateEmailField(email) : undefined);
  const displayedPasswordError =
    serverPasswordError ?? (passwordTouched ? validatePasswordField(password) : undefined);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);
    setDismissNotice(true);
    setFormError(null);
    setServerEmailError(undefined);
    setServerPasswordError(undefined);

    const emailErr = validateEmailField(email);
    const passwordErr = validatePasswordField(password);
    if (emailErr || passwordErr) return;

    try {
      await loginMutation.mutateAsync({
        email: normalizeEmail(email),
        password,
      });
      void navigate(redirectTarget, { replace: true });
    } catch (error) {
      if (!(error instanceof ApiError)) return;

      if (error.code === 'LOGIN_LOCKED') {
        setFormError({ variant: 'warning', message: error.message });
        return;
      }

      if (error.code === 'VALIDATION_ERROR' && error.details?.fields) {
        if (error.details.fields.email) setServerEmailError(error.details.fields.email);
        if (error.details.fields.password) setServerPasswordError(error.details.fields.password);
        if (!error.details.fields.email && !error.details.fields.password) {
          setFormError({ variant: 'error', message: error.message });
        }
        return;
      }

      setFormError({ variant: 'error', message: error.message });
    }
  }

  const footer = (
    <p>
      {LOGIN_MESSAGES.noAccountPrompt}{' '}
      <Link
        to="/registro"
        className="font-semibold text-brand-text underline transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
      >
        {LOGIN_MESSAGES.createAccount}
      </Link>
    </p>
  );

  return (
    <AuthLayout footer={footer}>
      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-text">
            {LOGIN_MESSAGES.title}
          </h1>
          <p className="text-sm text-text-secondary">{LOGIN_MESSAGES.subtitle}</p>
        </div>

        {reasonBanner && (
          <Alert variant={reasonBanner.variant} title={reasonBanner.title}>
            {reasonBanner.body}
          </Alert>
        )}

        {formError && <Alert variant={formError.variant}>{formError.message}</Alert>}

        <TextField
          label={LOGIN_MESSAGES.emailLabel}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={LOGIN_MESSAGES.emailPlaceholder}
          value={email}
          disabled={loginMutation.isPending}
          error={displayedEmailError}
          onChange={(event) => {
            setEmail(event.target.value);
            setServerEmailError(undefined);
          }}
          onBlur={() => setEmailTouched(true)}
        />

        <PasswordField
          label={LOGIN_MESSAGES.passwordLabel}
          name="password"
          autoComplete="current-password"
          placeholder={LOGIN_MESSAGES.passwordPlaceholder}
          value={password}
          disabled={loginMutation.isPending}
          error={displayedPasswordError}
          onChange={(event) => {
            setPassword(event.target.value);
            setServerPasswordError(undefined);
          }}
          onBlur={() => setPasswordTouched(true)}
        />

        <Button
          type="submit"
          fullWidth
          loading={loginMutation.isPending}
          loadingLabel={LOGIN_MESSAGES.submitting}
        >
          {LOGIN_MESSAGES.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
