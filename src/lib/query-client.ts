import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/error';

export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500)
    return false;
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
    return false;
  return failureCount < 2;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export const queryClient = createQueryClient();
