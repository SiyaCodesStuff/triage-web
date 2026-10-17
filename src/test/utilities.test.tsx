import { screen } from '@testing-library/react';
import { beforeAll, beforeEach, afterEach, afterAll, expect, it } from 'vitest';
import { useLocation } from 'react-router';
import { useTheme } from 'next-themes';
import { useAuth } from '@/auth/context';
import { queryClient } from '@/lib/query-client';
import { createUser } from '@/test/fixtures';
import { createHandlers } from '@/test/handlers';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => queryClient.clear());
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});
afterAll(() => server.close());

function Probe() {
  const { user, isLoading } = useAuth();
  const { pathname } = useLocation();
  const { theme } = useTheme();
  return (
    <p>
      {isLoading
        ? 'Loading'
        : `${user?.name ?? 'Guest'}: ${user?.role ?? 'none'} ${pathname} ${theme}`}
    </p>
  );
}

it('creates independent users with unique identities and typed overrides', () => {
  const first = createUser({ name: 'Taylor', role: 'ADMIN' });
  const second = createUser();
  expect(first).toMatchObject({ name: 'Taylor', role: 'ADMIN' });
  expect(second.id).not.toBe(first.id);
  expect(second.email).not.toBe(first.email);
  first.name = 'Changed';
  expect(second.name).toBe('Alex');
});

it('renders with real auth, query, router, and theme providers using shared handlers', async () => {
  server.use(
    ...createHandlers({
      currentUser: createUser({ name: 'Taylor', role: 'AGENT' }),
    }),
  );
  renderWithProviders(<Probe />, { path: '/tickets' });
  expect(
    await screen.findByText('Taylor: AGENT /tickets system'),
  ).toBeVisible();
});

it('supports an unauthenticated session without redirecting', async () => {
  server.use(...createHandlers({ currentUser: null }));
  renderWithProviders(<Probe />, { path: '/login' });
  expect(await screen.findByText('Guest: none /login system')).toBeVisible();
});
