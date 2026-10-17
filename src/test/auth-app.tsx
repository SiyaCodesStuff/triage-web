import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import App from '@/App';
import { AuthProvider } from '@/auth/auth-provider';
import { queryClient } from '@/lib/query-client';

function LocationProbe() {
  const location = useLocation();
  return (
    <output aria-label="Current location" hidden>
      {location.pathname + location.search + location.hash}
    </output>
  );
}

function HistoryControls() {
  const navigate = useNavigate();
  return (
    <>
      <button
        onClick={() => {
          void navigate(-1);
        }}
      >
        History back
      </button>
      <button
        onClick={() => {
          void navigate(1);
        }}
      >
        History forward
      </button>
    </>
  );
}

export function renderAuthApp(path: string, historyControls = false) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
          <LocationProbe />
          {historyControls && <HistoryControls />}
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
