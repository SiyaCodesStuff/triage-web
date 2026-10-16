import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/auth/context';
import type { AuthUser } from '@/auth/session';
import { Button } from '@/components/ui/button';

function AuthGuard({ roles }: { roles?: readonly AuthUser['role'][] }) {
  const { user, isLoading, error, retry } = useAuth();
  const location = useLocation();
  if (isLoading) return <p role="status">Checking your session…</p>;
  if (error)
    return (
      <div className="space-y-4">
        <p role="alert">We couldn’t check your session. Please try again.</p>
        <Button onClick={retry}>Try again</Button>
      </div>
    );
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  if (roles && !roles.includes(user.role))
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname + location.search + location.hash,
          reason: 'role',
        }}
      />
    );
  return <Outlet />;
}

export function ProtectedRoute() {
  return <AuthGuard />;
}

export function RoleRoute({ roles }: { roles: readonly AuthUser['role'][] }) {
  return <AuthGuard roles={roles} />;
}
