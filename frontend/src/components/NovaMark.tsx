export function NovaMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={className}>
      <rect width="32" height="32" rx="9" fill="currentColor" className="text-brand" />
      <rect
        x="0.75"
        y="0.75"
        width="30.5"
        height="30.5"
        rx="8.25"
        stroke="white"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
      <path
        d="M10 22V10h2.65l6.7 8.2V10H22v12h-2.65l-6.7-8.2V22H10Z"
        fill="currentColor"
        className="text-on-brand"
      />
    </svg>
  );
}
