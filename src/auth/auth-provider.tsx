import type { ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import { AuthContext } from '@/auth/context';
import { authUserKey } from '@/auth/session';
import type { LoginValues, RegisterValues } from '@/auth/schemas';

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useQuery({
    queryKey: authUserKey,
    queryFn: async ({ signal }) => {
      try {
        return (
          await api.request('get', '/users/me', { signal, auth: 'optional' })
        ).data;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    refetchOnWindowFocus: true,
  });
  const login = useMutation({
    mutationFn: async (body: LoginValues) => {
      await api.request('post', '/auth/login', { body });
    },
  });
  const register = useMutation({
    mutationFn: async (body: RegisterValues) => {
      await api.request('post', '/auth/register', { body });
    },
  });
  const logout = useMutation({
    mutationFn: async () => {
      await api.request('post', '/auth/logout');
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: session.data ?? null,
        isLoading: session.isPending,
        error: session.error,
        retry: () => {
          void session.refetch();
        },
        login: login.mutateAsync,
        register: register.mutateAsync,
        logout: logout.mutateAsync,
        isLoggingOut: logout.isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
