import { useParams } from 'react-router';
import { PlaceholderPage } from '@/pages/placeholder-page';

export function TicketPage() {
  const { id } = useParams<'id'>();

  return (
    <PlaceholderPage
      title={`Ticket ${id ?? ''}`}
      description="View the conversation, status, and details for this ticket."
    />
  );
}
