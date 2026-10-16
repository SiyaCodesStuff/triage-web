import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import App from '@/App';

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('Application routes', () => {
  it.each([
    ['/', 'Tickets'],
    ['/login', 'Log in'],
    ['/register', 'Create an account'],
    ['/tickets', 'Tickets'],
    ['/tickets/abc-123', 'Ticket abc-123'],
    ['/admin/users', 'Users'],
  ])('renders %s with its placeholder', (path, title) => {
    renderRoute(path);
    expect(
      within(screen.getByRole('main')).getByRole('heading', {
        level: 1,
        name: title,
      }),
    ).toBeVisible();
    expect(document.title).toBe(`${title} | Triage`);
  });

  it('provides shell landmarks, navigation, and a skip link', () => {
    renderRoute('/tickets');
    expect(screen.getByRole('banner')).toBeVisible();
    expect(screen.getByRole('contentinfo')).toBeVisible();
    const navigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    });
    expect(within(navigation).getAllByRole('link')).toHaveLength(4);
    expect(
      within(navigation).getByRole('link', { name: 'Tickets' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('link', { name: 'Skip to content' }),
    ).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('navigates and focuses the main content', () => {
    renderRoute('/tickets');
    fireEvent.click(screen.getByRole('link', { name: 'Log in' }));
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows a 404 with a working route back to tickets', () => {
    renderRoute('/does-not-exist');
    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
    expect(document.title).toBe('Page not found | Triage');
    fireEvent.click(screen.getByRole('link', { name: 'Back to tickets' }));
    expect(screen.getByRole('heading', { name: 'Tickets' })).toBeVisible();
  });
});
