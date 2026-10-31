import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Tooltip } from './Tooltip';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  active?: boolean;
  tooltipSide?: 'top' | 'bottom';
  tone?: 'default' | 'danger';
}

export function IconButton({
  label,
  icon,
  active = false,
  tooltipSide = 'bottom',
  tone = 'default',
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <Tooltip label={label} side={tooltipSide}>
      <button
        type="button"
        className={`icon-button${active ? ' is-active' : ''}${tone === 'danger' ? ' icon-button--danger' : ''} ${className}`}
        aria-label={label}
        aria-pressed={active || undefined}
        {...rest}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
