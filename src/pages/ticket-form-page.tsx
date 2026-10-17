import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api, ApiError } from '@/api/client';
import type { components } from '@/api/schema';
import { useAuth } from '@/auth/context';
import {
  canEditTicket,
  nextStatuses,
  useTicket,
  type Ticket,
} from '@/features/tickets/detail';
import { displayEnum, priorities, statuses } from '@/features/tickets/search';
import { TicketError, ticketErrorMessage } from '@/components/ticket-error';
import { LiveStatus } from '@/components/live-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters.')
    .max(200),
  description: z.string().trim().min(1, 'Enter a description.').max(10_000),
  priority: z.enum(priorities),
  status: z.union([z.literal(''), z.enum(statuses)]),
  assignedTo: z.union([
    z.literal(''),
    z.uuid('Enter a valid staff user UUID.'),
  ]),
});
type Values = z.infer<typeof schema>;

function TicketForm({ ticket }: { ticket?: Ticket }) {
  const { user } = useAuth();
  const staff = user?.role === 'AGENT' || user?.role === 'ADMIN';
  const cache = useQueryClient();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: ticket?.title ?? '',
      description: ticket?.description ?? '',
      priority: ticket?.priority ?? 'MEDIUM',
      status: '',
      assignedTo: ticket?.assignedTo ?? '',
    },
  });
  const save = useMutation({
    mutationFn: async (values: Values) => {
      if (!ticket)
        return api.request('post', '/tickets', {
          body: {
            title: values.title,
            description: values.description,
            ...(staff ? { priority: values.priority } : {}),
          },
        });
      const body: components['schemas']['updateTicketBody'] = {};
      if (values.title !== ticket.title) body.title = values.title;
      if (values.description !== ticket.description)
        body.description = values.description;
      if (staff) {
        if (values.priority !== ticket.priority)
          body.priority = values.priority;
        if (values.assignedTo !== (ticket.assignedTo ?? ''))
          body.assignedTo = values.assignedTo || null;
        if (
          values.status &&
          nextStatuses[ticket.status].includes(values.status)
        )
          body.status = values.status;
      }
      if (Object.keys(body).length === 0)
        throw new ApiError(400, 'NO_CHANGES', 'Make a change before saving.');
      return api.request('patch', '/tickets/{ticketId}', {
        params: { ticketId: ticket.id },
        body,
      });
    },
    onSuccess: async (result) => {
      cache.setQueriesData<components['schemas']['TicketResponse']>(
        { queryKey: ['ticket', result.data.id] },
        result,
      );
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['tickets'] }),
        cache.invalidateQueries({ queryKey: ['ticket', result.data.id] }),
      ]);
      toast.success(ticket ? 'Ticket updated.' : 'Ticket created.');
      navigate(`/tickets/${encodeURIComponent(result.data.id)}`, {
        replace: true,
      });
    },
    onError: (error) => {
      toast.error(ticketErrorMessage(error));
    },
  });
  const title = ticket ? 'Edit ticket' : 'Create ticket';
  useEffect(() => {
    document.title = `${title} | Triage`;
  }, [title]);
  return (
    <section className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <LiveStatus label="Ticket save status">
        {save.isPending ? 'Saving ticket…' : ''}
      </LiveStatus>
      <form
        className="space-y-5 rounded-xl border bg-card p-6"
        noValidate
        aria-label={title}
        aria-busy={save.isPending}
        onSubmit={(event) => {
          void handleSubmit(async (values) => {
            try {
              await save.mutateAsync(values);
            } catch (error) {
              if (error instanceof ApiError && Array.isArray(error.details)) {
                for (const detail of error.details) {
                  const parsed = z
                    .object({
                      path: z.array(z.union([z.string(), z.number()])),
                      message: z.string(),
                    })
                    .safeParse(detail);
                  if (parsed.success) {
                    const field = parsed.data.path.at(-1);
                    if (
                      field === 'title' ||
                      field === 'description' ||
                      field === 'priority' ||
                      field === 'assignedTo' ||
                      field === 'status'
                    )
                      setError(field, { message: parsed.data.message });
                  }
                }
              }
            }
          })(event);
        }}
      >
        <fieldset disabled={save.isPending} className="space-y-5">
          <legend className="sr-only">Ticket details</legend>
          <div className="space-y-2">
            <label htmlFor="edit-title">Title</label>
            <Input
              id="edit-title"
              required
              maxLength={200}
              {...register('title')}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'title-error' : undefined}
            />
            {errors.title && (
              <p role="alert" id="title-error">
                {errors.title.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="edit-description">Description</label>
            <textarea
              id="edit-description"
              required
              className="min-h-40 w-full rounded-md border bg-background p-3"
              maxLength={10_000}
              {...register('description')}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? 'description-error' : undefined
              }
            />
            {errors.description && (
              <p role="alert" id="description-error">
                {errors.description.message}
              </p>
            )}
          </div>
          {staff && (
            <>
              <div className="space-y-2">
                <label htmlFor="edit-priority">Priority</label>
                <select
                  id="edit-priority"
                  className="h-10 w-full rounded-md border bg-background px-3"
                  {...register('priority')}
                  aria-invalid={Boolean(errors.priority)}
                  aria-describedby={
                    errors.priority ? 'priority-error' : undefined
                  }
                >
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {displayEnum(priority)}
                    </option>
                  ))}
                </select>
                {errors.priority && (
                  <p id="priority-error" role="alert">
                    {errors.priority.message}
                  </p>
                )}
              </div>
              {ticket && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="edit-status">Status</label>
                    <select
                      id="edit-status"
                      className="h-10 w-full rounded-md border bg-background px-3"
                      disabled={nextStatuses[ticket.status].length === 0}
                      {...register('status')}
                      aria-invalid={Boolean(errors.status)}
                      aria-describedby={
                        errors.status ? 'status-error' : undefined
                      }
                    >
                      <option value="">
                        Keep current status ({displayEnum(ticket.status)})
                      </option>
                      {nextStatuses[ticket.status].map((status) => (
                        <option key={status} value={status}>
                          {displayEnum(status)}
                        </option>
                      ))}
                    </select>
                    {errors.status && (
                      <p id="status-error" role="alert">
                        {errors.status.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="edit-assignee">
                      Assigned to (staff user ID)
                    </label>
                    <Input
                      id="edit-assignee"
                      {...register('assignedTo')}
                      aria-invalid={Boolean(errors.assignedTo)}
                      aria-describedby="assignment-help assignment-error"
                    />
                    <p
                      id="assignment-help"
                      className="text-sm text-muted-foreground"
                    >
                      Enter an agent or administrator UUID. Leave blank to
                      unassign.
                    </p>
                    <p
                      id="assignment-error"
                      role={errors.assignedTo ? 'alert' : undefined}
                    >
                      {errors.assignedTo?.message}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
          <Button type="submit" disabled={Boolean(ticket) && !isDirty}>
            {save.isPending ? 'Saving…' : 'Save ticket'}
          </Button>
        </fieldset>
        {save.isError && (
          <div className="space-y-3">
            <p role="alert" className="text-destructive">
              {ticketErrorMessage(save.error)}
            </p>
            {ticket &&
              save.error instanceof ApiError &&
              save.error.status === 409 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void cache.invalidateQueries({
                      queryKey: ['ticket', ticket.id],
                    });
                  }}
                >
                  Reload ticket
                </Button>
              )}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={save.isPending}
          onClick={() => {
            navigate(
              ticket ? `/tickets/${encodeURIComponent(ticket.id)}` : '/tickets',
            );
          }}
        >
          Cancel
        </Button>
      </form>
    </section>
  );
}
export function CreateTicketPage() {
  return <TicketForm />;
}
export function EditTicketPage() {
  const { id = '' } = useParams<'id'>();
  const { user } = useAuth();
  const ticket = useTicket(id);
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
  if (!user || !canEditTicket(ticket.data.data, user))
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Ticket cannot be edited</h1>
        <p role="alert">You can edit only your own open tickets.</p>
        <Link to="/tickets" className="underline">
          Back to tickets
        </Link>
      </section>
    );
  return (
    <TicketForm
      key={ticket.data.data.id + ticket.data.data.updatedAt}
      ticket={ticket.data.data}
    />
  );
}
