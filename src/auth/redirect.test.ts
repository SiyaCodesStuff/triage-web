import { describe, expect, it, vi } from 'vitest';
import { redirectToLogin, safeDestination } from '@/auth/redirect';

describe('Return destination', () => {
  it.each([
    null,
    undefined,
    42,
    '',
    'https://evil.example/path',
    'http://evil.example',
    '//evil.example',
    '///evil.example',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '\\evil.example',
    '/\\evil.example',
    '/tickets\\..\\evil.example',
    '/login',
    '/register?returnTo=/login',
    '/LOGIN/',
    '/tickets/../register#form',
    'https%3A%2F%2Fevil.example',
    '%2F%2Fevil.example',
    'javascript%3Aalert(1)',
    'data%3Atext%2Fhtml%2Cpayload',
    '/%2fevil.example',
    '/%2Fevil.example',
    '/%5cevil.example',
    '/%2f%5cevil.example',
    '/%252fevil.example',
    '/%255cevil.example',
    '/%25252fevil.example',
    '/%256aavascript%253a/..//evil.example',
    '/%6cogin',
    '/%2572egister',
    '/tickets/%2e%2e/login',
    '/tickets/%00',
    '/tickets/%0a',
    '/tickets/%7f',
    '/tickets/%C0%AF',
    '/tickets/\n',
    '/tickets/\t',
    '/tickets/\u007f',
  ])('rejects unsafe or recursive destination %s', (value) => {
    expect(safeDestination(value)).toBe('/tickets');
  });

  it.each([
    '/tickets',
    '/tickets/123?tab=activity#comment',
    '/tickets?q=printer%20issue&status=OPEN#results',
    '/tickets?q=https%3A%2F%2Fexample.com#comment',
    '/tickets?q=javascript%3Aalert(1)#results',
    '/tickets/hello%20world?returnTo=%2F%2Fexample.com#details',
    '/tickets/caf%C3%A9#r%C3%A9sum%C3%A9',
    '/admin/users?search=Alex&page=2#users',
  ])('preserves valid local path, query, and hash %s', (value) => {
    expect(safeDestination(value)).toBe(value);
  });
});

describe('Login navigation', () => {
  it('encodes the entire local destination into returnTo', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: {
        pathname: '/tickets/123',
        search: '?tab=activity&q=paper%20jam',
        hash: '#comment',
        assign,
      },
    });
    redirectToLogin();
    expect(assign).toHaveBeenCalledExactlyOnceWith(
      `/login?returnTo=${encodeURIComponent('/tickets/123?tab=activity&q=paper%20jam#comment')}`,
    );
  });

  it('does not navigate when already on login', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: {
        pathname: '/login',
        search: '?returnTo=/tickets',
        hash: '',
        assign,
      },
    });
    redirectToLogin();
    expect(assign).not.toHaveBeenCalled();
  });

  it('uses the safe fallback for an unsafe location', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: { pathname: '//evil.example', search: '', hash: '', assign },
    });
    redirectToLogin();
    expect(assign).toHaveBeenCalledExactlyOnceWith(
      '/login?returnTo=%2Ftickets',
    );
  });
});
