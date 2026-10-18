import { z } from 'zod';

export default async function globalSetup() {
  const credentials = z
    .object({
      E2E_ADMIN_EMAIL: z.email(),
      E2E_ADMIN_PASSWORD: z.string().min(10).max(128),
    })
    .safeParse(process.env);
  if (!credentials.success)
    throw new Error(
      'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to the seeded test administrator. See e2e/README.md.',
    );

  const apiOrigin = process.env.E2E_API_ORIGIN || 'http://localhost:3000';
  const parsed = z.url().safeParse(apiOrigin);
  if (!parsed.success)
    throw new Error('E2E_API_ORIGIN must be a local HTTP origin.');
  const url = new URL(parsed.data);
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('E2E_API_ORIGIN must be a local HTTP origin.');
  try {
    const ready = await fetch(`${url.origin}/ready`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!ready.ok) throw new Error('API is not ready');
    const response = await fetch(`${url.origin}/openapi.json`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('OpenAPI is unavailable');
    const payload: unknown = await response.json();
    const spec = z
      .object({ servers: z.array(z.object({ url: z.string() })) })
      .parse(payload);
    if (!spec.servers.some((server) => server.url === '/api/v1'))
      throw new Error('Unexpected API base path');
  } catch {
    throw new Error(
      'Start the migrated Triage API at E2E_API_ORIGIN (default localhost:3000) in development mode. /ready and /openapi.json must respond successfully. See e2e/README.md.',
    );
  }
}
