import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api, ApiError } from '@/api/client';
import { useAuth } from '@/auth/context';
import type { Ticket } from '@/features/tickets/detail';
import { Button } from '@/components/ui/button';

const schema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Enter a comment.')
    .max(4000, 'Comments must be at most 4,000 characters.'),
});
const limit = 50;
function errorMessage(error: unknown) {
  if (error instanceof ApiError)
    return error.status === 409
      ? 'This ticket is closed and no longer accepts comments. Your draft has been kept.'
      : error.message;
  return 'Unable to load or update comments. Please try again.';
}

export function CommentThread({ ticket }: { ticket: Ticket }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const comments = useQuery({
    queryKey: ['comments', ticket.id, user?.id, user?.role, page],
    queryFn: ({ signal }) =>
      api.request('get', '/tickets/{ticketId}/comments', {
        params: { ticketId: ticket.id },
        query: { page, limit },
        signal,
      }),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { body: '' },
  });
  const add = useMutation({
    mutationFn: (body: z.infer<typeof schema>) =>
      api.request('post', '/tickets/{ticketId}/comments', {
        params: { ticketId: ticket.id },
        body,
      }),
    onSuccess: async () => {
      reset();
      const lastPage = Math.max(
        1,
        Math.ceil(((comments.data?.data.total ?? 0) + 1) / limit),
      );
      await cache.invalidateQueries({ queryKey: ['comments', ticket.id] });
      setPage(lastPage);
      toast.success('Comment added.');
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && error.status === 409)
        void cache.invalidateQueries({ queryKey: ['ticket', ticket.id] });
    },
  });
  const remove = useMutation({
    mutationFn: (commentId: string) =>
      api.request('delete', '/tickets/{ticketId}/comments/{commentId}', {
        params: { ticketId: ticket.id, commentId },
      }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['comments', ticket.id] });
      if (comments.data?.data.data.length === 1 && page > 1) setPage(page - 1);
      toast.success('Comment deleted.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const closed =
    ticket.status === 'CLOSED' ||
    (add.error instanceof ApiError && add.error.status === 409);
  const data = comments.data?.data;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));
  return (
    <section
      aria-labelledby="comments-title"
      className="space-y-5 border-t pt-6"
    >
      <div>
        <h2 id="comments-title" className="text-xl font-semibold">
          Comments
        </h2>
        <p className="text-sm text-muted-foreground">Oldest first</p>
      </div>
      {comments.isPending && <p role="status">Loading comments…</p>}
      {comments.isError && (
        <div className="space-y-2">
          <p role="alert">{errorMessage(comments.error)}</p>
          <Button
            variant="outline"
            onClick={() => {
              void comments.refetch();
            }}
          >
            Retry comments
          </Button>
        </div>
      )}
      {data && !comments.isError && (
        <>
          {data.data.length === 0 ? (
            <p className="text-muted-foreground">No comments yet.</p>
          ) : (
            <ol aria-label="Comment thread" className="space-y-4">
              {data.data.map((comment) => (
                <li
                  key={comment.id}
                  className="space-y-3 rounded-xl border bg-card p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">
                      <span className="font-medium">{comment.author.name}</span>{' '}
                      ·{' '}
                      <time dateTime={comment.createdAt}>
                        {new Date(comment.createdAt).toLocaleString()}
                      </time>
                    </p>
                    {(user?.id === comment.author.id ||
                      user?.role === 'ADMIN') && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={remove.isPending}
                        aria-label={`Delete comment by ${comment.author.name}`}
                        onClick={() => remove.mutate(comment.id)}
                      >
                        {remove.isPending && remove.variables === comment.id
                          ? 'Deleting…'
                          : 'Delete'}
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words">
                    {comment.body}
                  </p>
                  {remove.isError && remove.variables === comment.id && (
                    <p role="alert" className="text-destructive">
                      {errorMessage(remove.error)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
          <nav
            aria-label="Comment pagination"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-muted-foreground">
              Comments page {data.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1 || comments.isFetching}
                onClick={() => setPage(page - 1)}
              >
                Previous comments
              </Button>
              <Button
                variant="outline"
                disabled={page >= totalPages || comments.isFetching}
                onClick={() => setPage(page + 1)}
              >
                Next comments
              </Button>
            </div>
          </nav>
          {page > totalPages && (
            <Button variant="outline" onClick={() => setPage(totalPages)}>
              Back to available comments
            </Button>
          )}
        </>
      )}
      <form
        noValidate
        aria-label="Add comment"
        aria-busy={isSubmitting}
        className="space-y-3"
        onSubmit={(event) => {
          void handleSubmit(async (values) => {
            try {
              await add.mutateAsync(values);
            } catch {
              /* The mutation reports its error inline and through a toast. */
            }
          })(event);
        }}
      >
        {closed && (
          <p id="comments-closed" className="text-sm text-muted-foreground">
            This ticket is closed. New comments are disabled; existing comments
            can still be read and deleted by their author or an administrator.
          </p>
        )}
        <fieldset
          disabled={closed || isSubmitting}
          aria-describedby={closed ? 'comments-closed' : undefined}
          className="space-y-3"
        >
          <legend className="sr-only">New comment</legend>
          <label htmlFor="comment-body" className="block text-sm font-medium">
            Comment
          </label>
          <textarea
            id="comment-body"
            rows={4}
            maxLength={4000}
            className="w-full rounded-md border bg-background p-3 disabled:cursor-not-allowed disabled:opacity-60"
            {...register('body')}
            aria-invalid={Boolean(errors.body)}
            aria-describedby={
              errors.body ? 'comment-help comment-error' : 'comment-help'
            }
          />
          <p id="comment-help" className="text-sm text-muted-foreground">
            Up to 4,000 characters.
          </p>
          {errors.body && (
            <p id="comment-error" role="alert" className="text-destructive">
              {errors.body.message}
            </p>
          )}
          <Button type="submit">
            {isSubmitting ? 'Adding comment…' : 'Add comment'}
          </Button>
        </fieldset>
        {add.isError && (
          <p role="alert" className="text-destructive">
            {errorMessage(add.error)}
          </p>
        )}
      </form>
    </section>
  );
}
