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
