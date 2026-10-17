import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import App from '@/App';

const chunk = vi.hoisted(() => {
  let release: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { ready, release };
});

vi.mock('@/pages/auth-page', async (importOriginal) => {
  await chunk.ready;
  return importOriginal();
});
vi.mock('@/auth/context', () => ({
  useAuth: () => ({ user: null, isLoading: false, isLoggingOut: false }),
}));

it('announces loading, then renders the lazy page while retaining route focus', async () => {
  render(
    <MemoryRouter initialEntries={['/missing']}>
      <App />
    </MemoryRouter>,
  );
  const link = screen.getByRole('link', { name: 'Log in' });
  link.focus();
  fireEvent.click(link);
  const loading = await screen.findByRole('status', { name: 'Page loading' });
  expect(loading).toHaveTextContent('Loading page…');
  expect(loading).toHaveAttribute('aria-live', 'polite');
  expect(
    screen.queryByRole('heading', { name: 'Log in' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveFocus();

  await act(async () => {
    chunk.release();
    await chunk.ready;
  });
  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeVisible();
  expect(
    screen.queryByRole('status', { name: 'Page loading' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveFocus();
  const announcement = screen.getByRole('status', { name: 'Current page' });
  await waitFor(() => expect(announcement).toHaveTextContent('Log in'));
  expect(announcement).toHaveAttribute('aria-live', 'polite');
  expect(document.title).toBe('Log in | Triage');
});
