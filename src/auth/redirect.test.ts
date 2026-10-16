import { describe, expect, it } from 'vitest';
import { safeDestination } from '@/auth/redirect';

describe('Return destination', () => {
  it.each([
    null,
    undefined,
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/login',
    '/register?returnTo=/login',
  ])('rejects unsafe or recursive destination %s', (value) => {
    expect(safeDestination(value)).toBe('/tickets');
  });
  it('preserves local path, query, and hash', () => {
    expect(safeDestination('/tickets/123?tab=activity#comment')).toBe(
      '/tickets/123?tab=activity#comment',
    );
  });
});
