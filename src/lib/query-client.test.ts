import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/error';
import { createQueryClient, shouldRetryQuery } from '@/lib/query-client';

describe('Query defaults', () => {
  it.each([400, 401, 403, 404, 409, 429, 499])(
    'never retries HTTP %s',
    (status) => {
      expect(
        shouldRetryQuery(0, new ApiError(status, 'ERROR', 'Rejected')),
      ).toBe(false);
    },
  );

  it('bounds server and network retries and does not retry cancellation', () => {
    for (const error of [
      new TypeError('Failed to fetch'),
      new ApiError(503, 'NOT_READY', 'Unavailable'),
    ]) {
      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(true);
      expect(shouldRetryQuery(2, error)).toBe(false);
    }
    expect(
      shouldRetryQuery(0, new DOMException('Cancelled', 'AbortError')),
    ).toBe(false);
  });

  it('uses fresh data for 30 seconds and does not retry mutations', () => {
    const client = createQueryClient();
    expect(client.getDefaultOptions().queries).toMatchObject({
      staleTime: 30_000,
      gcTime: 300_000,
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
    });
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
    client.clear();
  });
});
