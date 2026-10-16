import type { components } from '@/api/schema';
import { queryClient } from '@/lib/query-client';

export const authUserKey = ['auth', 'user'] as const;
export type AuthUser = components['schemas']['User'];

export function setAuthUser(user: AuthUser) {
  queryClient.setQueryData(authUserKey, user);
}

export function clearAuthState() {
  // Private cached data must not survive session expiry or logout.
  queryClient.clear();
}
