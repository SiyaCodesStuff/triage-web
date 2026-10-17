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
The root redirects to `/tickets`; unmatched paths show a 404 page. Ticket and user-management routes are implemented. Login and registration are
implemented, and private routes require an authenticated session.

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

## Authentication

`AuthProvider` loads the current public user through `GET /api/v1/users/me`
and TanStack Query. Its optional session probe can refresh an expired access
cookie without redirecting anonymous visitors away from public auth pages.
`useAuth()` exposes the user, loading/error state, login, registration, and logout.
Signed-out state is cached as `null`; private data is removed on logout or expiry.
No authentication tokens are stored in localStorage or sessionStorage.

Both forms use React Hook Form and Zod, labelled inputs, pending/disabled states,
and field-level API validation details. Registration also maps email conflicts
to the email input. The requested frontend password minimum is 10 characters for
both forms (maximum 128). The API itself permits 1–128 characters at login and
requires 10–128 at registration. Name and email limits match the API.

`ProtectedRoute` guards tickets; `RoleRoute` restricts `/admin/users` to ADMIN.
The API remains responsible for enforcing authorization. Guards preserve the
path, query, and hash in router state; expiry redirects use a local `returnTo`
query parameter. Login and registration return to that destination, defaulting
to `/tickets`; external destinations and auth-page loops are rejected.

## Ticket list

`/tickets` loads the API's paginated ticket list. Apply filters commits search,
status, priority, staff assignee UUID, sorting, and page size to the URL and resets
to page 1. Pagination pushes history entries; browser back/forward restores the
controls and result query. Defaults are page 1, page size 20, created date descending.
Invalid URL values are normalized to valid defaults; USER requests omit staff-only
filters. Previous results remain visible while changing pages, with an updating
message and disabled paging controls until the requested page arrives.

Vitest uses at most two workers to avoid jsdom memory and CPU contention in WSL.

## Ticket details and changes

`/tickets/:id` displays ticket details; `/tickets/new` creates a ticket and
`/tickets/:id/edit` edits it. USERs may edit only their own OPEN tickets, and only
title/description. Staff can also update priority, assign an AGENT/ADMIN UUID or
clear assignment, and choose only valid next statuses:
OPEN → IN_PROGRESS → RESOLVED → CLOSED, plus RESOLVED → OPEN.
Keeping the current status omits it from the PATCH. Only ADMINs see deletion,
which requires confirmation in a keyboard-accessible dialog.

Successful mutations invalidate ticket lists and the affected ticket detail;
deleted detail data is removed. Errors appear inline and in toasts. Conflict
errors preserve form input and offer a reload, while missing tickets show a
friendly message with retry and a link back to tickets.

## Comment threads

Ticket details include comments in the API's oldest-first order, paginated with
`page` and `limit=50`. Comments are trimmed and limited to 4,000 characters.
CLOSED tickets disable the composer with an explanation; a server-side 409 keeps
the draft, displays inline/toast feedback, and refreshes the ticket status.
Authors and ADMINs can delete comments, including on closed tickets; AGENTs have
no deletion override. Comment mutations invalidate all pages of the ticket's
thread, and deleting a ticket also removes its cached comments.

## User administration

`/admin/users` requires ADMIN access. Search uses the API's `search` name/email
filter with `page` and `limit` pagination, reflected in the URL. Selecting a new
role opens a confirmation dialog; cancelling sends no request. Successful PATCH
requests invalidate user lists. Your own role select is disabled with an
explanation, and self-demotion is also guarded before submission. API errors,
including 403 self-demotion rejections, remain visible in the dialog and a toast.

## Accessibility checks

The shell keeps the skip link first in keyboard order, focuses main content on
route changes, and preserves visible focus. Search/reset/pagination actions move
focus to a stable results heading; removing a comment returns focus to the thread.
Confirmation dialogs trap focus, support Escape when idle, and return focus to
the triggering control. The error boundary focuses its recovery content.

Tables retain native captions and row/column headers inside labelled, keyboard-
scrollable regions. Persistent polite, atomic live regions announce async result
counts/pages and mutations; Sonner's existing labelled polite notification region
is covered by tests. Required fields and field-specific error associations are
explicit, including the closed-comment explanation.

Shared theme tokens now provide stronger input borders, opaque visible focus
outlines, and separate destructive-button foregrounds in light/dark modes.
Tests check actual text token pairs at 4.5:1 and controls/focus at 3:1.
`vitest-axe` scans login, registration, lists, detail/edit/create, 404, and dialogs.
Axe's color-contrast rule is disabled in jsdom because it has no layout/paint
engine; token checks are separate. These checks do not replace browser zoom,
forced-colors, or screen-reader testing of rendered content.

Use WSL Node 24 (`nvm use`) before installing or running checks; a Windows npm
on a WSL path cannot reliably manage the project's Unix dependency symlinks.

The audit measured the former light input border at 1.39:1 against white and the
former dark destructive hover/white-text pair at about 3.43:1. Revised control
borders are 4.74:1 (light card) and 7.10:1 (dark card); destructive hover text is
5.59:1 and 5.40:1 respectively. Focus rings are 5.17:1 and 9.93:1 against cards.
These are token/compositing calculations, not claims about untested browser output.

## Shared test utilities and coverage

`src/test/render.tsx` exports `renderWithProviders(ui, { path })`, using the real
query, theme, router, and auth providers. `renderAuthApp` builds on this helper.
The app's auth client updates a singleton query cache, so clear `queryClient` in
both `beforeEach` and `afterEach` to isolate tests.

`createUser(overrides)` in `src/test/fixtures.ts` returns independent users with
unique UUIDs/emails and typed overrides. `createHandlers({ currentUser })` in
`src/test/handlers.ts` provides baseline session, empty-list, and fixture-ticket
responses. Pass `currentUser: null` for guests. Register these with
`server.use(...createHandlers(...))`; override individual scenarios with later
`server.use()` calls. Keep `server.listen`, `resetHandlers`, and `close` in the
test lifecycle, with unhandled requests treated as errors.

Run `npm run test:coverage` for V8 coverage. The aggregate line threshold is 80%;
falling below it fails the command. All application TypeScript files are included,
including unvisited files, except tests/helpers, generated declaration files, and
`src/main.tsx` (the DOM bootstrap). Reports include the console table,
`coverage/index.html`, and `coverage/coverage-summary.json`. Coverage artifacts are
already ignored.
