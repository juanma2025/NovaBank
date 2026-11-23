import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Alert, type AlertVariant } from '../../../components/Alert.tsx';
import { AuthLayout } from '../../../components/AuthLayout.tsx';
import { Button } from '../../../components/Button.tsx';
import { Spinner } from '../../../components/Spinner.tsx';
import { APP_MESSAGES, REGISTER_MESSAGES } from '../../../lib/messages.ts';
import { StepProgress } from '../components/StepProgress.tsx';
import { useVerification } from '../hooks/useVerification.ts';
import { CodeStep } from '../steps/CodeStep.tsx';
import { EmailStep } from '../steps/EmailStep.tsx';
import { ProfileStep } from '../steps/ProfileStep.tsx';

type RegisterStep = 'email' | 'code' | 'profile';
type SlideDirection = 'none' | 'forward' | 'backward';

const STEP_INDEX: Record<RegisterStep, number> = {
  email: 1,
  code: 2,
  profile: 3,
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { query, startMutation, verifyMutation, setVerificationState } =
    useVerification('registration');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [banner, setBanner] = useState<{ variant: AlertVariant; message: string } | null>(null);
  const [direction, setDirection] = useState<SlideDirection>('none');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<RegisterStep | null>(null);

  const verification = query.data ?? null;
  const activeStep: RegisterStep = !verification
    ? 'email'
    : verification.step === 'complete'
      ? 'profile'
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
      {REGISTER_MESSAGES.hasAccountPrompt}{' '}
      <Link
        to="/ingresar"
        className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-1 font-semibold text-brand-text underline transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
      >
        {REGISTER_MESSAGES.goToLogin}
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
                purpose="registration"
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
                purpose="registration"
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

            {activeStep === 'profile' && (
              <ProfileStep
                email={submittedEmail}
                headingRef={headingRef}
                onCompleted={() => {
                  setVerificationState(null);
                  void navigate('/inicio', { replace: true });
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
