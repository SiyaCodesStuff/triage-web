import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function render(upstream: string, base = '/api/v1') {
  const directory = mkdtempSync(join(tmpdir(), 'triage-nginx-'));
  directories.push(directory);
  const baseFile = join(directory, 'base');
  const config = join(directory, 'nginx.conf');
  writeFileSync(baseFile, base);
  execFileSync('sh', [resolve('container-entrypoint.sh'), 'true'], {
    env: {
      ...process.env,
      API_UPSTREAM: upstream,
      API_BASE_PATH_FILE: baseFile,
      NGINX_TEMPLATE: resolve('nginx.conf'),
      NGINX_CONFIG: config,
    },
    stdio: 'pipe',
  });
  return readFileSync(config, 'utf8');
}
describe('container startup configuration', () => {
  it.each([
    'http://triage-api:3000',
    'https://api.example.com',
    'http://[::1]:3000',
  ])(
    'renders upstream %s while preserving nginx variables and the API URI',
    (origin) => {
      const config = render(origin);
      expect(config).toContain(`proxy_pass ${origin};`);
      expect(config).toContain('location ~ ^/api/v1(?:/|$)');
      expect(config).toContain('try_files $uri $uri/ /index.html');
      expect(config).toContain('proxy_set_header Host $proxy_host');
    },
  );
  it('uses the base path baked into the frontend build', () => {
    expect(render('http://api:3000', '/service/v2')).toContain(
      '^/service/v2(?:/|$)',
    );
  });
  it.each([
    '',
    'ftp://api',
    'http://api/path',
    'http://user:password@api',
    'http://api;return 200;',
    'http://api?$uri',
    'http://api\nhttp://evil',
    'http://api/',
  ])('rejects missing or unsafe upstream %j', (origin) => {
    expect(() => render(origin)).toThrow();
  });
  it('rejects invalid baked base paths', () => {
    expect(() => render('http://api:3000', '/api;')).toThrow();
  });
});
