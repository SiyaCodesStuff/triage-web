import { configureAxe } from 'vitest-axe';
import { expect, vi } from 'vitest';

// jsdom has no layout/paint engine; rendered contrast needs browser verification.
// Theme contrast is checked separately against the actual CSS tokens.
const axe = configureAxe({ rules: { 'color-contrast': { enabled: false } } });
export async function expectAccessible(element: HTMLElement = document.body) {
  // Returning null accurately models jsdom's missing canvas without noisy warnings.
  const canvas = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(null);
  try {
    expect((await axe(element)).violations).toEqual([]);
  } finally {
    canvas.mockRestore();
  }
}
