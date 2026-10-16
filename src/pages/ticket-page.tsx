import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertDialog } from 'radix-ui';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { useAuth } from '@/auth/context';
import { useTicket, canEditTicket } from '@/features/tickets/detail';
import { CommentThread } from '@/features/tickets/comment-thread';
import { displayEnum } from '@/features/tickets/search';
import { TicketError, ticketErrorMessage } from '@/components/ticket-error';
import { Button } from '@/components/ui/button';

export function TicketPage() {
  const { id = '' } = useParams<'id'>();
  const { user } = useAuth();
  const ticket = useTicket(id);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const deletion = useMutation({
    mutationFn: () =>
      api.request('delete', '/tickets/{ticketId}', {
        params: { ticketId: id },
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket deleted.');
      navigate('/tickets', { replace: true });
      cache.removeQueries({ queryKey: ['ticket', id] });
      cache.removeQueries({ queryKey: ['comments', id] });
    },
    onError: (error) => {
      toast.error(ticketErrorMessage(error));
    },
  });
  useEffect(() => {
    document.title = ticket.data
      ? `${ticket.data.data.title} | Triage`
      : 'Ticket | Triage';
  }, [ticket.data]);
  if (ticket.isPending) return <p role="status">Loading ticket…</p>;
  if (ticket.isError)
    return (
      <TicketError
        error={ticket.error}
        retry={() => {
          void ticket.refetch();
        }}
      />
    );
  const data = ticket.data.data;
  return (
    <section className="max-w-4xl space-y-6">
      <Link to="/tickets" className="text-sm underline underline-offset-4">
        Back to tickets
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
        <div className="flex gap-2">
          {user && canEditTicket(data, user) && (
            <Button asChild variant="outline">
              <Link to={`/tickets/${encodeURIComponent(id)}/edit`}>
                Edit ticket
              </Link>
            </Button>
          )}
          {user?.role === 'ADMIN' && (
            <AlertDialog.Root
              open={confirming}
              onOpenChange={(open) => {
                if (!deletion.isPending) {
                  setConfirming(open);
                  deletion.reset();
                }
              }}
            >
              <AlertDialog.Trigger asChild>
                <Button variant="destructive">Delete ticket</Button>
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
                <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border bg-card p-6 shadow-lg">
                  <AlertDialog.Title className="text-xl font-semibold">
                    Delete this ticket?
                  </AlertDialog.Title>
                  <AlertDialog.Description className="text-muted-foreground">
                    This permanently deletes the ticket and its comments. This
                    action cannot be undone.
                  </AlertDialog.Description>
                  {deletion.isError && (
                    <p role="alert" className="text-destructive">
                      {ticketErrorMessage(deletion.error)}
                    </p>
                  )}
                  <div className="flex justify-end gap-3">
                    <AlertDialog.Cancel asChild>
                      <Button variant="outline" disabled={deletion.isPending}>
                        Cancel
                      </Button>
                    </AlertDialog.Cancel>
                    <Button
                      variant="destructive"
                      disabled={deletion.isPending}
                      onClick={() => deletion.mutate()}
                    >
                      {deletion.isPending ? 'Deleting…' : 'Confirm delete'}
                    </Button>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          )}
        </div>
      </div>
      {deletion.isError && (
        <p role="alert" className="text-destructive">
          {ticketErrorMessage(deletion.error)}
        </p>
      )}
      <dl className="grid gap-4 rounded-xl border bg-card p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Status</dt>
          <dd>{displayEnum(data.status)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Priority</dt>
          <dd>{displayEnum(data.priority)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Assigned to</dt>
          <dd className="break-all">{data.assignedTo ?? 'Unassigned'}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Created</dt>
          <dd>
            <time dateTime={data.createdAt}>
              {new Date(data.createdAt).toLocaleString()}
            </time>
          </dd>
        </div>
      </dl>
      <div className="rounded-xl border bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">Description</h2>
        <p className="whitespace-pre-wrap break-words">{data.description}</p>
      </div>
      {user?.role === 'USER' && !canEditTicket(data, user) && (
        <p className="text-sm text-muted-foreground">
          You can edit only your own open tickets.
        </p>
      )}
      <CommentThread key={data.id} ticket={data} />
    </section>
  );
}
