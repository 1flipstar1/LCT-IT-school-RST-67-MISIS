import { Suspense } from 'react';
import { SessionProvider, useSession } from '../auth/SessionProvider.jsx';
import { ErrorBoundary } from '../features/errors/ErrorBoundary.jsx';
import { ErrorPage } from '../features/errors/ErrorPage.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { AppLayout } from '../layout/AppLayout.jsx';
import { StoreProvider } from '../store/StoreProvider.jsx';
import { PageLoader } from '../ui/PageLoader.jsx';
import { ToastProvider } from '../ui/Toast.jsx';
import { matchPath, RouterProvider, useRouter } from './router.jsx';
import { ROUTES } from './routes.js';

export function App() {
  return (
    <StoreProvider>
      <SessionProvider>
        <RouterProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </RouterProvider>
      </SessionProvider>
    </StoreProvider>
  );
}

function AppRoutes() {
  const { path } = useRouter();
  const session = useSession();

  if (!session.user) return <LoginPage />;

  return (
    <AppLayout>
      {/* key={path}: после ошибки на одной странице переход на другую сбрасывает состояние границы. */}
      <ErrorBoundary key={path}>
        <Suspense fallback={<PageLoader />}>
          <RouteOutlet path={path} can={session.can} />
        </Suspense>
      </ErrorBoundary>
    </AppLayout>
  );
}

function RouteOutlet({ path, can }) {
  for (const route of ROUTES) {
    const params = matchPath(route.path, path);
    if (!params) continue;
    if (!can(route.permission)) return <ErrorPage code="ACCESS-403" />;
    const Page = route.component;
    return <Page params={params} />;
  }
  return <ErrorPage code="NOT-FOUND-404" />;
}
