import type { CSSProperties } from 'react';

export interface SoftSwapTextProps {
  text: string;
  align?: 'start' | 'end';
  ariaLabel?: string;
  className?: string;
}

/**
 * Intercambio suave de texto con cross-blur (`34-text-swap-soft`, ≤ 200 ms).
 * Reemplaza inmediatamente el valor anterior en el DOM para proteger saldos ocultos.
 */
export function SoftSwapText({
  text,
  align = 'start',
  ariaLabel,
  className = '',
}: SoftSwapTextProps) {
  const style = { '--text-soft-align': align } as CSSProperties;

  return (
    <span className={`t-text-soft ${className}`} style={style} aria-label={ariaLabel}>
      <span key={text} className="t-text-soft-enter">
        {text}
      </span>
    </span>
  );
}
