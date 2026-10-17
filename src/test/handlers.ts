import { http, HttpResponse } from 'msw';
import type { components } from '@/api/schema';
import { createUser, ticket } from '@/test/fixtures';

const base = `${window.location.origin}${import.meta.env.VITE_API_BASE_PATH || '/api/v1'}`;
type User = components['schemas']['User'];

// Baseline read-only responses; override individual scenarios with server.use().
export function createHandlers({
  currentUser = createUser(),
}: {
  currentUser?: User | null;
} = {}) {
  const session = () =>
    currentUser
      ? HttpResponse.json({
          data: currentUser,
        } satisfies components['schemas']['UserResponse'])
      : HttpResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required.',
            },
          },
          { status: 401 },
        );
  return [
    http.get(`${base}/users/me`, session),
    http.post(`${base}/auth/refresh`, session),
    http.get(`${base}/tickets`, () =>
      HttpResponse.json({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      } satisfies components['schemas']['TicketPage']),
    ),
    http.get(`${base}/tickets/:ticketId`, ({ params }) =>
      params.ticketId === ticket.id
        ? HttpResponse.json({ data: ticket })
        : HttpResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Ticket not found.' } },
            { status: 404 },
          ),
    ),
    http.get(`${base}/tickets/:ticketId/comments`, () =>
      HttpResponse.json({
        data: { data: [], page: 1, limit: 50, total: 0 },
      } satisfies components['schemas']['CommentPage']),
    ),
    http.get(`${base}/users`, () =>
      HttpResponse.json({
        data: { data: [], page: 1, limit: 20, total: 0 },
      } satisfies components['schemas']['UserPage']),
    ),
  ];
}
