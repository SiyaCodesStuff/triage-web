import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { scriptPolicy } from '../../build/script-csp';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const parsed = new DOMParser().parseFromString(html, 'text/html');
const script = parsed.querySelector('#theme-bootstrap');
const code = script?.textContent ?? '';

it.each([
  [false, null, 'light'],
  [true, null, 'dark'],
  [false, 'dark', 'dark'],
  [true, 'light', 'light'],
  [true, 'system', 'dark'],
  [true, 'invalid', 'dark'],
  [false, 'invalid', 'light'],
])(
  'sets the pre-paint theme (system dark: %s, stored: %s)',
  (dark, stored, expected) => {
    const root = document.createElement('html');
    root.className = 'unrelated';
    runInNewContext(code, {
      document: { documentElement: root },
      localStorage: { getItem: () => stored },
      window: { matchMedia: () => ({ matches: dark }) },
    });
    expect(root).toHaveClass(expected, 'unrelated');
    expect(root.style.colorScheme).toBe(expected);
  },
);

it('initializes from system even when storage is blocked', () => {
  const root = document.createElement('html');
  runInNewContext(code, {
    document: { documentElement: root },
    localStorage: {
      getItem: () => {
        throw new Error('Storage blocked');
      },
    },
    window: { matchMedia: () => ({ matches: true }) },
  });
  expect(root).toHaveClass('dark');
});

it('puts the executable bootstrap in head before the app and authorizes its exact bytes with a CSP hash', () => {
  expect(script?.parentElement).toBe(parsed.head);
  expect(script?.hasAttribute('src')).toBe(false);
  expect(script?.hasAttribute('type')).toBe(false);
  expect(html.indexOf('id="theme-bootstrap"')).toBeLessThan(
    html.indexOf('id="root"'),
  );
  const hash = createHash('sha256').update(code).digest('base64');
  expect(scriptPolicy(html)).toContain(`'sha256-${hash}'`);
  expect(scriptPolicy(html)).not.toContain('unsafe-inline');
});

it('also hashes Vite development inline scripts without hashing external scripts', () => {
  const refresh = 'window.refreshReady = true;';
  const policy = scriptPolicy(
    `${html}<script type="module">${refresh}</script><script src="/app.js"></script>`,
  );
  expect(policy).toContain(
    `'sha256-${createHash('sha256').update(refresh).digest('base64')}'`,
  );
  expect(policy.match(/sha256-/g)).toHaveLength(2);
});
