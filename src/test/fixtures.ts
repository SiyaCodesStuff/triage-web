import type { components } from '@/api/schema';

type User = components['schemas']['User'];

export function createUser(overrides: Partial<User> = {}): User {
  const id = crypto.randomUUID();
  return { ...user, id, email: `user-${id}@example.com`, ...overrides };
}

export const user = {
  id: 'd8aeea22-5b82-4538-81b2-e10fa74fc407',
  name: 'Alex',
  email: 'alex@example.com',
  role: 'USER',
  createdAt: '2026-10-16T12:00:00.000Z',
  updatedAt: '2026-10-16T12:00:00.000Z',
} satisfies components['schemas']['User'];

export const ticket = {
  id: '1c707814-0925-4363-aacd-cf2667d42911',
  title: 'Printer issue',
  description: 'Paper jam',
  priority: 'MEDIUM',
  status: 'OPEN',
  createdBy: user.id,
  assignedTo: null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
} satisfies components['schemas']['Ticket'];
