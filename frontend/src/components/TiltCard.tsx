import { type PointerEvent, type ReactNode, useRef } from 'react';

export interface TiltCardProps {
  children: ReactNode;
  className?: string;
  cardClassName?: string;
  maxTiltDeg?: number;
}

/**
 * Superficie con inclinación 3D sutil y reflejo (`19-card-tilt`, ≤ 400 ms).
 * Solo responde a puntero de ratón en escritorio y se desactiva en táctil o `prefers-reduced-motion`.
 */
export function TiltCard({
  children,
  className = '',
  cardClassName = '',
  maxTiltDeg = 6,
}: TiltCardProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  function reset(): void {
    const outer = outerRef.current;
    const card = cardRef.current;
    if (!outer || !card) return;
    outer.classList.remove('is-hover');
    card.classList.remove('is-tilting');
    card.style.setProperty('--tilt-rx', '0deg');
    card.style.setProperty('--tilt-ry', '0deg');
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (event.pointerType !== 'mouse') return;
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const outer = outerRef.current;
    const card = cardRef.current;
    if (!outer || !card) return;

    const rect = outer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const px = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const py = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

    outer.classList.add('is-hover');
    card.classList.add('is-tilting');
    card.style.setProperty('--tilt-ry', `${((px - 0.5) * maxTiltDeg).toFixed(2)}deg`);
    card.style.setProperty('--tilt-rx', `${((0.5 - py) * maxTiltDeg).toFixed(2)}deg`);
    card.style.setProperty('--tilt-gx', `${(px * 100).toFixed(1)}%`);
    card.style.setProperty('--tilt-gy', `${(py * 100).toFixed(1)}%`);
  }

  function handlePointerLeave(event: PointerEvent<HTMLDivElement>): void {
    if (event.pointerType === 'mouse') reset();
  }

  return (
    <div
      ref={outerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={reset}
      className={`t-tilt ${className}`}
    >
      <div
        ref={cardRef}
        className={`t-tilt-card nova-glass rounded-[var(--radius-xl)] ${cardClassName}`}
      >
        {children}
        <div aria-hidden="true" className="t-tilt-glare" />
      </div>
    </div>
  );
}
