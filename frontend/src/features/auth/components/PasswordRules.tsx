import { type PasswordRuleViolation, validatePasswordRules } from '@nova/shared';
import { Check, Circle, X } from 'lucide-react';

import { PASSWORD_RULE_MESSAGES, PASSWORD_RULE_STATUS_SR } from '../../../lib/messages.ts';

export interface PasswordRulesProps {
  id?: string;
  password: string;
  email: string;
  serverViolations?: readonly PasswordRuleViolation[];
  touched?: boolean;
}

type RuleStatus = 'idle' | 'valid' | 'invalid';

const BASE_RULES: readonly Exclude<PasswordRuleViolation, 'common'>[] = [
  'too_short',
  'too_long',
  'contains_email',
];

export function PasswordRules({
  id,
  password,
  email,
  serverViolations = [],
  touched = false,
}: PasswordRulesProps) {
  const clientViolations = validatePasswordRules(password, email);
  const activeViolations = new Set<PasswordRuleViolation>([
    ...clientViolations,
    ...serverViolations,
  ]);
  const hasInput = password.length > 0 || touched || serverViolations.length > 0;

  const rules: PasswordRuleViolation[] = serverViolations.includes('common')
    ? [...BASE_RULES, 'common']
    : [...BASE_RULES];

  return (
    <ul id={id} aria-live="polite" className="space-y-1.5 pt-1 text-sm">
      {rules.map((rule) => {
        const isViolated = activeViolations.has(rule);
        let status: RuleStatus = 'idle';
        if (hasInput) {
          status = isViolated ? 'invalid' : 'valid';
        }

        const colorClass =
          status === 'valid'
            ? 'text-success'
            : status === 'invalid'
              ? 'text-danger'
              : 'text-text-muted';

        return (
          <li
            key={rule}
            data-rule={rule}
            data-status={status}
            className={`flex items-start gap-2 transition-colors duration-[var(--duration-quick)] ${colorClass}`}
          >
            <span
              aria-hidden="true"
              className="t-icon-swap mt-0.5 h-4 w-4 shrink-0"
              data-state={status}
            >
              <Circle className="t-icon h-3.5 w-3.5 opacity-60" data-slot="idle" />
              <Check className="t-icon h-4 w-4" data-slot="valid" />
              <X className="t-icon h-4 w-4" data-slot="invalid" />
            </span>
            <span>
              {status !== 'idle' && (
                <span className="sr-only">{PASSWORD_RULE_STATUS_SR[status]}</span>
              )}
              {PASSWORD_RULE_MESSAGES[rule]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
