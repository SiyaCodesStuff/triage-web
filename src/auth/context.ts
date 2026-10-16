import { createContext, useContext } from 'react';
import type { AuthUser } from '@/auth/session';
import type { LoginValues, RegisterValues } from '@/auth/schemas';

export type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
  login: (values: LoginValues) => Promise<void>;
  register: (values: RegisterValues) => Promise<void>;
  logout: () => Promise<void>;
  isLoggingOut: boolean;
};
export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires an AuthProvider.');
  return value;
}
