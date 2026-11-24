import { LoginRequestSchema, normalizeEmail } from '@nova/shared';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AuthLayout } from '../../../components/AuthLayout.tsx';
import { Button } from '../../../components/Button.tsx';
import { PasswordField } from '../../../components/PasswordField.tsx';
import { TextField } from '../../../components/TextField.tsx';
import { ApiError } from '../../../lib/http-client.ts';
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
  const [fieldShakeKey, setFieldShakeKey] = useState(0);
  const [credentialsShakeKey, setCredentialsShakeKey] = useState(0);
  const [credentialsShaking, setCredentialsShaking] = useState(false);
  const credentialsGroupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (credentialsShakeKey <= 0) return;
    setCredentialsShaking(false);
    void credentialsGroupRef.current?.offsetWidth;
    setCredentialsShaking(true);
    const timer = setTimeout(() => setCredentialsShaking(false), 260);
    return () => clearTimeout(timer);
  }, [credentialsShakeKey]);

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
    if (emailErr || passwordErr) {
      setFieldShakeKey((prev) => prev + 1);
      return;
    }

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

      if (error.code === 'INVALID_CREDENTIALS') {
        setFormError({ variant: 'error', message: error.message });
        setCredentialsShakeKey((prev) => prev + 1);
        return;
      }

      if (error.code === 'VALIDATION_ERROR' && error.details?.fields) {
        if (error.details.fields.email) setServerEmailError(error.details.fields.email);
        if (error.details.fields.password) setServerPasswordError(error.details.fields.password);
        if (!error.details.fields.email && !error.details.fields.password) {
          setFormError({ variant: 'error', message: error.message });
        }
        setFieldShakeKey((prev) => prev + 1);
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
        className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-1 font-semibold text-brand-text underline transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
      >
        {LOGIN_MESSAGES.createAccount}
      </Link>
    </p>
  );

  return (
    <AuthLayout footer={footer}>
      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-text">
            {LOGIN_MESSAGES.title}
          </h1>
          <p className="text-sm leading-relaxed text-text-secondary">{LOGIN_MESSAGES.subtitle}</p>
        </div>

        {reasonBanner && (
          <Alert variant={reasonBanner.variant} title={reasonBanner.title}>
            {reasonBanner.body}
          </Alert>
        )}

        {formError && <Alert variant={formError.variant}>{formError.message}</Alert>}

        <div
          ref={credentialsGroupRef}
          className={`t-input-wrap space-y-4 ${credentialsShaking ? 'is-shaking' : ''}`}
        >
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
            shakeKey={fieldShakeKey}
            onChange={(event) => {
              setEmail(event.target.value);
              setServerEmailError(undefined);
            }}
            onBlur={() => setEmailTouched(true)}
          />

          <div className="space-y-1">
            <PasswordField
              label={LOGIN_MESSAGES.passwordLabel}
              name="password"
              autoComplete="current-password"
              placeholder={LOGIN_MESSAGES.passwordPlaceholder}
              value={password}
              disabled={loginMutation.isPending}
              error={displayedPasswordError}
              shakeKey={fieldShakeKey}
              onChange={(event) => {
                setPassword(event.target.value);
                setServerPasswordError(undefined);
              }}
              onBlur={() => setPasswordTouched(true)}
            />
            <div className="flex justify-end">
              <Link
                to="/recuperar"
                className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-1 text-sm font-medium text-brand-text underline transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
              >
                {LOGIN_MESSAGES.forgotPassword}
              </Link>
            </div>
          </div>
        </div>

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
