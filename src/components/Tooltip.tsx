import type { ReactNode } from 'react';

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
}

export function Tooltip({ label, children, side = 'bottom' }: TooltipProps) {
  return (
    <span className={`tooltip tooltip--${side}`} data-tooltip={label}>
      {children}
    </span>
  );
}
