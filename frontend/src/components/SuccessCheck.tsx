export interface SuccessCheckProps {
  className?: string;
}

/** Ícono de confirmación con trazo SVG progresivo (`10-success-check`, ≤ 400 ms). */
export function SuccessCheck({ className = 'h-4 w-4' }: SuccessCheckProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={`t-success-check ${className}`}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1.9"
        className="t-success-check-circle"
      />
      <path
        d="M8 12.5L10.8 15.3L16.5 9.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="t-success-check-tick"
      />
    </svg>
  );
}
