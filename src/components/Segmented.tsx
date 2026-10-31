import type { ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  ariaLabel?: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
  fill?: boolean;
  iconOnlyMobile?: boolean;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  fill = false,
  iconOnlyMobile = false,
}: SegmentedProps<T>) {
  return (
    <div
      className={`segmented${fill ? ' segmented--fill' : ''}${iconOnlyMobile ? ' segmented--icon-mobile' : ''}`}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented__item${option.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(option.value)}
          disabled={option.disabled}
          aria-pressed={option.value === value}
          aria-label={option.ariaLabel ?? option.label}
          title={option.disabled ? option.disabledReason : undefined}
        >
          {option.icon ? <span className="segmented__icon">{option.icon}</span> : null}
          <span className="segmented__label">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
