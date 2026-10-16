import { z } from 'zod';
import type { ApiRequestOptions } from '@/api/types';

export const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const searchSchema = z.object({
  page: z.coerce.number().int().min(1).max(90071992547409).catch(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(20),
  sort: z.enum(['createdAt', 'priority', 'status']).catch('createdAt'),
  order: z.enum(['asc', 'desc']).catch('desc'),
  status: z.enum(statuses).optional().catch(undefined),
  priority: z.enum(priorities).optional().catch(undefined),
  q: z.string().trim().min(1).max(200).optional().catch(undefined),
  assignedTo: z.uuid().optional().catch(undefined),
});
export type TicketSearch = z.infer<typeof searchSchema>;

export function readTicketSearch(
  params: URLSearchParams,
  isStaff: boolean,
): TicketSearch {
  return searchSchema.parse({
    ...Object.fromEntries(params),
    assignedTo: isStaff ? (params.get('assignedTo') ?? undefined) : undefined,
  });
}

export function writeTicketSearch(query: TicketSearch): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params;
}

export function apiTicketSearch(
  query: TicketSearch,
): NonNullable<ApiRequestOptions<'/tickets', 'get'>['query']> {
  return query;
}

export function displayEnum(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}
