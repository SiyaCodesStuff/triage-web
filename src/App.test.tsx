import { fireEvent, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { renderAuthApp } from '@/test/auth-app';
import { server } from '@/test/server';
import { user } from '@/test/fixtures';
import { queryClient } from '@/lib/query-client';

const base = `${window.location.origin}/api/v1`;
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  queryClient.clear();
  server.use(
    http.get(`${base}/tickets`, () =>
      HttpResponse.json({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      }),
    ),
  );
  server.use(
    http.get(`${base}/users/me`, () =>
      HttpResponse.json({ data: { ...user, role: 'ADMIN' } }),
    ),
  );
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});
afterAll(() => server.close());

describe('Application routes', () => {
  it.each([
    ['/', 'Tickets'],
    ['/login', 'Log in'],
    ['/register', 'Create an account'],
    ['/tickets', 'Tickets'],
    ['/tickets/abc-123', 'Ticket abc-123'],
    ['/admin/users', 'Users'],
  ])('renders %s', async (path, title) => {
    renderAuthApp(path);
    expect(
      await screen.findByRole('heading', { level: 1, name: title }),
    ).toBeVisible();
    expect(document.title).toBe(`${title} | Triage`);
  });

  it('provides shell landmarks, admin navigation, and a skip link', async () => {
    renderAuthApp('/tickets');
    await screen.findByRole('heading', { name: 'Tickets' });
    expect(screen.getByRole('banner')).toBeVisible();
    expect(screen.getByRole('contentinfo')).toBeVisible();
    const navigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    });
    expect(within(navigation).getAllByRole('link')).toHaveLength(2);
    expect(
      within(navigation).getByRole('link', { name: 'Tickets' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('link', { name: 'Skip to content' }),
    ).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('navigates and focuses the main content', async () => {
    renderAuthApp('/tickets');
    await screen.findByRole('heading', { name: 'Tickets' });
    fireEvent.click(screen.getByRole('link', { name: 'Users' }));
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('shows a 404 with a working route back to tickets', async () => {
    renderAuthApp('/does-not-exist');
    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: 'Back to tickets' }));
    expect(
      await screen.findByRole('heading', { name: 'Tickets' }),
    ).toBeVisible();
  });
});
