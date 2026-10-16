import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';

type Props = { title: string; description: string };

export function PlaceholderPage({ title, description }: Props) {
  useEffect(() => {
    document.title = `${title} | Triage`;
  }, [title]);

  return (
    <section aria-labelledby="page-title" className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Workspace</p>
        <h1
          id="page-title"
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {title}
        </h1>
      </div>
      <Card>
        <CardContent className="space-y-3">
          <p>{description}</p>
          <p className="text-sm text-muted-foreground">
            This page is being prepared. Check back soon.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
