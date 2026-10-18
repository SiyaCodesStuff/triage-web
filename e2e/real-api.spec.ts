import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { test } from './fixtures';
import { z } from 'zod';
import {
  apiBase,
  changeRole,
  csrf,
  identity,
  readUser,
  register,
  submit,
} from './helpers';

// One workflow keeps auth attempts below the API's 10-per-15-minute limit.
// Each role owns an isolated cookie jar. No mocks, routes, or stored auth files.
test('real API: ticket lifecycle, tenant isolation, and immediate role revocation', async ({
  actors,
}) => {
  const { admin, owner, staff, outsider } = actors;
  const account = identity('owner');
  const title = `E2E ticket ${randomUUID()}`;
  let ticketId: string | undefined;
  await test.step('authenticate the seeded administrator using real cookies', async () => {
    const response = await admin.request.post(`${apiBase}/auth/login`, {
      headers: csrf,
      data: {
        email: process.env.E2E_ADMIN_EMAIL,
        password: process.env.E2E_ADMIN_PASSWORD,
      },
    });
    expect(response.status(), 'seeded administrator login').toBe(200);
    expect((await readUser(response)).role).toBe('ADMIN');
  });

  const ownerPage = await owner.newPage();
  await test.step('register, log out, and log back in through the UI', async () => {
    await ownerPage.goto('/register');
    await ownerPage.getByLabel('Name', { exact: true }).fill(account.name);
    await ownerPage.getByLabel('Email', { exact: true }).fill(account.email);
    await ownerPage
      .getByLabel('Password', { exact: true })
      .fill(account.password);
    const registration = await submit(
      ownerPage,
      'Create an account',
      `${apiBase}/auth/register`,
    );
    expect(registration.status()).toBe(201);
    await expect(
      ownerPage.getByRole('heading', { name: 'Tickets', exact: true }),
    ).toBeVisible();
    await ownerPage
      .getByRole('button', { name: 'Log out', exact: true })
      .click();
    await expect(ownerPage).toHaveURL(/\/login$/);
    await ownerPage.getByLabel('Email', { exact: true }).fill(account.email);
    await ownerPage
      .getByLabel('Password', { exact: true })
      .fill(account.password);
    expect(
      (await submit(ownerPage, 'Log in', `${apiBase}/auth/login`)).status(),
    ).toBe(200);
    await expect(
      ownerPage.getByRole('heading', { name: 'Tickets', exact: true }),
    ).toBeVisible();
  });

  await test.step('create a ticket and find it with URL-backed search and filters', async () => {
    await ownerPage
      .getByRole('link', { name: 'Create ticket', exact: true })
      .click();
    await ownerPage.getByLabel('Title', { exact: true }).fill(title);
    await ownerPage
      .getByLabel('Description', { exact: true })
      .fill('Created against the real database by Playwright.');
    const response = await submit(
      ownerPage,
      'Save ticket',
      `${apiBase}/tickets`,
    );
    expect(response.status()).toBe(201);
    const payload: unknown = await response.json();
    ticketId = z.object({ data: z.object({ id: z.uuid() }) }).parse(payload)
      .data.id;
    actors.ticketId = ticketId;
    await expect(
      ownerPage.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();
    await ownerPage
      .getByRole('link', { name: 'Back to tickets', exact: true })
      .click();
    await ownerPage.getByLabel('Search tickets', { exact: true }).fill(title);
    await ownerPage.getByLabel('Status', { exact: true }).selectOption('OPEN');
    await ownerPage
      .getByLabel('Priority', { exact: true })
      .selectOption('MEDIUM');
    const [filtered] = await Promise.all([
      ownerPage.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === `${apiBase}/tickets` &&
          url.searchParams.get('q') === title
        );
      }),
      ownerPage
        .getByRole('button', { name: 'Apply filters', exact: true })
        .click(),
    ]);
    expect(filtered.status()).toBe(200);
    const url = new URL(ownerPage.url());
    expect(url.searchParams.get('q')).toBe(title);
    expect(url.searchParams.get('status')).toBe('OPEN');
    expect(url.searchParams.get('priority')).toBe('MEDIUM');
    await ownerPage.reload();
    await expect(
      ownerPage.getByRole('link', { name: title, exact: true }),
    ).toBeVisible();
    await ownerPage.getByRole('link', { name: title, exact: true }).click();
    await expect(
      ownerPage.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();
  });

  const staffUser = await register(staff, identity('staff'));
  actors.staffId = staffUser.id;
  const promoted = await admin.request.patch(
    `${apiBase}/users/${staffUser.id}/role`,
    { headers: csrf, data: { role: 'AGENT' } },
  );
  expect(promoted.status(), 'agent fixture promotion').toBe(200);
  const staffPage = await staff.newPage();
  await test.step('an AGENT changes OPEN to IN_PROGRESS through the edit page', async () => {
    await staffPage.goto(`/tickets/${ticketId}`);
    await staffPage
      .getByRole('link', { name: 'Edit ticket', exact: true })
      .click();
    const status = staffPage.getByLabel('Status', { exact: true });
    await expect(status.locator('option')).toHaveCount(2);
    await status.selectOption('IN_PROGRESS');
    const response = await submit(
      staffPage,
      'Save ticket',
      `${apiBase}/tickets/${ticketId}`,
      'PATCH',
    );
    expect(response.status()).toBe(200);
    await expect(
      staffPage.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      staffPage.locator('dl').getByText('In progress', { exact: true }),
    ).toBeVisible();
  });

  await test.step('the owner adds a comment that survives a reload', async () => {
    await ownerPage.reload();
    const comment = `E2E comment ${randomUUID()}`;
    await ownerPage.getByLabel('Comment', { exact: true }).fill(comment);
    const response = await submit(
      ownerPage,
      'Add comment',
      `${apiBase}/tickets/${ticketId}/comments`,
    );
    expect(response.status()).toBe(201);
    await expect(ownerPage.getByText(comment, { exact: true })).toBeVisible();
    await ownerPage.reload();
    await expect(ownerPage.getByText(comment, { exact: true })).toBeVisible();
  });

  await test.step('another USER receives a real 404 and sees no ticket details', async () => {
    await register(outsider, identity('outsider'));
    const response = await outsider.request.get(
      `${apiBase}/tickets/${ticketId}`,
    );
    expect(response.status()).toBe(404);
    const payload: unknown = await response.json();
    expect(
      z.object({ error: z.object({ code: z.string() }) }).parse(payload).error
        .code,
    ).toBe('NOT_FOUND');
    const page = await outsider.newPage();
    await page.goto(`/tickets/${ticketId}`);
    await expect(
      page.getByRole('heading', { name: 'Ticket not found', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('main').getByText(title, { exact: true }),
    ).toHaveCount(0);
  });

  const adminPage = await admin.newPage();
  await test.step('admin promotes a second admin through select and confirmation', async () => {
    await changeRole(adminPage, staffUser, 'ADMIN');
    await staffPage.goto('/admin/users');
    await expect(
      staffPage.getByRole('heading', { name: 'Users', exact: true }),
    ).toBeVisible();
    expect((await staff.request.get(`${apiBase}/users`)).status()).toBe(200);
  });

  await test.step('admin demotes that account and its existing session loses access immediately', async () => {
    const before = (await staff.cookies()).find(
      (cookie) => cookie.name === 'triage_access',
    )?.value;
    expect(Boolean(before), 'access cookie exists before demotion').toBe(true);
    await changeRole(adminPage, { ...staffUser, role: 'ADMIN' }, 'USER');
    // No login or refresh: these requests reuse the previously privileged cookie.
    expect((await staff.request.get(`${apiBase}/users`)).status()).toBe(403);
    expect(
      (await staff.request.get(`${apiBase}/tickets/${ticketId}`)).status(),
    ).toBe(404);
    const after = (await staff.cookies()).find(
      (cookie) => cookie.name === 'triage_access',
    )?.value;
    expect(
      after === before,
      'role revocation works without cookie rotation',
    ).toBe(true);
    await staffPage.reload();
    await expect(staffPage).toHaveURL(/\/login$/);
    await expect(staffPage.getByRole('alert')).toContainText(
      'does not have access',
    );
    await expect(
      staffPage.getByRole('link', { name: 'Users', exact: true }),
    ).toHaveCount(0);
  });
});
