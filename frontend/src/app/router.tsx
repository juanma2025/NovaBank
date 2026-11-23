import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { Spinner } from '../components/Spinner.tsx';
import { useSession } from '../features/auth/hooks/useSession.ts';
import { APP_MESSAGES } from '../lib/messages.ts';
import { PublicOnly } from './PublicOnly.tsx';
import { RequireAuth } from './RequireAuth.tsx';

const LandingPage = lazy(() => import('../features/landing/pages/LandingPage.tsx'));
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage.tsx'));
const RegisterPage = lazy(() => import('../features/auth/pages/RegisterPage.tsx'));
const PasswordResetPage = lazy(() => import('../features/auth/pages/PasswordResetPage.tsx'));
const PrivacyPolicyPage = lazy(() => import('../features/legal/PrivacyPolicyPage.tsx'));
const HomePage = lazy(() => import('../features/home/pages/HomePage.tsx'));
const TopupPage = lazy(() => import('../features/topups/pages/TopupPage.tsx'));
const NotFoundPage = lazy(() => import('../components/NotFoundPage.tsx'));

function PageFallback() {
  return (
    <div className="nova-canvas flex min-h-dvh items-center justify-center">
      <Spinner size="md" label={APP_MESSAGES.loadingPage} className="text-brand" />
    </div>
  );
}

function RootRoute() {
  const { data: session } = useSession();
  if (session) return <Navigate to="/inicio" replace />;
  return <LandingPage />;
}

/** Rutas SPA con carga diferida (`React.lazy`). */
export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<RootRoute />} />

        <Route element={<PublicOnly />}>
          <Route path="/ingresar" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/recuperar" element={<PasswordResetPage />} />
        </Route>

        <Route path="/privacidad" element={<PrivacyPolicyPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/inicio" element={<HomePage />} />
          <Route path="/recargar" element={<TopupPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
