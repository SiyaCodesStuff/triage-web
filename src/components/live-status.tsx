import type { ReactNode } from 'react';

export function LiveStatus({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={label}
      className="text-sm text-muted-foreground"
    >
      {children}
    </p>
  );
}
