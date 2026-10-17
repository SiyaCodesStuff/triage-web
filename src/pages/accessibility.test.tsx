import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { renderAuthApp } from '@/test/auth-app';
import { expectAccessible } from '@/test/accessibility';
import { server } from '@/test/server';
import { ticket, user } from '@/test/fixtures';
import { queryClient } from '@/lib/query-client';

const base = `${window.location.origin}/api/v1`;
const other = {
  ...user,
  id: 'a1ca6754-f2cb-480e-8869-1efb71df88d3',
  name: 'Sam',
  email: 'sam@example.com',
};
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  queryClient.clear();
  server.use(
    http.get(`${base}/users/me`, () =>
      HttpResponse.json({ data: { ...user, role: 'ADMIN' } }),
    ),
    http.get(`${base}/users`, () =>
      HttpResponse.json({
        data: {
          data: [{ ...user, role: 'ADMIN' }, other],
          page: 1,
          limit: 20,
          total: 2,
        },
      }),
    ),
    http.get(`${base}/tickets`, () =>
      HttpResponse.json({
        data: [ticket],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
    ),
    http.get(`${base}/tickets/:id`, () => HttpResponse.json({ data: ticket })),
    http.get(`${base}/tickets/:id/comments`, () =>
      HttpResponse.json({
        data: {
          data: [
            {
              id: '9d128fe3-14da-47fd-9986-44dfe4241987',
              ticketId: ticket.id,
              body: 'A comment',
              createdAt: ticket.createdAt,
              updatedAt: ticket.updatedAt,
              author: { id: user.id, name: user.name, role: 'ADMIN' },
            },
          ],
          page: 1,
          limit: 50,
          total: 1,
        },
      }),
    ),
  );
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});
afterAll(() => server.close());

describe('Page accessibility', () => {
  it.each([
    ['/login', 'Log in'],
    ['/register', 'Create an account'],
    ['/tickets', 'Tickets'],
    [`/tickets/${ticket.id}`, ticket.title],
    ['/tickets/new', 'Create ticket'],
    [`/tickets/${ticket.id}/edit`, 'Edit ticket'],
    ['/admin/users', 'Users'],
    ['/missing', 'Page not found'],
  ])('has no axe violations on %s', async (path, title) => {
    renderAuthApp(path);
    await screen.findByRole('heading', { name: title, level: 1 });
    if (path === '/tickets')
      await screen.findByRole('link', { name: ticket.title });
    if (path === '/admin/users')
      await screen.findByLabelText(`Role for ${other.email}`);
    if (path === `/tickets/${ticket.id}`) await screen.findByText('A comment');
    await expectAccessible();
  });

  it('keeps validation errors associated with their controls and passes axe', async () => {
    renderAuthApp('/login');
    const submit = await screen.findByRole('button', { name: 'Log in' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await screen.findByText('Enter a valid email address.');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Enter a valid email address.',
    );
    expect(screen.getByLabelText('Email')).toHaveFocus();
    await expectAccessible();
  });

  it('puts skip first in DOM focus order, does not steal initial focus, and activates its target', async () => {
    renderAuthApp('/login');
    await screen.findByRole('heading', { name: 'Log in' });
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    const firstLink = document.querySelector('a[href]');
    expect(firstLink).toBe(skip);
    expect(screen.getByRole('main')).not.toHaveFocus();
    skip.focus();
    fireEvent.click(skip);
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });

  it('traps dialog keyboard focus, supports Escape, and restores focus to the delete trigger', async () => {
    renderAuthApp(`/tickets/${ticket.id}`);
    const trigger = await screen.findByRole('button', {
      name: 'Delete ticket',
    });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('alertdialog');
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const confirm = within(dialog).getByRole('button', {
      name: 'Confirm delete',
    });
    await waitFor(() => expect(cancel).toHaveFocus());
    await expectAccessible();
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab', code: 'Tab' });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: 'Tab', code: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
    fireEvent.keyDown(confirm, { key: 'Escape', code: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('returns focus to the role select after confirmation is cancelled', async () => {
    renderAuthApp('/admin/users');
    const select = await screen.findByLabelText(`Role for ${other.email}`);
    select.focus();
    fireEvent.change(select, { target: { value: 'AGENT' } });
    const dialog = await screen.findByRole('alertdialog');
    await expectAccessible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(select).toHaveFocus());
  });

  it('moves focus out of remounted ticket filters and announces results', async () => {
    renderAuthApp('/tickets');
    await screen.findByRole('link', { name: ticket.title });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'OPEN' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Tickets', level: 1 }),
      ).toHaveFocus(),
    );
    const live = await screen.findByRole('status', {
      name: 'Ticket results summary',
    });
    await waitFor(() =>
      expect(live).toHaveTextContent('1 ticket. Page 1 of 1.'),
    );
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveAttribute('aria-atomic', 'true');
    const table = screen.getByRole('table');
    expect(table.querySelector('caption')).toHaveTextContent('Support tickets');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .every((cell) => cell.getAttribute('scope') === 'col'),
    ).toBe(true);
  });
});
