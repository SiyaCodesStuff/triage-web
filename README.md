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
placeholders; authentication and authorization are not implemented yet.

The responsive shell includes main navigation, a skip link, and focus management
on route changes. The theme follows the operating system, including live changes.
Tailwind CSS uses the Vite plugin. shadcn/ui configuration is in `components.json`;
Button, Card, and Sonner components live in `src/components/ui`.

Use `toast.success('Saved')` or `toast.error('Could not save')` from `sonner`
for notifications. A shared toaster follows the app theme and supports dismissal.
The top-level error boundary provides reload and return-to-tickets actions.
Production hosting must serve `index.html` for frontend routes to support direct
links and refreshes with BrowserRouter.
