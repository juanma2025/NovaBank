import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Alert, type AlertVariant } from '../../../components/Alert.tsx';
import { AuthLayout } from '../../../components/AuthLayout.tsx';
import { Button } from '../../../components/Button.tsx';
import { Spinner } from '../../../components/Spinner.tsx';
import { APP_MESSAGES } from '../../../lib/messages.ts';
import { StepProgress } from '../components/StepProgress.tsx';
import { useVerification } from '../hooks/useVerification.ts';
import { CodeStep } from '../steps/CodeStep.tsx';
import { EmailStep } from '../steps/EmailStep.tsx';
import { NewPasswordStep } from '../steps/NewPasswordStep.tsx';

type ResetStep = 'email' | 'code' | 'password';
type SlideDirection = 'none' | 'forward' | 'backward';

const STEP_INDEX: Record<ResetStep, number> = {
  email: 1,
  code: 2,
  password: 3,
};

export default function PasswordResetPage() {
  const navigate = useNavigate();
  const { query, startMutation, verifyMutation, setVerificationState } =
    useVerification('password_reset');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [banner, setBanner] = useState<{ variant: AlertVariant; message: string } | null>(null);
  const [direction, setDirection] = useState<SlideDirection>('none');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<ResetStep | null>(null);

  const verification = query.data ?? null;
  const activeStep: ResetStep = !verification
    ? 'email'
    : verification.step === 'complete'
      ? 'password'
      : 'code';

  useEffect(() => {
    if (query.isPending || query.isError) return;
    if (previousStepRef.current !== null && previousStepRef.current !== activeStep) {
      headingRef.current?.focus();
    }
    previousStepRef.current = activeStep;
  }, [activeStep, query.isPending, query.isError]);

  const footer = (
    <p>
      <Link
        to="/ingresar"
        className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-1 font-semibold text-brand-text underline transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
      >
        {APP_MESSAGES.backToLogin}
      </Link>
    </p>
  );

  if (query.isPending) {
    return (
      <AuthLayout footer={footer}>
        <div className="flex min-h-48 flex-col items-center justify-center gap-3">
          <Spinner size="md" label={APP_MESSAGES.loadingPage} className="text-brand" />
        </div>
      </AuthLayout>
    );
  }

  if (query.isError) {
    return (
      <AuthLayout footer={footer}>
        <Alert
          variant="error"
          action={
            <Button
              variant="secondary"
              loading={query.isFetching}
              onClick={() => {
                void query.refetch();
              }}
            >
              {APP_MESSAGES.retry}
            </Button>
          }
        >
          {query.error.message}
        </Alert>
      </AuthLayout>
    );
  }

  const currentNumber = STEP_INDEX[activeStep];

  return (
    <AuthLayout footer={footer}>
      <div className="space-y-6">
        <StepProgress currentStep={currentNumber} totalSteps={3} />

        <div
          className="t-page-slide"
          data-page={currentNumber}
          data-direction={direction === 'none' ? undefined : direction}
        >
          <div key={activeStep} className="t-page">
            {activeStep === 'email' && (
              <EmailStep
                purpose="password_reset"
                initialEmail={submittedEmail}
                isSubmitting={startMutation.isPending}
                banner={banner}
                headingRef={headingRef}
                onSubmit={(email) => startMutation.mutateAsync({ email })}
                onSuccess={(_state, email) => {
                  setDirection('forward');
                  setSubmittedEmail(email);
                  setBanner(null);
                }}
              />
            )}

            {activeStep === 'code' && verification && (
              <CodeStep
                purpose="password_reset"
                state={verification}
                isVerifying={verifyMutation.isPending}
                headingRef={headingRef}
                onVerify={async (code) => {
                  setDirection('forward');
                  return verifyMutation.mutateAsync({ code });
                }}
                onUseAnotherEmail={() => {
                  setDirection('backward');
                  setBanner(null);
                  setVerificationState(null);
                }}
                onFlowLost={(message) => {
                  setDirection('backward');
                  setBanner({ variant: 'warning', message });
                  setVerificationState(null);
                }}
                onStateUpdated={(nextState) => setVerificationState(nextState)}
              />
            )}

            {activeStep === 'password' && (
              <NewPasswordStep
                email={submittedEmail}
                headingRef={headingRef}
                onCompleted={() => {
                  setVerificationState(null);
                  void navigate('/ingresar?motivo=clave-cambiada', { replace: true });
                }}
                onFlowExpired={(message) => {
                  setDirection('backward');
                  setBanner({ variant: 'warning', message });
                  setVerificationState(null);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
