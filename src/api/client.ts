import type { components } from '@/api/schema';
import type {
  ApiMethod,
  ApiPath,
  ApiRequestArgs,
  ApiResponse,
} from '@/api/types';
import { ApiError } from '@/api/error';
import { redirectToLogin as defaultRedirectToLogin } from '@/auth/redirect';
import { clearAuthState, setAuthUser } from '@/auth/session';

export { ApiError } from '@/api/error';

type ClientOptions = {
  basePath?: string;
  redirectToLogin?: () => void;
};
type RuntimeOptions = {
  auth?: 'required' | 'optional';
  params?: object;
  query?: object;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
};
const authPaths = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = isRecord(payload) ? payload.error : undefined;
    if (
      isRecord(error) &&
      typeof error.code === 'string' &&
      typeof error.message === 'string'
    ) {
      throw new ApiError(
        response.status,
        error.code,
        error.message,
        error.details,
      );
    }
    throw new ApiError(
      response.status,
      'HTTP_ERROR',
      `Request failed (${response.status}).`,
    );
  }
  if (payload === undefined) {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The API returned an invalid JSON response.',
    );
  }
  // The generated specification supplies the response type at this JSON boundary.
  return payload as T;
}

export function createApiClient({
  basePath = import.meta.env.VITE_API_BASE_PATH || '/api/v1',
  redirectToLogin = defaultRedirectToLogin,
}: ClientOptions = {}) {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(basePath)) {
    throw new Error(
      'API base path must be an absolute path without a trailing slash.',
    );
  }

  let refreshPromise:
    Promise<components['schemas']['UserResponse']> | undefined;
  let authVersion = 0;
  let expired = false;

  let redirected = false;
  function expireSession(redirect: boolean) {
    if (!expired) {
      expired = true;
      clearAuthState();
    }
    if (redirect && !redirected) {
      redirected = true;
      redirectToLogin();
    }
  }

  function send(method: ApiMethod, path: string, options: RuntimeOptions = {}) {
    const url = new URL(`${basePath}${path}`, window.location.origin);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null)
          url.searchParams.set(key, String(value));
      }
    }
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (!['get', 'head', 'options'].includes(method))
      headers.set('X-CSRF-Protection', '1');
    const body =
      options.body === undefined ? undefined : JSON.stringify(options.body);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    return fetch(url, {
      method: method.toUpperCase(),
      credentials: 'include',
      headers,
      body,
      signal: options.signal,
    });
  }

  function refreshSession() {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const result = await readResponse<
            components['schemas']['UserResponse']
          >(await send('post', '/auth/refresh'));
          setAuthUser(result.data);
          authVersion += 1;
          return result;
        } finally {
          refreshPromise = undefined;
        }
      })();
    }
    return refreshPromise;
  }

  async function request<M extends ApiMethod, P extends ApiPath<M>>(
    method: M,
    path: P,
    ...args: ApiRequestArgs<P, M>
  ): Promise<ApiResponse<P, M>> {
    const options: RuntimeOptions = args[0] ?? {};
    options.signal?.throwIfAborted();

    // Explicit refresh calls join automatic rotations too; they never recurse.
    if (path === '/auth/refresh' && method === 'post') {
      try {
        return (await refreshSession()) as ApiResponse<P, M>;
      } catch (error) {
        expireSession(options.auth !== 'optional');
        throw error;
      }
    }

    const canRefresh = !authPaths.has(path);
    if (canRefresh && refreshPromise) {
      try {
        await refreshPromise;
      } catch (error) {
        expireSession(options.auth !== 'optional');
        throw error;
      }
    }
    options.signal?.throwIfAborted();
    const version = authVersion;
    let resolvedPath: string = path;
    for (const [key, value] of Object.entries(options.params ?? {})) {
      resolvedPath = resolvedPath.replace(
        `{${key}}`,
        encodeURIComponent(String(value)),
      );
    }
    let response = await send(method, resolvedPath, options);
    if (response.status === 401 && canRefresh && !expired) {
      options.signal?.throwIfAborted();
      // A late 401 for an older cookie should reuse the already completed rotation.
      if (version === authVersion) {
        try {
          await refreshSession();
        } catch (error) {
          expireSession(options.auth !== 'optional');
          throw error;
        }
      }
      options.signal?.throwIfAborted();
      response = await send(method, resolvedPath, options);
    }
    if (response.status === 401 && canRefresh)
      expireSession(options.auth !== 'optional');
    const result = await readResponse<ApiResponse<P, M>>(response);
    if (
      method === 'post' &&
      (path === '/auth/login' || path === '/auth/register')
    ) {
      clearAuthState();
      expired = false;
      redirected = false;
      authVersion += 1;
      setAuthUser((result as components['schemas']['UserResponse']).data);
    } else if (method === 'post' && path === '/auth/logout') {
      clearAuthState();
    }
    return result;
  }

  return { request };
}

export const api = createApiClient();
