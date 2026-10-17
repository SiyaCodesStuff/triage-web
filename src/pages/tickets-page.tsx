import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import { useAuth } from '@/auth/context';
import { LiveStatus } from '@/components/live-status';
import { TableRegion } from '@/components/table-region';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  apiTicketSearch,
  displayEnum,
  priorities,
  readTicketSearch,
  statuses,
  writeTicketSearch,
} from '@/features/tickets/search';

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export function TicketsPage() {
  const { user } = useAuth();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isStaff = user?.role === 'AGENT' || user?.role === 'ADMIN';
  const [params, setParams] = useSearchParams();
  const query = readTicketSearch(params, isStaff);
  const canonical = writeTicketSearch(query).toString();
  const current = params.toString();
  useEffect(() => {
    document.title = 'Tickets | Triage';
  }, []);
  useEffect(() => {
    if (current !== canonical) setParams(canonical, { replace: true });
  }, [current, canonical, setParams]);

  const { page, pageSize, ...filters } = query;
  const filterKey = JSON.stringify(filters);
  const tickets = useQuery({
    queryKey: ['tickets', user?.id, user?.role, filterKey, page, pageSize],
    queryFn: ({ signal }) =>
      api.request('get', '/tickets', { query: apiTicketSearch(query), signal }),
    placeholderData: (previous, previousQuery) =>
      previousQuery !== undefined &&
      previousQuery.queryKey[1] === user?.id &&
      previousQuery.queryKey[2] === user?.role &&
      previousQuery.queryKey[3] === filterKey
        ? previous
        : undefined,
  });

  function changePage(nextPage: number) {
    setParams(writeTicketSearch({ ...query, page: nextPage }));
    headingRef.current?.focus();
  }
  const data = tickets.data;
  const hasFilters = Boolean(
    query.status || query.priority || query.q || query.assignedTo,
  );

  return (
    <section aria-labelledby="tickets-title" className="space-y-6">
      <div className="space-y-2">
        <h1
          id="tickets-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight"
        >
          Tickets
        </h1>
        <p className="text-muted-foreground">
          Keep track of support requests and what needs attention.
        </p>
      </div>
      <Button asChild>
        <Link to="/tickets/new">Create ticket</Link>
      </Button>
      <form
        key={canonical}
        aria-label="Ticket filters"
        className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const next = new URLSearchParams();
          for (const [key, value] of values) {
            if (typeof value === 'string' && value.trim())
              next.set(key, value.trim());
          }
          next.set('page', '1');
          setParams(writeTicketSearch(readTicketSearch(next, isStaff)));
          headingRef.current?.focus();
        }}
      >
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="ticket-search" className="text-sm font-medium">
            Search tickets
          </label>
          <Input
            id="ticket-search"
            name="q"
            type="search"
            maxLength={200}
            defaultValue={query.q ?? ''}
            placeholder="Search title or description"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="ticket-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="ticket-status"
            name="status"
            className={selectClass}
            defaultValue={query.status ?? ''}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {displayEnum(status)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="ticket-priority" className="text-sm font-medium">
            Priority
          </label>
          <select
            id="ticket-priority"
            name="priority"
            className={selectClass}
            defaultValue={query.priority ?? ''}
          >
            <option value="">All priorities</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {displayEnum(priority)}
              </option>
            ))}
          </select>
        </div>
        {isStaff && (
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="ticket-assignee" className="text-sm font-medium">
              Assigned to (user ID)
            </label>
            <Input
              id="ticket-assignee"
              name="assignedTo"
              defaultValue={query.assignedTo ?? ''}
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"
              aria-describedby="assignee-hint"
            />
            <p id="assignee-hint" className="text-xs text-muted-foreground">
              Enter the assigned user’s UUID, or leave blank for all.
            </p>
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="ticket-sort" className="text-sm font-medium">
            Sort by
          </label>
          <select
            id="ticket-sort"
            name="sort"
            className={selectClass}
            defaultValue={query.sort}
          >
            <option value="createdAt">Created date</option>
            <option value="priority">Priority</option>
            <option value="status">Status</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="ticket-order" className="text-sm font-medium">
            Sort direction
          </label>
          <select
            id="ticket-order"
            name="order"
            className={selectClass}
            defaultValue={query.order}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="ticket-page-size" className="text-sm font-medium">
            Tickets per page
          </label>
          <Input
            id="ticket-page-size"
            name="pageSize"
            type="number"
            min={1}
            max={100}
            required
            defaultValue={pageSize}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit">Apply filters</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setParams(
                writeTicketSearch(
                  readTicketSearch(new URLSearchParams(), isStaff),
                ),
              );
              headingRef.current?.focus();
            }}
          >
            Reset
          </Button>
        </div>
      </form>

      <LiveStatus
        label={tickets.isPending ? 'Loading tickets' : 'Ticket results summary'}
      >
        {tickets.isPending
          ? 'Loading tickets…'
          : tickets.isError
            ? ''
            : tickets.isPlaceholderData
              ? `Loading page ${page}… Showing previous results.`
              : data
                ? `${data.meta.total} ${data.meta.total === 1 ? 'ticket' : 'tickets'}. Page ${data.meta.page} of ${Math.max(1, data.meta.totalPages)}.`
                : ''}
      </LiveStatus>
      <div aria-busy={tickets.isFetching} className="space-y-4">
        {tickets.isPending && (
          <div aria-hidden="true">
            <span className="sr-only">Loading tickets…</span>
            <div aria-hidden="true" className="space-y-3 rounded-xl border p-4">
              {[0, 1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="h-12 animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          </div>
        )}
        {tickets.isError && (
          <div className="space-y-3 rounded-xl border p-6">
            <p role="alert">
              {tickets.error instanceof ApiError
                ? tickets.error.message
                : 'Unable to load tickets. Please try again.'}
            </p>
            <Button
              onClick={() => {
                void tickets.refetch();
              }}
            >
              Retry
            </Button>
          </div>
        )}
        {data && !tickets.isError && (
          <>
            {data.data.length === 0 ? (
              <div className="space-y-2 rounded-xl border bg-card p-8 text-center">
                <h2 className="text-lg font-semibold">No tickets found</h2>
                <p className="text-muted-foreground">
                  {hasFilters
                    ? 'Try changing or resetting your filters.'
                    : 'There are no support requests to show yet.'}
                </p>
              </div>
            ) : (
              <TableRegion label="Ticket results">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Support tickets, page {data.meta.page}
                  </caption>
                  <thead className="bg-muted">
                    <tr>
                      <th scope="col" className="p-4">
                        Title
                      </th>
                      <th scope="col" className="p-4">
                        Status
                      </th>
                      <th scope="col" className="p-4">
                        Priority
                      </th>
                      <th scope="col" className="p-4">
                        Created
                      </th>
                      {isStaff && (
                        <th scope="col" className="p-4">
                          Assigned to
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((ticket) => (
                      <tr key={ticket.id} className="border-t">
                        <th scope="row" className="p-4 font-medium">
                          <Link
                            to={`/tickets/${encodeURIComponent(ticket.id)}`}
                            className="underline underline-offset-4"
                          >
                            {ticket.title}
                          </Link>
                        </th>
                        <td className="p-4 whitespace-nowrap">
                          {displayEnum(ticket.status)}
                        </td>
                        <td className="p-4">{displayEnum(ticket.priority)}</td>
                        <td className="p-4 whitespace-nowrap">
                          <time dateTime={ticket.createdAt}>
                            {new Date(ticket.createdAt).toLocaleDateString()}
                          </time>
                        </td>
                        {isStaff && (
                          <td className="p-4">
                            {ticket.assignedTo ?? 'Unassigned'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableRegion>
            )}
            <nav
              aria-label="Ticket pagination"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-sm text-muted-foreground">
                Page {data.meta.page} of {Math.max(1, data.meta.totalPages)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1 || tickets.isPlaceholderData}
                  onClick={() => changePage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    tickets.isPlaceholderData || page >= data.meta.totalPages
                  }
                  onClick={() => changePage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </nav>
          </>
        )}
        {data && !tickets.isError && data.data.length === 0 && page > 1 && (
          <Button variant="outline" onClick={() => changePage(1)}>
            Back to first page
          </Button>
        )}
      </div>
    </section>
  );
}
