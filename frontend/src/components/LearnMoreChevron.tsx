/** Chevron interactivo que se abre sutilmente al hover (`24-learn-more-hover`, 350 ms). */
export function LearnMoreChevron({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span aria-hidden="true" className="t-learn-chevron">
      <svg viewBox="0 0 16 16" fill="none" className={className}>
        <path
          className="t-learn-arm t-learn-arm-top"
          d="M6 4L10 8"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          className="t-learn-arm t-learn-arm-bot"
          d="M10 8L6 12"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
