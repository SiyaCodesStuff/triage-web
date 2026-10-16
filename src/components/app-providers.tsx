import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { Toaster } from '@/components/ui/sonner';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="triage-theme"
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
