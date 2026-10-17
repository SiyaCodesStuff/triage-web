import { useLocation, useNavigate } from 'react-router';
import App from '@/App';
import { renderWithProviders } from '@/test/render';

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
  return renderWithProviders(
    <>
      <App />
      <LocationProbe />
      {historyControls && <HistoryControls />}
    </>,
    { path },
  );
}
