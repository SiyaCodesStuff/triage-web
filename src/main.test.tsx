import { beforeEach, afterEach, expect, it, vi } from 'vitest';

const root = vi.hoisted(() => {
  const render = vi.fn();
  return { render, createRoot: vi.fn(() => ({ render })) };
});
vi.mock('react-dom/client', () => ({ createRoot: root.createRoot }));
beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
});
afterEach(() => {
  document.body.innerHTML = '';
});

it('fails clearly when the HTML app mount is missing', async () => {
  await expect(import('@/main')).rejects.toThrow('Missing root element.');
  expect(root.createRoot).not.toHaveBeenCalled();
});

it('mounts the application into its HTML root', async () => {
  const container = document.createElement('div');
  container.id = 'root';
  document.body.append(container);
  await import('@/main');
  expect(root.createRoot).toHaveBeenCalledExactlyOnceWith(container);
  expect(root.render).toHaveBeenCalledOnce();
});
