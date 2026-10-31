import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = 'secondary',
  icon,
  block = false,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant}${block ? ' btn--block' : ''} ${className}`}
      {...rest}
    >
      {icon ? <span className="btn__icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
