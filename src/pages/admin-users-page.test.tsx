import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { components } from '@/api/schema';
import { user } from '@/test/fixtures';
import { server } from '@/test/server';
import { renderAuthApp } from '@/test/auth-app';
import { queryClient } from '@/lib/query-client';

const base = `${window.location.origin}/api/v1`;
const target: components['schemas']['User'] = {
  ...user,
  id: 'a1ca6754-f2cb-480e-8869-1efb71df88d3',
  email: 'sam@example.com',
  name: 'Sam',
  role: 'USER',
};
let targetRole: components['schemas']['User']['role'];
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  queryClient.clear();
  targetRole = 'USER';
  server.use(
    http.get(`${base}/users/me`, () =>
      HttpResponse.json({ data: { ...user, role: 'ADMIN' } }),
    ),
    http.get(`${base}/users`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      return HttpResponse.json({
        data: {
          data: [
            { ...user, role: 'ADMIN' },
            { ...target, role: targetRole },
          ],
          page: Number(params.get('page') ?? 1),
          limit: Number(params.get('limit') ?? 20),
          total: 2,
        },
      });
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});
afterAll(() => server.close());

describe('User administration', () => {
  it.each(['USER', 'AGENT'] as const)(
    'blocks %s accounts before fetching the user list',
    async (role) => {
      const list = vi.fn(() => HttpResponse.json({}));
      server.use(
        http.get(`${base}/users/me`, () =>
          HttpResponse.json({ data: { ...user, role } }),
        ),
        http.get(`${base}/users`, list),
      );
      renderAuthApp('/admin/users');
      expect(
        await screen.findByRole('heading', { name: 'Log in' }),
      ).toBeVisible();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This account does not have access',
      );
      expect(list).not.toHaveBeenCalled();
    },
  );

  it('redirects anonymous visitors to login', async () => {
    const unauthorized = () =>
      HttpResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication is required',
          },
        },
        { status: 401 },
      );
    const list = vi.fn(() => HttpResponse.json({}));
    server.use(
      http.get(`${base}/users/me`, unauthorized),
      http.post(`${base}/auth/refresh`, unauthorized),
      http.get(`${base}/users`, list),
    );
    renderAuthApp('/admin/users');
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeVisible();
    expect(list).not.toHaveBeenCalled();
  });

  it('searches and paginates using the documented URL parameters', async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(`${base}/users`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push(params);
        return HttpResponse.json({
          data: {
            data: [target],
            page: Number(params.get('page') ?? 1),
            limit: Number(params.get('limit') ?? 20),
            total: 41,
          },
        });
      }),
    );
    renderAuthApp('/admin/users?search=Sam&page=2&limit=10');
    await screen.findByLabelText(`Role for ${target.email}`);
    expect(screen.getByLabelText('Search users')).toHaveValue('Sam');
    expect(requests[0]?.get('search')).toBe('Sam');
    expect(requests[0]?.get('page')).toBe('2');
    expect(requests[0]?.get('limit')).toBe('10');
    fireEvent.change(screen.getByLabelText('Search users'), {
      target: { value: 'Alex' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(requests.at(-1)?.get('search')).toBe('Alex'));
    expect(requests.at(-1)?.get('page')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Next users' }));
    await waitFor(() => expect(requests.at(-1)?.get('page')).toBe('2'));
  });

  it('requires confirmation before PATCH, updates the role, and invalidates lists', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    let patches = 0;
    server.use(
      http.patch(`${base}/users/:userId/role`, async ({ params, request }) => {
        patches += 1;
        expect(params.userId).toBe(target.id);
        expect(await request.json()).toEqual({ role: 'AGENT' });
        expect(request.headers.get('X-CSRF-Protection')).toBe('1');
        targetRole = 'AGENT';
        return HttpResponse.json({ data: { ...target, role: targetRole } });
      }),
    );
    renderAuthApp('/admin/users');
    fireEvent.change(await screen.findByLabelText(`Role for ${target.email}`), {
      target: { value: 'AGENT' },
    });
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAccessibleName('Confirm role change');
    expect(dialog).toHaveTextContent('from USER to AGENT');
    expect(patches).toBe(0);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Confirm change' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText(`Role for ${target.email}`)).toHaveValue(
      'AGENT',
    );
    expect(patches).toBe(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['users'] });
  });

  it('cancels without modifying the role or sending a request', async () => {
    const patch = vi.fn(() => HttpResponse.json({}));
    server.use(http.patch(`${base}/users/:userId/role`, patch));
    renderAuthApp('/admin/users');
    const select = await screen.findByLabelText(`Role for ${target.email}`);
    fireEvent.change(select, { target: { value: 'ADMIN' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(select).toHaveValue('USER');
    await waitFor(() => expect(select).toHaveFocus());
    expect(patch).not.toHaveBeenCalled();
  });

  it('disables the current admin role and blocks attempted self-demotion events', async () => {
    const patch = vi.fn(() => HttpResponse.json({}));
    server.use(http.patch(`${base}/users/:userId/role`, patch));
    renderAuthApp('/admin/users');
    const select = await screen.findByLabelText(`Role for ${user.email}`);
    expect(select).toBeDisabled();
    expect(select).toHaveAccessibleDescription(
      'You cannot demote your own administrator account.',
    );
    fireEvent.change(select, { target: { value: 'USER' } });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('handles the API self-demotion rejection inline and with a toast', async () => {
    const notify = vi.spyOn(toast, 'error');
    server.use(
      http.patch(`${base}/users/:userId/role`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message:
                'Administrators cannot remove their own administrator role',
            },
          },
          { status: 403 },
        ),
      ),
    );
    renderAuthApp('/admin/users');
    fireEvent.change(await screen.findByLabelText(`Role for ${target.email}`), {
      target: { value: 'AGENT' },
    });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirm change' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Administrators cannot remove their own administrator role',
    );
    expect(screen.getByLabelText(`Role for ${target.email}`)).toHaveValue(
      'USER',
    );
    expect(notify).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Confirm change' }),
    ).toBeEnabled();
  });

  it('shows empty results and retries user-list errors', async () => {
    let attempts = 0;
    server.use(
      http.get(`${base}/users`, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json(
              {
                error: {
                  code: 'FORBIDDEN',
                  message: 'Only administrators can list users',
                },
              },
              { status: 403 },
            )
          : HttpResponse.json({
              data: { data: [], page: 1, limit: 20, total: 0 },
            });
      }),
    );
    renderAuthApp('/admin/users');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only administrators can list users',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry users' }));
    expect(
      await screen.findByText('No users found. Try another search.'),
    ).toBeVisible();
  });
});
