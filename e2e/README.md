# Real API end-to-end tests

These Playwright tests use Chromium, the real Triage API, PostgreSQL, cookie auth,
and `X-CSRF-Protection: 1`. They do not use MSW or mocked network responses. The
Vite proxy keeps browser requests on one origin. They are opt-in: `npm test` runs
only the Vitest tests under `src`, and no default CI workflow runs Playwright.

## 1. Start PostgreSQL and prepare the API

Use Linux Node 24 in WSL2. In a terminal at `triage-web`:

```bash
cd ../triage-api
nvm use 24
docker compose up -d postgres
docker compose ps postgres
```

Wait for PostgreSQL to report healthy. A fresh Compose volume creates
`triage_test`. If an older volume does not have it, create it once:

```bash
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" triage_test'
```

Use that disposable database for this API process. The URL below uses the
Compose defaults; adjust it to your actual PostgreSQL credentials and port.
Exported variables override values loaded from the API's local `.env`; no `.env`
changes are required.

```bash
export DATABASE_URL='postgres://triage:triage@localhost:5432/triage_test'
export NODE_ENV=development
export PORT=3000
npm run db:migrate

read -r -p 'Test admin email: ' ADMIN_EMAIL
read -r -s -p 'Test admin password (10–128 characters): ' ADMIN_PASSWORD
printf '\n'
export ADMIN_EMAIL ADMIN_PASSWORD
npm run db:seed
npm run dev
```

The API still needs its configured, distinct JWT secrets. Keep those only in the
API environment. `/ready` and `/openapi.json` must work at `http://localhost:3000`.
Stop any other API using port 3000 before starting this one. Do not run the API's
integration tests concurrently against this database: they truncate tables.

The seed is idempotent; rerunning it does **not** reset an existing admin password
or promote an existing non-admin account. Choose a new test admin email if needed.
Use only the Compose `postgres` service here: the `full` profile runs a production
API with Secure cookies, which needs HTTPS rather than this local HTTP setup.

## 2. Install Chromium and run the browser workflow

In a second terminal at `triage-web`:

```bash
nvm use 24
npx playwright install chromium

read -r -p 'Same seeded admin email: ' E2E_ADMIN_EMAIL
read -r -s -p 'Same seeded admin password: ' E2E_ADMIN_PASSWORD
printf '\n'
export E2E_ADMIN_EMAIL E2E_ADMIN_PASSWORD
npm run e2e
```

If Playwright reports missing Linux browser libraries, install its documented
system dependencies with `npx playwright install-deps chromium`, then retry.

Playwright builds the SPA and starts a dedicated Vite preview server at `http://127.0.0.1:4173` and shuts it
down afterward. Keep that port free. The API is started manually and remains
running. Credentials are read by the Node test runner only; never use `VITE_`
variables for credentials. No cookie storage-state files or network traces are
written. Screenshots on failure and the HTML report are ignored artifacts in
`test-results` and `playwright-report`.

## Workflow and repeatability

One sequential scenario has named steps for:

1. Seeded admin authentication.
2. UI registration, logout, and login.
3. Ticket creation, search/status/priority filtering, and URL persistence on reload.
4. An AGENT changing OPEN to IN_PROGRESS using the edit page.
5. An owner comment that survives reload.
6. Another USER receiving a real 404 and the UI's not-found state.
7. Admin role selection and confirmation, granting access to `/admin/users`.
8. Demotion to USER: the exact same access cookie receives 403 from `/users`, 404
   for the other user's ticket, and the admin page redirects to login.

Every run generates UUID-based emails, ticket titles, comment text, and random
passwords. Four separate browser contexts isolate admin, owner, agent, and outsider
cookies. Cleanup resets the generated staff account to USER and deletes only the ticket
created by that run (and its comments), including after a failure.
The API has no user-delete endpoint, so fixture accounts remain in the disposable
database. The seeded administrator is never demoted.

The API limits login/register/refresh to **10 requests per IP per 15 minutes**.
This scenario uses about six auth requests on a fresh API. It runs with one worker
and zero retries. Before a rapid rerun, restart the local API process to reset its
in-memory limiter, or wait for the window to expire. Unique emails prevent account
collisions; they do not bypass rate limits. A 429 remains a test failure.

```bash
npm run e2e -- --list
npm run e2e -- --headed
npx playwright show-report
```

The 80% Vitest coverage gate remains independent of these browser tests.

To keep an existing development API running, start a separate API process with
`PORT=3001 npm run dev` in the prepared API terminal, then export
`E2E_API_ORIGIN=http://127.0.0.1:3001` in the frontend terminal. This Node-only
setting selects the readiness/spec endpoints and Vite proxy target; it is never
bundled into the browser. Only local HTTP origins are accepted by the runner.
Run Vitest and Playwright separately on memory-constrained WSL hosts.
