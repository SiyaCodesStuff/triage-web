import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '@/App';

describe('App', () => {
  it('renders the workspace heading in the main landmark', () => {
    render(<App />);

    expect(
      within(screen.getByRole('main')).getByRole('heading', {
        level: 1,
        name: 'Triage',
      }),
    ).toBeVisible();
  });
});
