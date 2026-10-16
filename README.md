# Triage Web

React + TypeScript SPA for the Triage API. Requires Node 24 and npm.

## Development

```sh
nvm use
npm install
npm run dev
```

Run the API separately on `http://localhost:3000`. Vite forwards `/api/v1`
requests to it without rewriting the path, so browser requests use the Vite
origin and development does not require CORS configuration.

The default `VITE_API_BASE_PATH` is `/api/v1`; `.env.example` documents this
public setting. To override it, set the variable when starting Vite or in a
local environment file. Use an absolute path without a trailing slash.
Never place secrets in frontend environment variables: `VITE_` values are public.
Use relative API URLs based on this path. Cookie requests should include
`credentials: 'include'`; unsafe API methods must send `X-CSRF-Protection: 1`
as documented in `../triage-api/docs/auth.md`.

The development proxy is not part of the production build or preview server.
Production hosting must route the API path to the API server on the same site.

## Commands

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
npm run format
```

Vitest uses jsdom and Testing Library. `@/` resolves to `src/` in TypeScript,
Vite, and tests. The application and configuration use strict TypeScript.

## Application shell

Routes: `/login`, `/register`, `/tickets`, `/tickets/:id`, and `/admin/users`.
The root redirects to `/tickets`; unmatched paths show a 404 page. These are
placeholders; authentication forms and route authorization are not implemented yet.

The responsive shell includes main navigation, a skip link, and focus management
on route changes. The theme follows the operating system, including live changes.
Tailwind CSS uses the Vite plugin. shadcn/ui configuration is in `components.json`;
Button, Card, and Sonner components live in `src/components/ui`.

Use `toast.success('Saved')` or `toast.error('Could not save')` from `sonner`
for notifications. A shared toaster follows the app theme and supports dismissal.
The top-level error boundary provides reload and return-to-tickets actions.
Production hosting must serve `index.html` for frontend routes to support direct
links and refreshes with BrowserRouter.

## API client

With the API running on port 3000, regenerate the checked-in declaration file:

```sh
npm run api:types
```

`src/api/schema.d.ts` is generated from the running `/openapi.json`; do not edit
it manually. Generation keeps defaulted request properties optional, matching the
OpenAPI `required` lists. TypeScript 5.9 satisfies openapi-typescript's current
TypeScript 5 peer requirement. Runtime JSON is typed from the schema; this client
does not perform full runtime schema validation.

Use the shared `api` instance so all requests share one refresh operation:

```ts
import { api } from '@/api/client';

const profile = await api.request('get', '/users/me');
const ticket = await api.request('get', '/tickets/{ticketId}', {
  params: { ticketId: id },
});
const tickets = await api.request('get', '/tickets', {
  query: { page: 1, pageSize: 20, status: 'OPEN' },
});
```

Responses retain their documented envelopes, including pagination metadata.
`ApiError` exposes `status`, `code`, `message`, and `details`. Requests include
cookies; unsafe methods automatically send `X-CSRF-Protection: 1`.
A protected 401 shares one refresh, then retries its original request once.
Login and registration errors do not trigger refresh; explicit refresh calls join
the same operation. Refresh failure or a repeated 401 clears cached session and
private data and redirects to `/login`. Cookies remain HttpOnly; no credentials
are stored in JavaScript or frontend environment variables.

`AppProviders` mounts the shared TanStack Query client. Queries stay fresh for
30 seconds, retain inactive data for 5 minutes, and retry network/5xx failures
at most twice. They do not retry 4xx errors or cancellations. Mutations do not
retry automatically. `authUserKey` in `src/auth/session.ts` holds the public user
cached by login, registration, and refresh. API tests use MSW in Node; no service
worker or real API is needed to run the test suite.
