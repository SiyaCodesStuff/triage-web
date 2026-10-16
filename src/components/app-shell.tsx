import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { LifeBuoy } from 'lucide-react';
import { useAuth } from '@/auth/context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const guestLinks = [
  { to: '/tickets', label: 'Tickets' },
  { to: '/admin/users', label: 'Users' },
  { to: '/login', label: 'Log in' },
  { to: '/register', label: 'Register' },
];

export function AppShell() {
  const { pathname } = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const links = user
    ? [
        { to: '/tickets', label: 'Tickets' },
        ...(user.role === 'ADMIN'
          ? [{ to: '/admin/users', label: 'Users' }]
          : []),
      ]
    : guestLinks.filter((link) => link.to !== '/admin/users');
  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setLogoutError('Unable to log out. Please try again.');
    }
  }
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.focus();
  }, [pathname]);

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link
            to="/tickets"
            className="flex w-fit items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <LifeBuoy className="size-6 text-primary" aria-hidden="true" />
            Triage
          </Link>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-1">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
            {user && (
              <Button
                variant="outline"
                disabled={isLoggingOut}
                onClick={() => {
                  void handleLogout();
                }}
              >
                {isLoggingOut ? 'Logging out…' : 'Log out'}
              </Button>
            )}
          </nav>
        </div>
      </header>
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 focus:outline-none sm:px-6 sm:py-14"
      >
        {logoutError && (
          <p role="alert" className="mb-4 text-destructive">
            {logoutError}
          </p>
        )}
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-5 text-sm text-muted-foreground sm:px-6">
          <p>Triage · Support, organized.</p>
          <p>Made for a clearer workday.</p>
        </div>
      </footer>
    </div>
  );
}
