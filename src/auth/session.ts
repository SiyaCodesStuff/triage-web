import type { components } from '@/api/schema';
import { queryClient } from '@/lib/query-client';

export const authUserKey = ['auth', 'user'] as const;
export type AuthUser = components['schemas']['User'];

export function setAuthUser(user: AuthUser) {
  queryClient.setQueryData(authUserKey, user);
}

export function clearAuthState() {
  // Private cached data must not survive session expiry or logout.
  void queryClient.cancelQueries({ queryKey: authUserKey, exact: true });
  queryClient.removeQueries({
    predicate: (query) =>
      !(
        query.queryKey.length === 2 &&
        query.queryKey[0] === 'auth' &&
        query.queryKey[1] === 'user'
      ),
  });
  queryClient.setQueryData<AuthUser | null>(authUserKey, null);
}
