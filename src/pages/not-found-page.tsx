import { useEffect } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Page not found | Triage';
  }, []);

  return (
    <section aria-labelledby="page-title" className="max-w-xl space-y-5">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 id="page-title" className="text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="text-muted-foreground">
        The page you’re looking for doesn’t exist. Head back to your tickets to
        continue.
      </p>
      <Button asChild>
        <Link to="/tickets">Back to tickets</Link>
      </Button>
    </section>
  );
}
