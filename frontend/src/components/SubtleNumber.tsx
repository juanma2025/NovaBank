import { formatCOP } from '@nova/shared';
import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { MASKED_AMOUNT } from '../features/accounts/services/movement-presenter.ts';
import { SoftSwapText } from './SoftSwapText.tsx';

export interface SubtleNumberProps {
  value: number;
  hidden?: boolean;
  hiddenAriaLabel?: string;
  className?: string;
}

interface TransitionDiff {
  prevText: string;
  nextText: string;
  direction: 1 | -1;
}

/**
 * Muestra un monto en COP entero con `formatCOP`.
 * - Al ocultarse/mostrarse usa `34-text-swap-soft` (retira los dígitos del DOM al instante).
 * - Cuando el monto cambia en vivo (ej. tras una recarga) aplica `36-number-subtle-change` (≤ 400 ms).
 */
export function SubtleNumber({
  value,
  hidden = false,
  hiddenAriaLabel,
  className = '',
}: SubtleNumberProps) {
  const formatted = formatCOP(value);
  const prevValueRef = useRef<number | null>(null);
  const [diff, setDiff] = useState<TransitionDiff | null>(null);

  useEffect(() => {
    const previous = prevValueRef.current;
    prevValueRef.current = value;

    if (hidden || previous === null || previous === value) {
      setDiff(null);
      return;
    }

    setDiff({
      prevText: formatCOP(previous),
      nextText: formatCOP(value),
      direction: value >= previous ? 1 : -1,
    });

    const timer = setTimeout(() => setDiff(null), 400);
    return () => clearTimeout(timer);
  }, [hidden, value]);

  if (hidden) {
    return <SoftSwapText text={MASKED_AMOUNT} ariaLabel={hiddenAriaLabel} className={className} />;
  }

  if (!diff) {
    return <SoftSwapText text={formatted} className={`tabular-nums ${className}`} />;
  }

  const sameLength = diff.prevText.length === diff.nextText.length;
  const style = { '--subtle-dir': diff.direction } as CSSProperties;

  return (
    <span
      className={`t-subtle-number is-animating ${className}`}
      style={style}
      aria-label={diff.nextText}
    >
      {[...diff.nextText].map((char, index) => {
        const prevChar = diff.prevText[index];
        if (sameLength && prevChar === char) {
          return <span key={`same-${index}`}>{char}</span>;
        }
        return (
          <span key={`diff-${index}`} className="t-subtle-slot">
            {sameLength && prevChar !== undefined && (
              <span className="t-subtle-old" aria-hidden="true">
                {prevChar}
              </span>
            )}
            <span className="t-subtle-new">{char}</span>
          </span>
        );
      })}
    </span>
  );
}
