import { VERIFICATION_MESSAGES } from '../../../lib/messages.ts';

export interface StepProgressProps {
  currentStep: number;
  totalSteps?: number;
}

export function StepProgress({ currentStep, totalSteps = 3 }: StepProgressProps) {
  const steps = Array.from({ length: totalSteps }, (_, index) => index + 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-text-muted tabular-nums">
        <span>{VERIFICATION_MESSAGES.stepProgress(currentStep, totalSteps)}</span>
        <span aria-hidden="true">{Math.round((currentStep / totalSteps) * 100)}%</span>
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {steps.map((step) => (
          <span
            key={step}
            className={`h-1.5 rounded-[var(--radius-pill)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] ${
              step <= currentStep ? 'bg-brand' : 'bg-border'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
