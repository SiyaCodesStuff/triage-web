import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 px-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p role="alert" className="text-muted-foreground">
            We couldn’t display this page. Reload it to try again, or return to
            tickets.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <Button asChild variant="outline">
              <a href="/tickets">Return to tickets</a>
            </Button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
