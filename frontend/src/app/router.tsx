import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { Spinner } from '../components/Spinner.tsx';
import { useSession } from '../features/auth/hooks/useSession.ts';
import { APP_MESSAGES } from '../lib/messages.ts';
import { PublicOnly } from './PublicOnly.tsx';
import { RequireAuth } from './RequireAuth.tsx';

const LoginPage = lazy(() => import('../features/auth/pages/LoginPage.tsx'));
const RegisterPage = lazy(() => import('../features/auth/pages/RegisterPage.tsx'));
const PasswordResetPage = lazy(() => import('../features/auth/pages/PasswordResetPage.tsx'));
const PrivacyPolicyPage = lazy(() => import('../features/legal/PrivacyPolicyPage.tsx'));
const WelcomePage = lazy(() => import('../features/auth/pages/WelcomePage.tsx'));
const NotFoundPage = lazy(() => import('../components/NotFoundPage.tsx'));

function PageFallback() {
  return (
    <div className="nova-canvas flex min-h-dvh items-center justify-center">
      <Spinner size="md" label={APP_MESSAGES.loadingPage} className="text-brand" />
    </div>
  );
}

function RootRedirect() {
  const { data: session } = useSession();
  return <Navigate to={session ? '/inicio' : '/ingresar'} replace />;
}

/** Rutas SPA con carga diferida (plan.md · Rutas). */
export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route element={<PublicOnly />}>
          <Route path="/ingresar" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/recuperar" element={<PasswordResetPage />} />
        </Route>

        <Route path="/privacidad" element={<PrivacyPolicyPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/inicio" element={<WelcomePage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
