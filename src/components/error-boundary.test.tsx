import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/error-boundary';

function BrokenPage(): never {
  throw new Error('Private diagnostic detail');
}

describe('ErrorBoundary', () => {
  it('renders its children when healthy', () => {
    render(
      <ErrorBoundary>
        <p>Workspace content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Workspace content')).toBeVisible();
  });

  it('catches rendering failures and offers recovery without exposing details', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <BrokenPage />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('main')).toHaveFocus();
    expect(
      screen.getByRole('heading', { name: 'Something went wrong' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Reload it to try again',
    );
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeEnabled();
    expect(
      screen.getByRole('link', { name: 'Return to tickets' }),
    ).toHaveAttribute('href', '/tickets');
    expect(
      screen.queryByText('Private diagnostic detail'),
    ).not.toBeInTheDocument();
  });
});
