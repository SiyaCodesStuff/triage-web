import { HttpResponse, http } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';
import { ApiError, createApiClient } from '@/api/client';
import type { components } from '@/api/schema';
import { authUserKey, setAuthUser } from '@/auth/session';
import { queryClient } from '@/lib/query-client';
import { server } from '@/test/server';
import { ticket, user } from '@/test/fixtures';

const base = `${window.location.origin}/api/v1`;
const unauthorized = () =>
  HttpResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Authentication is required' } },
    { status: 401 },
  );

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});
afterAll(() => server.close());

function client() {
  const redirectToLogin = vi.fn();
  return { api: createApiClient({ redirectToLogin }), redirectToLogin };
}

describe('API client', () => {
  it('returns the typed success envelope and always includes credentials', async () => {
    server.use(
      http.get(`${base}/users/me`, ({ request }) => {
        expect(request.headers.get('Accept')).toBe('application/json');
        expect(request.headers.has('X-CSRF-Protection')).toBe(false);
        return HttpResponse.json({ data: user });
      }),
    );
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { api } = client();
    const result = await api.request('get', '/users/me');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ credentials: 'include' }),
    );
    expectTypeOf(result).toEqualTypeOf<components['schemas']['UserResponse']>();
    expect(result).toEqual({ data: user });
  });

  it('encodes typed path and query parameters', async () => {
    server.use(
      http.get(`${base}/tickets/:ticketId/comments`, ({ request, params }) => {
        expect(params.ticketId).toBe('a/b');
        expect(new URL(request.url).searchParams.get('page')).toBe('2');
        return HttpResponse.json({
          data: { data: [], page: 2, limit: 50, total: 0 },
        });
      }),
    );
    const { api } = client();
    await expect(
      api.request('get', '/tickets/{ticketId}/comments', {
        params: { ticketId: 'a/b' },
        query: { page: 2 },
      }),
    ).resolves.toMatchObject({ data: { page: 2 } });
  });

  it('sends the required CSRF marker and JSON on registration', async () => {
    const body = { name: 'Alex', email: user.email, password: 'test-password' };
    server.use(
      http.post(`${base}/auth/register`, async ({ request }) => {
        expect(request.headers.get('X-CSRF-Protection')).toBe('1');
        expect(request.headers.get('Content-Type')).toBe('application/json');
        expect(await request.json()).toEqual(body);
        return HttpResponse.json({ data: user }, { status: 201 });
      }),
    );
    const { api } = client();
    await api.request('post', '/auth/register', {
      body,
      headers: { 'X-CSRF-Protection': 'incorrect' },
    });
    expect(queryClient.getQueryData(authUserKey)).toEqual(user);
  });

  it('parses status, code, message, and details from the error envelope', async () => {
    const details = [{ path: ['title'], message: 'Required' }];
    server.use(
      http.post(`${base}/tickets`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request',
              details,
            },
          },
          { status: 400 },
        ),
      ),
    );
    const { api, redirectToLogin } = client();
    const result = api.request('post', '/tickets', {
      body: { title: '', description: '' },
    });
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details,
    });
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('handles non-JSON HTTP errors without exposing the response body', async () => {
    server.use(
      http.get(
        `${base}/users/me`,
        () => new HttpResponse('<h1>Proxy error</h1>', { status: 502 }),
      ),
    );
    const { api } = client();
    await expect(api.request('get', '/users/me')).rejects.toMatchObject({
      status: 502,
      code: 'HTTP_ERROR',
      message: 'Request failed (502).',
    });
  });

  it('handles 204 responses and clears private state on logout', async () => {
    setAuthUser(user);
    queryClient.setQueryData(['tickets'], ['private']);
    server.use(
      http.post(`${base}/auth/logout`, ({ request }) => {
        expect(request.headers.get('X-CSRF-Protection')).toBe('1');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { api } = client();
    await expect(api.request('post', '/auth/logout')).resolves.toBeUndefined();
    expect(queryClient.getQueryData(authUserKey)).toBeNull();
    expect(queryClient.getQueryData(['tickets'])).toBeUndefined();
  });

  it('refreshes once with CSRF then replays the original method, body, and headers', async () => {
    let attempts = 0;
    let refreshes = 0;
    const body = { title: 'Printer issue', description: 'Paper jam' };
    server.use(
      http.post(`${base}/tickets`, async ({ request }) => {
        attempts += 1;
        expect(await request.json()).toEqual(body);
        expect(request.headers.get('X-CSRF-Protection')).toBe('1');
        expect(request.headers.get('X-Request-ID')).toBe('request-1');
        return attempts === 1
          ? unauthorized()
          : HttpResponse.json({ data: ticket }, { status: 201 });
      }),
      http.post(`${base}/auth/refresh`, ({ request }) => {
        refreshes += 1;
        expect(request.headers.get('X-CSRF-Protection')).toBe('1');
        return HttpResponse.json({ data: user });
      }),
    );
    const { api } = client();
    await expect(
      api.request('post', '/tickets', {
        body,
        headers: { 'X-Request-ID': 'request-1' },
      }),
    ).resolves.toMatchObject({ data: { id: ticket.id } });
    expect(attempts).toBe(2);
    expect(refreshes).toBe(1);
    expect(queryClient.getQueryData(authUserKey)).toEqual(user);
  });

  it('shares one in-flight refresh between concurrent 401s', async () => {
    let attempts = 0;
    let refreshes = 0;
    const bothUnauthorized = deferred();
    const refreshing = deferred();
    const releaseRefresh = deferred();
    server.use(
      http.get(`${base}/users/me`, async () => {
        attempts += 1;
        if (attempts <= 2) {
          if (attempts === 2) bothUnauthorized.resolve();
          await bothUnauthorized.promise;
          return unauthorized();
        }
        return HttpResponse.json({ data: user });
      }),
      http.post(`${base}/auth/refresh`, async () => {
        refreshes += 1;
        refreshing.resolve();
        await releaseRefresh.promise;
        return HttpResponse.json({ data: user });
      }),
    );
    const { api, redirectToLogin } = client();
    const results = Promise.all([
      api.request('get', '/users/me'),
      api.request('get', '/users/me'),
    ]);
    await refreshing.promise;
    expect(refreshes).toBe(1);
    releaseRefresh.resolve();
    await expect(results).resolves.toEqual([{ data: user }, { data: user }]);
    expect(attempts).toBe(4);
    expect(refreshes).toBe(1);
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('does not rotate again for a delayed 401 from before a completed refresh', async () => {
    let attempts = 0;
    let refreshes = 0;
    const secondStarted = deferred();
    const releaseLateResponse = deferred();
    server.use(
      http.get(`${base}/users/me`, async () => {
        const attempt = ++attempts;
        if (attempt === 1) {
          await secondStarted.promise;
          return unauthorized();
        }
        if (attempt === 2) {
          secondStarted.resolve();
          await releaseLateResponse.promise;
          return unauthorized();
        }
        return HttpResponse.json({ data: user });
      }),
      http.post(`${base}/auth/refresh`, () => {
        refreshes += 1;
        return HttpResponse.json({ data: user });
      }),
    );
    const { api } = client();
    const first = api.request('get', '/users/me');
    const late = api.request('get', '/users/me');
    await first;
    releaseLateResponse.resolve();
    await late;
    expect(refreshes).toBe(1);
    expect(attempts).toBe(4);
  });

  it.each([401, 500, 'network'] as const)(
    'clears auth and redirects once when shared refresh fails (%s)',
    async (status) => {
      setAuthUser(user);
      queryClient.setQueryData(['tickets'], ['private']);
      let attempts = 0;
      let refreshes = 0;
      const bothUnauthorized = deferred();
      server.use(
        http.get(`${base}/users/me`, async () => {
          attempts += 1;
          if (attempts === 2) bothUnauthorized.resolve();
          await bothUnauthorized.promise;
          return unauthorized();
        }),
        http.post(`${base}/auth/refresh`, () => {
          refreshes += 1;
          return status === 'network'
            ? HttpResponse.error()
            : HttpResponse.json(
                {
                  error: { code: 'REFRESH_FAILED', message: 'Refresh failed' },
                },
                { status },
              );
        }),
      );
      const { api, redirectToLogin } = client();
      const results = await Promise.allSettled([
        api.request('get', '/users/me'),
        api.request('get', '/users/me'),
      ]);
      expect(results.map((result) => result.status)).toEqual([
        'rejected',
        'rejected',
      ]);
      expect(refreshes).toBe(1);
      expect(attempts).toBe(2);
      expect(redirectToLogin).toHaveBeenCalledTimes(1);
      expect(queryClient.getQueryData(authUserKey)).toBeNull();
      expect(queryClient.getQueryData(['tickets'])).toBeUndefined();
    },
  );

  it('stops after one retry when the original request remains unauthorized', async () => {
    let attempts = 0;
    let refreshes = 0;
    server.use(
      http.get(`${base}/users/me`, () => {
        attempts += 1;
        return unauthorized();
      }),
      http.post(`${base}/auth/refresh`, () => {
        refreshes += 1;
        return HttpResponse.json({ data: user });
      }),
    );
    const { api, redirectToLogin } = client();
    await expect(api.request('get', '/users/me')).rejects.toMatchObject({
      status: 401,
    });
    expect(attempts).toBe(2);
    expect(refreshes).toBe(1);
    expect(redirectToLogin).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(authUserKey)).toBeNull();
  });

  it.each(['/auth/login', '/auth/register'] as const)(
    'does not refresh a rejected %s request',
    async (path) => {
      let refreshes = 0;
      server.use(
        http.post(`${base}${path}`, () => unauthorized()),
        http.post(`${base}/auth/refresh`, () => {
          refreshes += 1;
          return unauthorized();
        }),
      );
      const { api, redirectToLogin } = client();
      const loginBody = { email: user.email, password: 'wrong-password' };
      const result =
        path === '/auth/login'
          ? api.request('post', path, { body: loginBody })
          : api.request('post', path, { body: { ...loginBody, name: 'Alex' } });
      await expect(result).rejects.toMatchObject({ status: 401 });
      expect(refreshes).toBe(0);
      expect(redirectToLogin).not.toHaveBeenCalled();
    },
  );

  it('shares explicit refresh calls and never refreshes a refresh failure', async () => {
    let refreshes = 0;
    const release = deferred();
    server.use(
      http.post(`${base}/auth/refresh`, async () => {
        refreshes += 1;
        await release.promise;
        return unauthorized();
      }),
    );
    const { api, redirectToLogin } = client();
    const result = Promise.allSettled([
      api.request('post', '/auth/refresh'),
      api.request('post', '/auth/refresh'),
    ]);
    release.resolve();
    const outcomes = await result;
    expect(outcomes.every((outcome) => outcome.status === 'rejected')).toBe(
      true,
    );
    expect(refreshes).toBe(1);
    expect(redirectToLogin).toHaveBeenCalledOnce();
  });

  it('waits for an active refresh before sending a new protected request', async () => {
    let attempts = 0;
    let refreshes = 0;
    const refreshing = deferred();
    const release = deferred();
    server.use(
      http.get(`${base}/users/me`, () => {
        attempts += 1;
        return attempts === 1
          ? unauthorized()
          : HttpResponse.json({ data: user });
      }),
      http.post(`${base}/auth/refresh`, async () => {
        refreshes += 1;
        refreshing.resolve();
        await release.promise;
        return HttpResponse.json({ data: user });
      }),
    );
    const { api } = client();
    const first = api.request('get', '/users/me');
    await refreshing.promise;
    const second = api.request('get', '/users/me');
    expect(attempts).toBe(1);
    release.resolve();
    await Promise.all([first, second]);
    expect(attempts).toBe(3);
    expect(refreshes).toBe(1);
  });

  it('allows a new session to refresh again after a successful login', async () => {
    let attempts = 0;
    let refreshes = 0;
    server.use(
      http.get(`${base}/users/me`, () => {
        attempts += 1;
        return attempts <= 2
          ? unauthorized()
          : HttpResponse.json({ data: user });
      }),
      http.post(`${base}/auth/refresh`, () => {
        refreshes += 1;
        return refreshes === 1
          ? unauthorized()
          : HttpResponse.json({ data: user });
      }),
      http.post(`${base}/auth/login`, () => HttpResponse.json({ data: user })),
    );
    const { api, redirectToLogin } = client();
    await expect(api.request('get', '/users/me')).rejects.toMatchObject({
      status: 401,
    });
    await api.request('post', '/auth/login', {
      body: { email: user.email, password: 'test-password' },
    });
    await expect(api.request('get', '/users/me')).resolves.toEqual({
      data: user,
    });
    expect(refreshes).toBe(2);
    expect(redirectToLogin).toHaveBeenCalledOnce();
  });

  it('passes abort signals through without attempting refresh or redirect', async () => {
    const controller = new AbortController();
    controller.abort();
    const { api, redirectToLogin } = client();
    await expect(
      api.request('get', '/users/me', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(redirectToLogin).not.toHaveBeenCalled();
  });
});
