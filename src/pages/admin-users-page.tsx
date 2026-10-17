import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertDialog } from 'radix-ui';
import { z } from 'zod';
import { toast } from 'sonner';
import { api, ApiError } from '@/api/client';
import type { components } from '@/api/schema';
import { useAuth } from '@/auth/context';
import { authUserKey } from '@/auth/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type User = components['schemas']['User'];
const roles = ['USER', 'AGENT', 'ADMIN'] as const;
const roleSchema = z.enum(roles);
const filters = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20),
  search: z.string().trim().min(1).max(254).optional().catch(undefined),
});
const selfDemotionMessage =
  'Administrators cannot remove their own administrator role';
function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Unable to load or update users. Please try again.';
}

export function AdminUsersPage() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const roleTrigger = useRef<HTMLSelectElement | null>(null);
  const [params, setParams] = useSearchParams();
  const query = filters.parse(Object.fromEntries(params));
  const canonicalParams = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
    ...(query.search ? { search: query.search } : {}),
  });
  const canonical = canonicalParams.toString();
  const current = params.toString();
  const [pending, setPending] = useState<{
    user: User;
    role: User['role'];
  } | null>(null);
  const [localError, setLocalError] = useState('');
  useEffect(() => {
    document.title = 'Users | Triage';
  }, []);
  useEffect(() => {
    if (current !== canonical) setParams(canonical, { replace: true });
  }, [current, canonical, setParams]);
  const users = useQuery({
    queryKey: ['users', user?.id, query],
    enabled: user?.role === 'ADMIN',
    queryFn: ({ signal }) => api.request('get', '/users', { query, signal }),
  });
  const change = useMutation({
    mutationFn: async (selection: { user: User; role: User['role'] }) => {
      if (selection.user.id === user?.id && selection.role !== 'ADMIN')
        throw new ApiError(403, 'FORBIDDEN', selfDemotionMessage);
      return api.request('patch', '/users/{userId}/role', {
        params: { userId: selection.user.id },
        body: { role: selection.role },
      });
    },
    onSuccess: async (result) => {
      if (result.data.id === user?.id)
        cache.setQueryData(authUserKey, result.data);
      await cache.invalidateQueries({ queryKey: ['users'] });
      setPending(null);
      toast.success('User role updated.');
    },
    onError: (error) => toast.error(message(error)),
  });
  function selectRole(target: User, value: string) {
    const parsed = roleSchema.safeParse(value);
    if (!parsed.success || parsed.data === target.role) return;
    if (target.id === user?.id && parsed.data !== 'ADMIN') {
      setLocalError(selfDemotionMessage);
      toast.error(selfDemotionMessage);
      return;
    }
    change.reset();
    setLocalError('');
    setPending({ user: target, role: parsed.data });
  }
  function goPage(page: number) {
    const next = new URLSearchParams(canonical);
    next.set('page', String(page));
    setParams(next);
  }
  const data = users.data?.data;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / query.limit));
  return (
    <section aria-labelledby="users-title" className="space-y-6">
      <div>
        <h1 id="users-title" className="text-3xl font-semibold">
          Users
        </h1>
        <p className="mt-2 text-muted-foreground">
          Search accounts and manage their roles.
        </p>
      </div>
      <form
        key={canonical}
        aria-label="User search"
        className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const values = filters.parse({
            search: String(form.get('search') ?? '') || undefined,
            limit: form.get('limit'),
            page: 1,
          });
          setParams({
            page: '1',
            limit: String(values.limit),
            ...(values.search ? { search: values.search } : {}),
          });
        }}
      >
        <div className="min-w-48 flex-1 space-y-2">
          <label htmlFor="user-search" className="text-sm font-medium">
            Search users
          </label>
          <Input
            id="user-search"
            name="search"
            type="search"
            maxLength={254}
            defaultValue={query.search ?? ''}
            placeholder="Name or email"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="users-limit" className="text-sm font-medium">
            Users per page
          </label>
          <Input
            id="users-limit"
            name="limit"
            type="number"
            min={1}
            max={100}
            required
            defaultValue={query.limit}
          />
        </div>
        <Button type="submit">Search</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setParams({ page: '1', limit: '20' })}
        >
          Reset
        </Button>
      </form>
      {localError && (
        <p role="alert" className="text-destructive">
          {localError}
        </p>
      )}
      {users.isPending && <p role="status">Loading users…</p>}
      {users.isError && (
        <div className="space-y-3">
          <p role="alert">{message(users.error)}</p>
          <Button
            onClick={() => {
              void users.refetch();
            }}
          >
            Retry users
          </Button>
        </div>
      )}
      {data && !users.isError && (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {data.total} {data.total === 1 ? 'user' : 'users'}
          </p>
          {data.data.length === 0 ? (
            <p className="rounded-xl border p-6">
              No users found. Try another search.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Users, page {data.page}</caption>
                <thead className="bg-muted">
                  <tr>
                    <th scope="col" className="p-4">
                      Name
                    </th>
                    <th scope="col" className="p-4">
                      Email
                    </th>
                    <th scope="col" className="p-4">
                      Role
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((account) => (
                    <tr key={account.id} className="border-t">
                      <th scope="row" className="p-4 font-medium">
                        {account.name}
                        {account.id === user?.id && ' (you)'}
                      </th>
                      <td className="p-4">{account.email}</td>
                      <td className="p-4">
                        <label
                          className="sr-only"
                          htmlFor={`role-${account.id}`}
                        >
                          Role for {account.email}
                        </label>
                        <select
                          id={`role-${account.id}`}
                          className="h-10 rounded-md border bg-background px-3 disabled:opacity-60"
                          value={account.role}
                          disabled={account.id === user?.id || change.isPending}
                          aria-describedby={
                            account.id === user?.id
                              ? 'self-role-help'
                              : undefined
                          }
                          onChange={(event) => {
                            roleTrigger.current = event.currentTarget;
                            selectRole(account, event.target.value);
                          }}
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                        {account.id === user?.id && (
                          <p
                            id="self-role-help"
                            className="mt-2 text-sm text-muted-foreground"
                          >
                            You cannot demote your own administrator account.
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav
            aria-label="User pagination"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm">
              Page {data.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={query.page <= 1 || users.isFetching}
                onClick={() => goPage(query.page - 1)}
              >
                Previous users
              </Button>
              <Button
                variant="outline"
                disabled={query.page >= totalPages || users.isFetching}
                onClick={() => goPage(query.page + 1)}
              >
                Next users
              </Button>
            </div>
          </nav>
          {query.page > totalPages && (
            <Button variant="outline" onClick={() => goPage(1)}>
              Back to first page
            </Button>
          )}
        </>
      )}
      <AlertDialog.Root
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !change.isPending) setPending(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <AlertDialog.Content
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              roleTrigger.current?.focus();
            }}
            className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border bg-card p-6 shadow-lg"
          >
            <AlertDialog.Title className="text-xl font-semibold">
              Confirm role change
            </AlertDialog.Title>
            <AlertDialog.Description>
              Change {pending?.user.email} from {pending?.user.role} to{' '}
              {pending?.role}? This changes their access on their next API
              request.
            </AlertDialog.Description>
            {change.isError && (
              <p role="alert" className="text-destructive">
                {message(change.error)}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <AlertDialog.Cancel asChild>
                <Button variant="outline" disabled={change.isPending}>
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <Button
                disabled={change.isPending || !pending}
                onClick={() => {
                  if (pending) change.mutate(pending);
                }}
              >
                {change.isPending ? 'Updating role…' : 'Confirm change'}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
