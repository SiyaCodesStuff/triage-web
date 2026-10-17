import type { ReactNode } from 'react';

export function TableRegion({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Horizontal overflow must be keyboard-scrollable.
      tabIndex={0}
      className="overflow-x-auto rounded-xl border"
    >
      {children}
    </div>
  );
}
