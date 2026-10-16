import { z } from 'zod';

const email = z
  .email('Enter a valid email address.')
  .max(254, 'Email must be at most 254 characters.')
  .transform((value) => value.trim().toLowerCase());
const password = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128, 'Password must be at most 128 characters.');
export const loginSchema = z.object({ email, password });
export const registerSchema = loginSchema.extend({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(120, 'Name must be at most 120 characters.'),
});
export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
