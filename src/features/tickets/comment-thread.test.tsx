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
const mine: components['schemas']['ListedComment'] = {
  id: '9d128fe3-14da-47fd-9986-44dfe4241987',
  ticketId: ticket.id,
  body: 'First comment',
  createdAt: '2026-10-16T12:00:00Z',
  updatedAt: '2026-10-16T12:00:00Z',
  author: { id: user.id, name: 'Alex', role: 'USER' },
};
const other: components['schemas']['ListedComment'] = {
  ...mine,
  id: '0b7f0345-d50c-491a-870e-c2b31d3dbd74',
  body: 'Second comment',
  createdAt: '2026-10-16T13:00:00Z',
  author: {
    id: '7b92c8ee-711c-4059-a635-4ffd08878fa3',
    name: 'Sam',
    role: 'AGENT',
  },
};
let role: components['schemas']['User']['role'];
let status: components['schemas']['Ticket']['status'];
let records: components['schemas']['ListedComment'][];
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  queryClient.clear();
  role = 'USER';
  status = 'OPEN';
  records = [mine, other];
  server.use(
    http.get(`${base}/users/me`, () =>
      HttpResponse.json({ data: { ...user, role } }),
    ),
    http.get(`${base}/tickets/:id`, () =>
      HttpResponse.json({ data: { ...ticket, status } }),
    ),
    http.get(`${base}/tickets/:id/comments`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      return HttpResponse.json({
        data: {
          data: records,
          page: Number(params.get('page')),
          limit: Number(params.get('limit')),
          total: records.length,
        },
      });
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});
afterAll(() => server.close());

describe('Comment thread', () => {
  it.each(['USER', 'AGENT', 'ADMIN'] as const)(
    'shows deletion only for own comments or ADMIN (%s)',
    async (actorRole) => {
      role = actorRole;
      renderAuthApp(`/tickets/${ticket.id}`);
      await screen.findByText('First comment');
      expect(
        screen.getByRole('button', { name: 'Delete comment by Alex' }),
      ).toBeVisible();
      expect(
        Boolean(
          screen.queryByRole('button', { name: 'Delete comment by Sam' }),
        ),
      ).toBe(actorRole === 'ADMIN');
    },
  );

  it.each(['USER', 'AGENT', 'ADMIN'] as const)(
    'disables adding on CLOSED for %s but keeps reading and authorized deletion',
    async (actorRole) => {
      role = actorRole;
      status = 'CLOSED';
      renderAuthApp(`/tickets/${ticket.id}`);
      await screen.findByText('First comment');
      expect(screen.getByLabelText('Comment')).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Add comment' }),
      ).toBeDisabled();
      expect(
        screen.getByText(/This ticket is closed. New comments are disabled/),
      ).toBeVisible();
      expect(
        screen.getByRole('button', { name: 'Delete comment by Alex' }),
      ).toBeEnabled();
    },
  );

  it('keeps the API oldest-first order and uses page and limit for pagination', async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(`${base}/tickets/:id/comments`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push(params);
        return HttpResponse.json({
          data: {
            data:
              params.get('page') === '2'
                ? [{ ...other, body: 'Last page comment' }]
                : records,
            page: Number(params.get('page')),
            limit: 50,
            total: 51,
          },
        });
      }),
    );
    renderAuthApp(`/tickets/${ticket.id}`);
    const thread = await screen.findByRole('list', { name: 'Comment thread' });
    const items = within(thread).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('First comment');
    expect(items[1]).toHaveTextContent('Second comment');
    expect(requests[0]?.get('limit')).toBe('50');
    fireEvent.click(screen.getByRole('button', { name: 'Next comments' }));
    expect(await screen.findByText('Last page comment')).toBeVisible();
    expect(requests.at(-1)?.get('page')).toBe('2');
    expect(
      screen.getByRole('button', { name: 'Next comments' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous comments' }));
    expect(await screen.findByText('First comment')).toBeVisible();
  });

  it('adds a trimmed comment and invalidates all comment pages', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    server.use(
      http.post(`${base}/tickets/:id/comments`, async ({ request }) => {
        expect(await request.json()).toEqual({ body: 'New comment' });
        expect(request.headers.get('X-CSRF-Protection')).toBe('1');
        const created = {
          ...mine,
          id: '398c7fb2-0816-4aee-a802-99d830d5b91b',
          body: 'New comment',
        };
        records = [...records, created];
        const { id, ticketId, body, createdAt, updatedAt } = created;
        const response = { id, ticketId, body, createdAt, updatedAt };
        return HttpResponse.json({ data: response }, { status: 201 });
      }),
    );
    renderAuthApp(`/tickets/${ticket.id}`);
    await screen.findByText('First comment');
    fireEvent.change(screen.getByLabelText('Comment'), {
      target: { value: '  New comment  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(await screen.findByText('New comment')).toBeVisible();
    expect(screen.getByLabelText('Comment')).toHaveValue('');
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['comments', ticket.id],
    });
  });

  it('deletes an own comment even when the ticket is CLOSED', async () => {
    status = 'CLOSED';
    server.use(
      http.delete(
        `${base}/tickets/:id/comments/:commentId`,
        ({ params, request }) => {
          expect(params.commentId).toBe(mine.id);
          expect(request.headers.get('X-CSRF-Protection')).toBe('1');
          records = records.filter(
            (comment) => comment.id !== params.commentId,
          );
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );
    renderAuthApp(`/tickets/${ticket.id}`);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete comment by Alex' }),
    );
    await waitFor(() =>
      expect(screen.queryByText('First comment')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Second comment')).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Comments' })).toHaveFocus(),
    );
  });

  it('handles a closing race with 409 feedback, a preserved draft, and disabled composer', async () => {
    const notify = vi.spyOn(toast, 'error');
    server.use(
      http.post(`${base}/tickets/:id/comments`, () => {
        status = 'CLOSED';
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Closed tickets do not accept new comments',
            },
          },
          { status: 409 },
        );
      }),
    );
    renderAuthApp(`/tickets/${ticket.id}`);
    await screen.findByText('First comment');
    fireEvent.change(screen.getByLabelText('Comment'), {
      target: { value: 'Keep my draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your draft has been kept',
    );
    expect(screen.getByLabelText('Comment')).toHaveValue('Keep my draft');
    expect(screen.getByLabelText('Comment')).toBeDisabled();
    expect(notify).toHaveBeenCalled();
  });

  it('rejects empty or whitespace-only comments locally', async () => {
    const post = vi.fn(() => HttpResponse.json({}));
    server.use(http.post(`${base}/tickets/:id/comments`, post));
    renderAuthApp(`/tickets/${ticket.id}`);
    await screen.findByText('First comment');
    fireEvent.change(screen.getByLabelText('Comment'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(await screen.findByText('Enter a comment.')).toBeVisible();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows comment-list errors with retry and an empty state', async () => {
    let calls = 0;
    server.use(
      http.get(`${base}/tickets/:id/comments`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              {
                error: {
                  code: 'BAD_REQUEST',
                  message: 'Could not load comments.',
                },
              },
              { status: 400 },
            )
          : HttpResponse.json({
              data: { data: [], page: 1, limit: 50, total: 0 },
            });
      }),
    );
    renderAuthApp(`/tickets/${ticket.id}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load comments.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry comments' }));
    expect(await screen.findByText('No comments yet.')).toBeVisible();
  });
});
