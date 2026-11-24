import { CODE_LENGTH, type VerificationPurpose, type VerificationState } from '@nova/shared';
import { type FormEvent, type Ref, useState } from 'react';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import {
  REGISTER_MESSAGES,
  RESET_MESSAGES,
  VALIDATION_MESSAGES,
  VERIFICATION_MESSAGES,
} from '../../../lib/messages.ts';
import { CodeInput } from '../components/CodeInput.tsx';
import { ResendButton } from '../components/ResendButton.tsx';

export interface CodeStepProps {
  purpose: VerificationPurpose;
  state: VerificationState;
  isVerifying: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  onVerify: (code: string) => Promise<VerificationState>;
  onUseAnotherEmail: () => void;
  onFlowLost: (message: string) => void;
  onStateUpdated?: (nextState: VerificationState) => void;
}

export function CodeStep({
  purpose,
  state,
  isVerifying,
  headingRef,
  onVerify,
  onUseAnotherEmail,
  onFlowLost,
  onStateUpdated,
}: CodeStepProps) {
  const isRegistration = purpose === 'registration';
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>(undefined);
  const [errorKey, setErrorKey] = useState(0);
  const [bannerError, setBannerError] = useState<string | undefined>(undefined);
  const [highlightResend, setHighlightResend] = useState(state.attemptsLeft <= 0);

  async function submitCode(candidate: string): Promise<void> {
    if (isVerifying) return;
    setBannerError(undefined);
    setCodeError(undefined);

    if (candidate.length !== CODE_LENGTH) {
      setCodeError(VALIDATION_MESSAGES.codeIncomplete);
      setErrorKey((prev) => prev + 1);
      return;
    }

    try {
      await onVerify(candidate);
    } catch (error) {
      if (!(error instanceof ApiError)) return;

      if (error.code === 'VERIFICATION_NOT_FOUND') {
        onFlowLost(error.message);
        return;
      }

      if (error.code === 'CODE_INVALID') {
        setCodeError(error.message);
        setErrorKey((prev) => prev + 1);
        if (error.details?.attemptsLeft === 0) {
          setHighlightResend(true);
        }
        return;
      }

      if (error.code === 'CODE_EXPIRED' || error.code === 'CODE_ATTEMPTS_EXHAUSTED') {
        setHighlightResend(true);
        setBannerError(error.message);
        return;
      }

      setBannerError(error.message);
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitCode(code);
  }

  const title = isRegistration ? REGISTER_MESSAGES.step2Title : RESET_MESSAGES.step2Title;
  const subtitle = isRegistration ? REGISTER_MESSAGES.step2Subtitle : RESET_MESSAGES.step2Subtitle;

  return (
    <form onSubmit={handleFormSubmit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-[-0.025em] text-text focus:outline-none"
        >
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-text-secondary">
          {subtitle} <strong className="font-semibold text-text">{state.maskedEmail}</strong>.
        </p>
      </div>

      {bannerError && <Alert variant={highlightResend ? 'warning' : 'error'}>{bannerError}</Alert>}

      <CodeInput
        value={code}
        disabled={isVerifying}
        error={codeError}
        errorKey={errorKey}
        onChange={(next) => {
          setCode(next);
          if (codeError) setCodeError(undefined);
        }}
        onComplete={(completed) => {
          void submitCode(completed);
        }}
      />

      <Button
        type="submit"
        variant={highlightResend ? 'secondary' : 'primary'}
        fullWidth
        loading={isVerifying}
        loadingLabel={VERIFICATION_MESSAGES.verifying}
      >
        {VERIFICATION_MESSAGES.verifySubmit}
      </Button>

      <div className="flex flex-col items-center gap-2 border-t border-border pt-4">
        <ResendButton
          resendAvailableAt={state.resendAvailableAt}
          prominent={highlightResend}
          disabled={isVerifying}
          onFlowLost={onFlowLost}
          onResent={(nextState) => {
            setCode('');
            setCodeError(undefined);
            setBannerError(undefined);
            setHighlightResend(false);
            onStateUpdated?.(nextState);
          }}
        />

        <Button variant="ghost" type="button" disabled={isVerifying} onClick={onUseAnotherEmail}>
          {VERIFICATION_MESSAGES.useAnotherEmail}
        </Button>
      </div>
    </form>
  );
}
