import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { components } from '@/api/schema';
import { useAuth } from '@/auth/context';
export type Ticket = components['schemas']['Ticket'];
export const nextStatuses: Record<
  Ticket['status'],
  readonly Ticket['status'][]
> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: [],
};
export function canEditTicket(
  ticket: Ticket,
  actor: { id: string; role: string },
) {
  return (
    actor.role === 'AGENT' ||
    actor.role === 'ADMIN' ||
    (actor.id === ticket.createdBy && ticket.status === 'OPEN')
  );
}
export function useTicket(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['ticket', id, user?.id, user?.role],
    queryFn: ({ signal }) =>
      api.request('get', '/tickets/{ticketId}', {
        params: { ticketId: id },
        signal,
      }),
  });
}
