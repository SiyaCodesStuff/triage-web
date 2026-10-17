import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '@/components/app-providers';
import { AuthProvider } from '@/auth/auth-provider';

type ProviderOptions = Omit<RenderOptions, 'wrapper'> & { path?: string };

// Match the application's singleton cache: auth mutations update it directly.
// Clear queryClient in beforeEach/afterEach when using this helper.
export function renderWithProviders(
  ui: ReactElement,
  { path = '/', ...options }: ProviderOptions = {},
) {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <AppProviders>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>{children}</AuthProvider>
        </MemoryRouter>
      </AppProviders>
    ),
  });
}
