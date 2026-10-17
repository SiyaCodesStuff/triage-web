import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';
import { useTheme } from '@/components/theme-context';
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
          addEventListener: (
            _type: string,
            listener: (event: { matches: boolean }) => void,
          ) => listeners.add(listener),
          removeEventListener: (
            _type: string,
            listener: (event: { matches: boolean }) => void,
          ) => listeners.delete(listener),
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
    expect(
      screen.getByRole('region', { name: /Notifications/ }),
    ).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(screen.getByRole('button', { name: /Close toast/i }));
    await waitFor(() =>
      expect(screen.queryByText('Ticket saved')).not.toBeInTheDocument(),
    );
  });
});

function ThemeControls() {
  const { setTheme } = useTheme();
  return (
    <>
      <button onClick={() => setTheme('dark')}>Dark theme</button>
      <button onClick={() => setTheme('system')}>System theme</button>
    </>
  );
}

it('renders no inert React script and emits no script-render warning', () => {
  const errors = vi.spyOn(console, 'error');
  const { container } = render(
    <AppProviders>
      <p>Workspace</p>
    </AppProviders>,
  );
  expect(container.querySelector('script')).toBeNull();
  expect(errors).not.toHaveBeenCalled();
});

it('preserves a saved theme, supports changes and storage events', () => {
  localStorage.setItem('triage-theme', 'dark');
  render(
    <AppProviders>
      <ThemeControls />
    </AppProviders>,
  );
  expect(document.documentElement).toHaveClass('dark');
  fireEvent.click(screen.getByRole('button', { name: 'System theme' }));
  expect(document.documentElement).toHaveClass('light');
  expect(localStorage.getItem('triage-theme')).toBe('system');
  fireEvent.click(screen.getByRole('button', { name: 'Dark theme' }));
  expect(document.documentElement).toHaveClass('dark');
  act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'unrelated', newValue: 'light' }),
    ),
  );
  expect(document.documentElement).toHaveClass('dark');
  act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'triage-theme', newValue: 'light' }),
    ),
  );
  expect(document.documentElement).toHaveClass('light');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
  expect(document.documentElement).toHaveClass('light');
});

it('keeps theme changes working when storage reads and writes are blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  render(
    <AppProviders>
      <ThemeControls />
    </AppProviders>,
  );
  expect(document.documentElement).toHaveClass('light');
  fireEvent.click(screen.getByRole('button', { name: 'Dark theme' }));
  expect(document.documentElement).toHaveClass('dark');
});
