import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/components/app-providers';

describe('AppProviders', () => {
  it.each([false, true])(
    'follows the system theme (dark: %s) and live changes',
    async (dark) => {
      let systemDark = dark;
      const listeners = new Set<(event: { matches: boolean }) => void>();
      vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
          media: query,
          matches: systemDark,
          addListener: (listener: (event: { matches: boolean }) => void) =>
            listeners.add(listener),
          removeListener: (listener: (event: { matches: boolean }) => void) =>
            listeners.delete(listener),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );
      render(
        <AppProviders>
          <p>Workspace</p>
        </AppProviders>,
      );
      await waitFor(() =>
        expect(document.documentElement).toHaveClass(dark ? 'dark' : 'light'),
      );
      act(() => {
        systemDark = !dark;
        listeners.forEach((listener) => listener({ matches: !dark }));
      });
      await waitFor(() =>
        expect(document.documentElement).toHaveClass(dark ? 'light' : 'dark'),
      );
    },
  );

  it('shows notifications in a labelled region and allows dismissal', async () => {
    render(
      <AppProviders>
        <p>Workspace</p>
      </AppProviders>,
    );
    act(() => {
      toast.success('Ticket saved', { id: 'saved', duration: Infinity });
    });
    expect(await screen.findByText('Ticket saved')).toBeVisible();
    expect(
      screen.getByRole('region', { name: /Notifications/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Close toast/i }));
    await waitFor(() =>
      expect(screen.queryByText('Ticket saved')).not.toBeInTheDocument(),
    );
  });
});
