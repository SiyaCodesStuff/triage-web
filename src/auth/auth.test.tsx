import { fireEvent, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
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
import { queryClient } from '@/lib/query-client';
import { authUserKey } from '@/auth/session';
import { renderAuthApp } from '@/test/auth-app';
import { server } from '@/test/server';
import { user } from '@/test/fixtures';

const base = `${window.location.origin}/api/v1`;
const unauthorized = () =>
  HttpResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } },
    { status: 401 },
  );
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
    http.get(`${base}/users/me`, unauthorized),
    http.post(`${base}/auth/refresh`, unauthorized),
  );
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});
afterAll(() => server.close());

async function fillLogin() {
  const button = screen.getByRole('button', { name: 'Log in' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'Alex@Example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'test-password' },
  });
  return button;
}

describe('Authentication', () => {
  it('logs in successfully and returns to the protected destination with query and hash', async () => {
    server.use(
      http.post(`${base}/auth/login`, async ({ request }) => {
        expect(await request.json()).toEqual({
          email: user.email,
          password: 'test-password',
        });
        expect(request.headers.get('X-CSRF-Protection')).toBe('1');
        return HttpResponse.json({ data: user });
      }),
    );
    const localWrites = vi.spyOn(window.localStorage, 'setItem');
    renderAuthApp('/tickets/abc-123?tab=conversation#latest');
    await screen.findByRole('heading', { name: 'Log in' });
    fireEvent.click(await fillLogin());
    expect(
      await screen.findByRole('heading', { name: 'Ticket abc-123' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Current location')).toHaveTextContent(
      '/tickets/abc-123?tab=conversation#latest',
    );
    expect(queryClient.getQueryData(authUserKey)).toEqual(user);
    expect(localWrites).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('shows the wrong-password message and keeps the form usable', async () => {
    server.use(http.post(`${base}/auth/login`, unauthorized));
    renderAuthApp('/login');
    fireEvent.click(await fillLogin());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password',
    );
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
    expect(screen.getByLabelText('Current location')).toHaveTextContent(
      '/login',
    );
  });

  it('validates email and password locally before sending login', async () => {
    const login = vi.fn(() => HttpResponse.json({ data: user }));
    server.use(http.post(`${base}/auth/login`, login));
    renderAuthApp('/login');
    const button = screen.getByRole('button', { name: 'Log in' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'invalid' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'short' },
    });
    fireEvent.click(button);
    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeVisible();
    expect(
      screen.getByText('Password must be at least 10 characters.'),
    ).toBeVisible();
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(login).not.toHaveBeenCalled();
  });

  it('maps server validation details to the corresponding fields', async () => {
    server.use(
      http.post(`${base}/auth/login`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request',
              details: [
                {
                  path: ['body', 'email'],
                  message: 'Check this email address.',
                },
                { path: ['body', 'password'], message: 'Check this password.' },
              ],
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderAuthApp('/login');
    fireEvent.click(await fillLogin());
    expect(await screen.findByText('Check this email address.')).toBeVisible();
    expect(screen.getByText('Check this password.')).toBeVisible();
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Check this email address.',
    );
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('redirects an anonymous protected route to login without showing private content', async () => {
    renderAuthApp('/tickets');
    expect(
      screen.queryByRole('heading', { name: 'Tickets' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Current location')).toHaveTextContent(
      '/login',
    );
  });

  it('registers a new user, trims the name, and signs them in', async () => {
    server.use(
      http.post(`${base}/auth/register`, async ({ request }) => {
        expect(await request.json()).toEqual({
          name: 'Alex',
          email: user.email,
          password: 'test-password',
        });
        return HttpResponse.json({ data: user }, { status: 201 });
      }),
    );
    renderAuthApp('/register');
    const button = screen.getByRole('button', { name: 'Create an account' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: '  Alex  ' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'test-password' },
    });
    fireEvent.click(button);
    expect(
      await screen.findByRole('heading', { name: 'Tickets' }),
    ).toBeVisible();
  });

  it('shows a conflicting registration next to the email field', async () => {
    server.use(
      http.post(`${base}/auth/register`, () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Email already registered' } },
          { status: 409 },
        ),
      ),
    );
    renderAuthApp('/register');
    const button = screen.getByRole('button', { name: 'Create an account' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Alex' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: user.email },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'test-password' },
    });
    fireEvent.click(button);
    expect(await screen.findByText('Email already registered')).toBeVisible();
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Email already registered',
    );
  });

  it('disables inputs and submission while logging in', async () => {
    let release: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${base}/auth/login`, async () => {
        await pending;
        return HttpResponse.json({ data: user });
      }),
    );
    renderAuthApp('/login');
    fireEvent.click(await fillLogin());
    const button = await screen.findByRole('button', { name: 'Logging in…' });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    release();
    await screen.findByRole('heading', { name: 'Tickets' });
  });

  it('restores the public user from GET users/me and logs out', async () => {
    server.use(
      http.get(`${base}/users/me`, () => HttpResponse.json({ data: user })),
      http.post(`${base}/auth/logout`, ({ request }) => {
        expect(request.headers.get('X-CSRF-Protection')).toBe('1');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderAuthApp('/tickets');
    await screen.findByRole('heading', { name: 'Tickets' });
    queryClient.setQueryData(['private-tickets'], ['cached']);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeVisible();
    expect(queryClient.getQueryData(authUserKey)).toBeNull();
    expect(queryClient.getQueryData(['private-tickets'])).toBeUndefined();
  });

  it('redirects a non-admin account from users to login with an access explanation', async () => {
    server.use(
      http.get(`${base}/users/me`, () => HttpResponse.json({ data: user })),
    );
    renderAuthApp('/admin/users');
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This account does not have access',
    );
    expect(
      screen.queryByRole('heading', { name: 'Users' }),
    ).not.toBeInTheDocument();
  });

  it('ignores external redirect destinations after login', async () => {
    server.use(
      http.post(`${base}/auth/login`, () => HttpResponse.json({ data: user })),
    );
    renderAuthApp('/login?returnTo=https%3A%2F%2Fevil.example');
    fireEvent.click(await fillLogin());
    expect(
      await screen.findByRole('heading', { name: 'Tickets' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Current location')).toHaveTextContent(
      '/tickets',
    );
  });
});
