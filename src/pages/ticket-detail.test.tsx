import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { toast } from 'sonner';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { components } from '@/api/schema';
import { renderAuthApp } from '@/test/auth-app';
import { server } from '@/test/server';
import { ticket, user } from '@/test/fixtures';
import { queryClient } from '@/lib/query-client';

const base = `${window.location.origin}/api/v1`;
let record: components['schemas']['Ticket'];
let role: components['schemas']['User']['role'];
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  queryClient.clear();
  record = { ...ticket };
  role = 'USER';
  server.use(
    http.get(`${base}/users/me`, () =>
      HttpResponse.json({ data: { ...user, role } }),
    ),
    http.get(`${base}/tickets/:id`, () => HttpResponse.json({ data: record })),
    http.get(`${base}/tickets`, () =>
      HttpResponse.json({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      }),
    ),
  );
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});
afterAll(() => server.close());

describe('Ticket details and editing', () => {
  it('lets a USER edit only title and description of their own open ticket', async () => {
    renderAuthApp(`/tickets/${ticket.id}/edit`);
    await screen.findByRole('heading', { name: 'Edit ticket' });
    expect(screen.getByLabelText('Title')).toBeVisible();
    expect(screen.getByLabelText('Description')).toBeVisible();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Priority')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Assigned to (staff user ID)'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save ticket' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Delete ticket' }),
    ).not.toBeInTheDocument();
  });

  it.each(['IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const)(
    'blocks USER editing their %s ticket',
    async (status) => {
      record.status = status;
      renderAuthApp(`/tickets/${ticket.id}/edit`);
      expect(
        await screen.findByRole('heading', { name: 'Ticket cannot be edited' }),
      ).toBeVisible();
      expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    },
  );

  it('blocks USER editing a foreign ticket even if a stale response exposes it', async () => {
    record.createdBy = 'c9db25ba-432e-41eb-a66b-8f22d5b4ab55';
    renderAuthApp(`/tickets/${ticket.id}/edit`);
    expect(
      await screen.findByRole('heading', { name: 'Ticket cannot be edited' }),
    ).toBeVisible();
  });

  it.each(['AGENT', 'ADMIN'] as const)(
    'shows staff priority and assignment fields for %s',
    async (staffRole) => {
      role = staffRole;
      renderAuthApp(`/tickets/${ticket.id}/edit`);
      expect(await screen.findByLabelText('Priority')).toBeVisible();
      expect(
        screen.getByLabelText('Assigned to (staff user ID)'),
      ).toBeVisible();
    },
  );

  it.each([
    ['OPEN', ['', 'IN_PROGRESS']],
    ['IN_PROGRESS', ['', 'RESOLVED']],
    ['RESOLVED', ['', 'CLOSED', 'OPEN']],
    ['CLOSED', ['']],
  ] as const)(
    'offers only valid next states for %s',
    async (status, expected) => {
      role = 'AGENT';
      record.status = status;
      renderAuthApp(`/tickets/${ticket.id}/edit`);
      const dropdown = await screen.findByLabelText('Status');
      expect(
        within(dropdown)
          .getAllByRole('option')
          .map((option) => option.getAttribute('value')),
      ).toEqual([...expected]);
      if (status === 'CLOSED') expect(dropdown).toBeDisabled();
    },
  );

  it.each(['USER', 'AGENT', 'ADMIN'] as const)(
    'shows delete only to ADMIN (%s)',
    async (actorRole) => {
      role = actorRole;
      renderAuthApp(`/tickets/${ticket.id}`);
      await screen.findByRole('heading', { name: ticket.title });
      expect(
        Boolean(screen.queryByRole('button', { name: 'Delete ticket' })),
      ).toBe(actorRole === 'ADMIN');
      expect(screen.getByText(ticket.description)).toBeVisible();
    },
  );

  it('patches only changed USER fields and invalidates detail and list queries', async () => {
    let body: unknown;
    const invalidation = vi.spyOn(queryClient, 'invalidateQueries');
    server.use(
      http.patch(`${base}/tickets/:id`, async ({ request }) => {
        body = await request.json();
        record = {
          ...record,
          title: 'Updated title',
          updatedAt: '2026-10-16T13:00:00Z',
        };
        return HttpResponse.json({ data: record });
      }),
    );
    renderAuthApp(`/tickets/${ticket.id}/edit`);
    const title = await screen.findByLabelText('Title');
    fireEvent.change(title, { target: { value: 'Updated title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save ticket' }));
    expect(
      await screen.findByRole('heading', { name: 'Updated title' }),
    ).toBeVisible();
    expect(body).toEqual({ title: 'Updated title' });
    expect(invalidation).toHaveBeenCalledWith({ queryKey: ['tickets'] });
    expect(invalidation).toHaveBeenCalledWith({
      queryKey: ['ticket', ticket.id],
    });
  });

  it('sends only the selected valid status transition and allows unassignment', async () => {
    role = 'AGENT';
    record.assignedTo = user.id;
    let body: unknown;
    server.use(
      http.patch(`${base}/tickets/:id`, async ({ request }) => {
        body = await request.json();
        record = { ...record, status: 'IN_PROGRESS', assignedTo: null };
        return HttpResponse.json({ data: record });
      }),
    );
    renderAuthApp(`/tickets/${ticket.id}/edit`);
    fireEvent.change(await screen.findByLabelText('Status'), {
      target: { value: 'IN_PROGRESS' },
    });
    fireEvent.change(screen.getByLabelText('Assigned to (staff user ID)'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save ticket' }));
    await screen.findByRole('heading', { name: ticket.title });
    expect(body).toEqual({ status: 'IN_PROGRESS', assignedTo: null });
  });

  it('creates a USER ticket without exposing or sending staff fields', async () => {
    let body: unknown;
    server.use(
      http.post(`${base}/tickets`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: record }, { status: 201 });
      }),
    );
    renderAuthApp('/tickets/new');
    fireEvent.change(await screen.findByLabelText('Title'), {
      target: { value: ticket.title },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: ticket.description },
    });
    expect(screen.queryByLabelText('Priority')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save ticket' }));
    await screen.findByRole('heading', { name: ticket.title });
    expect(body).toEqual({
      title: ticket.title,
      description: ticket.description,
    });
  });

  it('requires confirmation before deleting and lets Cancel abort it', async () => {
    role = 'ADMIN';
    let deletes = 0;
    server.use(
      http.delete(`${base}/tickets/:id`, () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderAuthApp(`/tickets/${ticket.id}`);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete ticket' }),
    );
    expect(await screen.findByRole('alertdialog')).toHaveAccessibleName(
      'Delete this ticket?',
    );
    expect(deletes).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(deletes).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Delete ticket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(
      await screen.findByRole('heading', { name: 'Tickets' }),
    ).toBeVisible();
    expect(deletes).toBe(1);
  });

  it('shows a friendly 404 inline and as a toast', async () => {
    const notify = vi.spyOn(toast, 'error');
    server.use(
      http.get(`${base}/tickets/:id`, () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Ticket was not found' } },
          { status: 404 },
        ),
      ),
    );
    renderAuthApp(`/tickets/${ticket.id}`);
    expect(
      await screen.findByRole('heading', { name: 'Ticket not found' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'may have been deleted',
    );
    expect(notify).toHaveBeenCalled();
  });

  it('keeps form changes and shows conflict feedback inline and as a toast', async () => {
    const notify = vi.spyOn(toast, 'error');
    server.use(
      http.patch(`${base}/tickets/:id`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Ticket changed on the server.',
            },
          },
          { status: 409 },
        ),
      ),
    );
    renderAuthApp(`/tickets/${ticket.id}/edit`);
    fireEvent.change(await screen.findByLabelText('Title'), {
      target: { value: 'My unsaved title' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save ticket' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('conflict');
    expect(screen.getByLabelText('Title')).toHaveValue('My unsaved title');
    expect(screen.getByRole('button', { name: 'Reload ticket' })).toBeVisible();
    expect(notify).toHaveBeenCalled();
  });
});
