import { createApiClient } from '@/api/client';
import { expectTypeOf, it } from 'vitest';
import type { ApiRequestOptions, ApiResponse } from '@/api/types';
import type { components } from '@/api/schema';

it('derives request and response types from the generated schema', () => {
  expectTypeOf<ApiResponse<'/users/me', 'get'>>().toEqualTypeOf<
    components['schemas']['UserResponse']
  >();
  expectTypeOf<
    ApiResponse<'/tickets/{ticketId}', 'delete'>
  >().toEqualTypeOf<undefined>();
  expectTypeOf<
    ApiRequestOptions<'/auth/login', 'post'>['body']
  >().toEqualTypeOf<components['schemas']['loginBody']>();
});

it('rejects unsupported paths, methods, bodies, parameters, and queries at compile time', () => {
  function verifyContract(api: ReturnType<typeof createApiClient>) {
    // @ts-expect-error The specification has no such endpoint.
    void api.request('get', '/missing');
    // @ts-expect-error Login supports POST only.
    void api.request('get', '/auth/login');
    // @ts-expect-error Login requires a body.
    void api.request('post', '/auth/login');
    void api.request('post', '/auth/login', {
      // @ts-expect-error Password is required by the generated schema.
      body: { email: 'alex@example.com' },
    });
    // @ts-expect-error The ticketId path parameter is required.
    void api.request('get', '/tickets/{ticketId}');
    // @ts-expect-error An unknown query filter is not part of the specification.
    void api.request('get', '/tickets', { query: { invalid: true } });
    void api.request('post', '/tickets', {
      body: {
        title: 'Printer',
        description: 'Paper jam',
        // @ts-expect-error Priority must match the enum in the generated schema.
        priority: 'CRITICAL',
      },
    });
    // @ts-expect-error GET requests cannot send bodies.
    void api.request('get', '/tickets', { body: {} });
  }
  expectTypeOf(verifyContract).toBeFunction();
});
