import { expectAccessible } from '@/test/accessibility';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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
import { server } from '@/test/server';
import { ticket, user } from '@/test/fixtures';
import { queryClient } from '@/lib/query-client';

const base = `${window.location.origin}/api/v1`;
function listResponse(url: string, empty = false) {
  const params = new URL(url).searchParams;
  return HttpResponse.json({
    data: empty ? [] : [ticket],
    meta: {
      page: Number(params.get('page') ?? 1),
      pageSize: Number(params.get('pageSize') ?? 20),
      total: empty ? 0 : 41,
      totalPages: empty ? 0 : 3,
    },
  });
}
function currentParams() {
  return new URL(
    screen.getByLabelText('Current location').textContent ?? '',
    'http://test.local',
  ).searchParams;
}
function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  queryClient.clear();
  server.use(
    http.get(`${base}/users/me`, () =>
      HttpResponse.json({ data: { ...user, role: 'AGENT' } }),
    ),
    http.get(`${base}/tickets`, ({ request }) => listResponse(request.url)),
  );
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});
afterAll(() => server.close());

describe('Tickets page', () => {
  it('restores a shared URL into filters and sends the same API query', async () => {
    let sent = new URLSearchParams();
    server.use(
      http.get(`${base}/tickets`, ({ request }) => {
        sent = new URL(request.url).searchParams;
        return listResponse(request.url);
      }),
    );
    renderAuthApp(
      `/tickets?page=2&pageSize=10&status=OPEN&priority=HIGH&assignedTo=${user.id}&q=printer&sort=priority&order=asc`,
    );
    expect(
      await screen.findByRole('link', { name: ticket.title }),
    ).toBeVisible();
    expect(screen.getByLabelText('Status')).toHaveValue('OPEN');
    expect(screen.getByLabelText('Priority')).toHaveValue('HIGH');
    expect(screen.getByLabelText('Search tickets')).toHaveValue('printer');
    expect(screen.getByLabelText('Assigned to (user ID)')).toHaveValue(user.id);
    expect(screen.getByLabelText('Tickets per page')).toHaveValue(10);
    expect(Object.fromEntries(sent)).toEqual(
      Object.fromEntries(currentParams()),
    );
    expect(sent.get('sort')).toBe('priority');
    expect(sent.get('order')).toBe('asc');
    expect(screen.getByText('Page 2 of 3')).toBeVisible();
    await expectAccessible();
  });

  it('applies search, filters, sorting and page size to URL and resets the page', async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(`${base}/tickets`, ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return listResponse(request.url);
      }),
    );
    renderAuthApp('/tickets?page=3');
    await screen.findByRole('link', { name: ticket.title });
    fireEvent.change(screen.getByLabelText('Search tickets'), {
      target: { value: '  printer jam  ' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'IN_PROGRESS' },
    });
    fireEvent.change(screen.getByLabelText('Priority'), {
      target: { value: 'URGENT' },
    });
    fireEvent.change(screen.getByLabelText('Assigned to (user ID)'), {
      target: { value: user.id },
    });
    fireEvent.change(screen.getByLabelText('Sort by'), {
      target: { value: 'status' },
    });
    fireEvent.change(screen.getByLabelText('Sort direction'), {
      target: { value: 'asc' },
    });
    fireEvent.change(screen.getByLabelText('Tickets per page'), {
      target: { value: '50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(requests.at(-1)?.get('q')).toBe('printer jam'));
    expect(Object.fromEntries(currentParams())).toEqual({
      page: '1',
      pageSize: '50',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      assignedTo: user.id,
      q: 'printer jam',
      sort: 'status',
      order: 'asc',
    });
  });

  it('restores filters using back and forward navigation', async () => {
    renderAuthApp('/tickets?status=OPEN', true);
    await screen.findByRole('link', { name: ticket.title });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'CLOSED' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(currentParams().get('status')).toBe('CLOSED'));
    fireEvent.click(screen.getByRole('button', { name: 'History back' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Status')).toHaveValue('OPEN'),
    );
    expect(currentParams().get('status')).toBe('OPEN');
    fireEvent.click(screen.getByRole('button', { name: 'History forward' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Status')).toHaveValue('CLOSED'),
    );
  });

  it('shows the empty state and can reset active filters', async () => {
    server.use(
      http.get(`${base}/tickets`, ({ request }) =>
        listResponse(request.url, true),
      ),
    );
    renderAuthApp('/tickets?q=nothing&priority=URGENT');
    expect(
      await screen.findByRole('heading', { name: 'No tickets found' }),
    ).toBeVisible();
    expect(
      screen.getByText('Try changing or resetting your filters.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(currentParams().has('q')).toBe(false));
    expect(currentParams().has('priority')).toBe(false);
    expect(
      await screen.findByText('There are no support requests to show yet.'),
    ).toBeVisible();
  });

  it('hides staff filters from USERs and strips staff query parameters', async () => {
    let sent = new URLSearchParams();
    server.use(
      http.get(`${base}/users/me`, () => HttpResponse.json({ data: user })),
      http.get(`${base}/tickets`, ({ request }) => {
        sent = new URL(request.url).searchParams;
        return listResponse(request.url);
      }),
    );
    renderAuthApp(
      `/tickets?assignedTo=${user.id}&createdBy=${user.id}&status=OPEN`,
    );
    await screen.findByRole('link', { name: ticket.title });
    expect(
      screen.queryByLabelText('Assigned to (user ID)'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Assigned to' }),
    ).not.toBeInTheDocument();
    expect(sent.has('assignedTo')).toBe(false);
    expect(sent.has('createdBy')).toBe(false);
    await waitFor(() => expect(currentParams().has('assignedTo')).toBe(false));
  });

  it('shows skeletons on first load and keeps previous rows while paging', async () => {
    const first = deferred();
    const second = deferred();
    server.use(
      http.get(`${base}/tickets`, async ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        await (page === '2' ? second.promise : first.promise);
        return page === '2'
          ? HttpResponse.json({
              data: [{ ...ticket, title: 'Second page ticket' }],
              meta: { page: 2, pageSize: 20, total: 41, totalPages: 3 },
            })
          : listResponse(request.url);
      }),
    );
    renderAuthApp('/tickets');
    expect(
      await screen.findByRole('status', { name: 'Loading tickets' }),
    ).toBeVisible();
    first.resolve();
    await screen.findByRole('link', { name: ticket.title });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Loading page 2… Showing previous results.');
    expect(screen.getByRole('link', { name: ticket.title })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(currentParams().get('page')).toBe('2');
    second.resolve();
    expect(
      await screen.findByRole('link', { name: 'Second page ticket' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: ticket.title }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(
      await screen.findByRole('link', { name: ticket.title }),
    ).toBeVisible();
  });

  it('shows an API error and retries on request', async () => {
    let attempts = 0;
    server.use(
      http.get(`${base}/tickets`, ({ request }) => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json(
              {
                error: {
                  code: 'BAD_REQUEST',
                  message: 'Tickets are unavailable.',
                },
              },
              { status: 400 },
            )
          : listResponse(request.url);
      }),
    );
    renderAuthApp('/tickets');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tickets are unavailable.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('link', { name: ticket.title }),
    ).toBeVisible();
    expect(attempts).toBe(2);
  });

  it('normalizes invalid URL values before sending the API query', async () => {
    renderAuthApp(
      '/tickets?page=-2&pageSize=999&status=INVALID&assignedTo=invalid',
    );
    await screen.findByRole('link', { name: ticket.title });
    await waitFor(() => expect(currentParams().get('page')).toBe('1'));
    expect(currentParams().get('pageSize')).toBe('20');
    expect(currentParams().has('status')).toBe(false);
    await waitFor(() => expect(currentParams().has('assignedTo')).toBe(false));
  });
});
