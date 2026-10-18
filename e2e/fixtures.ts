import { test as base, expect, type BrowserContext } from '@playwright/test';
import { apiBase, csrf } from './helpers';

type Actors = {
  admin: BrowserContext;
  owner: BrowserContext;
  staff: BrowserContext;
  outsider: BrowserContext;
  ticketId?: string;
  staffId?: string;
};

export const test = base.extend<{ actors: Actors }>({
  actors: [
    async ({ browser, baseURL }, use) => {
      const [admin, owner, staff, outsider] = await Promise.all([
        browser.newContext({ baseURL }),
        browser.newContext({ baseURL }),
        browser.newContext({ baseURL }),
        browser.newContext({ baseURL }),
      ]);
      const actors: Actors = { admin, owner, staff, outsider };
      try {
        await use(actors);
      } finally {
        try {
          // Reset only this run's account. The seeded administrator is untouched.
          const reset = actors.staffId
            ? await admin.request.patch(
                `${apiBase}/users/${actors.staffId}/role`,
                {
                  headers: csrf,
                  data: { role: 'USER' },
                  timeout: 10_000,
                },
              )
            : undefined;
          const removed = actors.ticketId
            ? await admin.request.delete(
                `${apiBase}/tickets/${actors.ticketId}`,
                {
                  headers: csrf,
                  timeout: 10_000,
                },
              )
            : undefined;
          if (reset)
            expect(reset.status(), 'cleanup revokes fixture privileges').toBe(
              200,
            );
          if (removed)
            expect(
              [204, 404].includes(removed.status()),
              'cleanup removes only this run’s ticket',
            ).toBe(true);
        } finally {
          await Promise.all([
            admin.close(),
            owner.close(),
            staff.close(),
            outsider.close(),
          ]);
        }
      }
    },
    { timeout: 30_000 },
  ],
});
