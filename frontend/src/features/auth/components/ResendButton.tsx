import type { VerificationState } from '@nova/shared';
import { useMutation } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import { VERIFICATION_MESSAGES } from '../../../lib/messages.ts';

export interface ResendButtonProps {
  resendAvailableAt: string;
  prominent?: boolean;
  disabled?: boolean;
  onResent: (nextState: VerificationState) => void;
  onFlowLost?: (message: string) => void;
}

function secondsRemainingUntil(targetMs: number): number {
  return Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
}

function parseTimestamp(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function ResendButton({
  resendAvailableAt,
  prominent = false,
  disabled = false,
  onResent,
  onFlowLost,
}: ResendButtonProps) {
  const { authService } = useAuthServices();
  const [targetMs, setTargetMs] = useState<number>(() => parseTimestamp(resendAvailableAt));
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    secondsRemainingUntil(parseTimestamp(resendAvailableAt)),
  );
  const [feedback, setFeedback] = useState<{
    variant: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const nextTarget = parseTimestamp(resendAvailableAt);
    setTargetMs(nextTarget);
    setSecondsLeft(secondsRemainingUntil(nextTarget));
  }, [resendAvailableAt]);

  useEffect(() => {
    const initial = secondsRemainingUntil(targetMs);
    setSecondsLeft(initial);
    if (initial <= 0) return;

    const timer = setInterval(() => {
      const remaining = secondsRemainingUntil(targetMs);
      setSecondsLeft(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1_000);

    return () => clearInterval(timer);
  }, [targetMs]);

  const mutation = useMutation({
    mutationFn: () => authService.resendVerification(),
    onSuccess: (nextState) => {
      const nextTarget = parseTimestamp(nextState.resendAvailableAt);
      setTargetMs(nextTarget);
      setSecondsLeft(secondsRemainingUntil(nextTarget));
      setFeedback({ variant: 'success', message: VERIFICATION_MESSAGES.resendSuccess });
      onResent(nextState);
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) return;

      if (error.code === 'VERIFICATION_NOT_FOUND') {
        onFlowLost?.(error.message);
        return;
      }

      if (error.code === 'RESEND_TOO_SOON') {
        const waitSeconds = error.retryAfterSeconds ?? 60;
        const nextTarget = Date.now() + waitSeconds * 1000;
        setTargetMs(nextTarget);
        setSecondsLeft(waitSeconds);
        setFeedback({ variant: 'warning', message: error.message });
        return;
      }

      if (error.code === 'CODE_SEND_LIMIT' || error.code === 'RATE_LIMITED') {
        setFeedback({ variant: 'warning', message: error.message });
        return;
      }

      setFeedback({ variant: 'error', message: error.message });
    },
  });

  const isCoolingDown = secondsLeft > 0;
  const label = isCoolingDown
    ? VERIFICATION_MESSAGES.resendCountdown(secondsLeft)
    : prominent
      ? VERIFICATION_MESSAGES.resendProminent
      : VERIFICATION_MESSAGES.resendButton;

  return (
    <div className="w-full space-y-2.5">
      {feedback && <Alert variant={feedback.variant}>{feedback.message}</Alert>}

      <Button
        type="button"
        variant={prominent ? 'primary' : 'secondary'}
        fullWidth
        disabled={disabled || isCoolingDown}
        loading={mutation.isPending}
        loadingLabel={VERIFICATION_MESSAGES.resending}
        data-prominent={prominent ? 'true' : undefined}
        className="tabular-nums"
        onClick={() => {
          setFeedback(null);
          mutation.mutate();
        }}
      >
        {!mutation.isPending && <RefreshCw aria-hidden="true" className="h-4 w-4 shrink-0" />}
        <span>{label}</span>
      </Button>
    </div>
  );
}
