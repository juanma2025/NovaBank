import { Link } from 'react-router';

import { APP_MESSAGES } from '../lib/messages.ts';
import { AuthLayout } from './AuthLayout.tsx';

export default function NotFoundPage() {
  return (
    <AuthLayout>
      <div className="space-y-5 text-center">
        <p className="text-sm font-semibold tabular-nums text-text-muted">404</p>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-text">
            {APP_MESSAGES.notFoundTitle}
          </h1>
          <p className="text-sm text-text-secondary">{APP_MESSAGES.notFoundDescription}</p>
        </div>
        <div className="pt-1">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-brand px-5 py-2.5 text-[15px] font-semibold text-on-brand shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-brand-hover"
          >
            {APP_MESSAGES.backHome}
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
