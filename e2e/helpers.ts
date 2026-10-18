import { randomBytes, randomUUID } from 'node:crypto';
import {
  expect,
  type APIResponse,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { z } from 'zod';

export const apiBase = '/api/v1';
export const csrf = { 'X-CSRF-Protection': '1' };
export const userResponse = z.object({
  data: z.object({
    id: z.uuid(),
    email: z.email(),
    role: z.enum(['USER', 'AGENT', 'ADMIN']),
  }),
});
export type User = z.infer<typeof userResponse>['data'];
export type Identity = { name: string; email: string; password: string };

export function identity(label: string): Identity {
  const id = randomUUID();
  return {
    name: `E2E ${label} ${id.slice(0, 8)}`,
    email: `e2e-${label}-${id}@example.test`,
    password: randomBytes(24).toString('base64url'),
  };
}

export async function readUser(response: APIResponse): Promise<User> {
  const payload: unknown = await response.json();
  return userResponse.parse(payload).data;
}

export async function register(
  context: BrowserContext,
  account: Identity,
): Promise<User> {
  const response = await context.request.post(`${apiBase}/auth/register`, {
    headers: csrf,
    data: account,
  });
  expect(response.status(), 'real API registration').toBe(201);
  const user = await readUser(response);
  expect(user.role).toBe('USER');
  return user;
}

export async function submit(
  page: Page,
  name: string,
  path: string,
  method = 'POST',
) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === path &&
        response.request().method() === method,
    ),
    page.getByRole('button', { name, exact: true }).click(),
  ]);
  return response;
}

export async function changeRole(page: Page, target: User, role: User['role']) {
  await page.goto('/admin/users');
  await expect(
    page.getByRole('heading', { name: 'Users', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Search users', { exact: true }).fill(target.email);
  const [search] = await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === `${apiBase}/users` &&
        url.searchParams.get('search') === target.email
      );
    }),
    page.getByRole('button', { name: 'Search', exact: true }).click(),
  ]);
  expect(search.status()).toBe(200);
  const select = page.getByLabel(`Role for ${target.email}`, { exact: true });
  await select.selectOption(role);
  const dialog = page.getByRole('alertdialog', { name: 'Confirm role change' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(target.email);
  const response = await submit(
    page,
    'Confirm change',
    `${apiBase}/users/${target.id}/role`,
    'PATCH',
  );
  expect(response.status(), 'confirmed real API role change').toBe(200);
  await expect(dialog).not.toBeVisible();
  await expect(select).toHaveValue(role);
}
