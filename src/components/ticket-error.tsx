import { useEffect } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
export function ticketErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404)
      return 'Ticket not found. It may have been deleted or you may not have access.';
    if (error.status === 409)
      return `The ticket could not be changed because of a conflict. ${error.message}`;
    return error.message;
  }
  return 'Unable to connect. Please try again.';
}
export function TicketError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const message = ticketErrorMessage(error);
  useEffect(() => {
    toast.error(message, { id: 'ticket-load-error' });
  }, [message]);
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold">
        {error instanceof ApiError && error.status === 404
          ? 'Ticket not found'
          : 'Unable to load ticket'}
      </h1>
      <p role="alert">{message}</p>
      <div className="flex gap-3">
        <Button onClick={retry}>Retry</Button>
        <Button asChild variant="outline">
          <Link to="/tickets">Back to tickets</Link>
        </Button>
      </div>
    </section>
  );
}
