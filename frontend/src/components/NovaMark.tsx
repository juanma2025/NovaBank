export function NovaMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={className}>
      <rect width="32" height="32" rx="9" fill="currentColor" className="text-brand" />
      <path
        d="M10 22V10h2.6l6.8 8.3V10H22v12h-2.6l-6.8-8.3V22H10Z"
        fill="currentColor"
        className="text-on-brand"
      />
    </svg>
  );
}
