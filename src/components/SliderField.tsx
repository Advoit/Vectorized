import type { CSSProperties } from 'react';

interface SliderFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueText: string;
  hint?: string;
  disabled?: boolean;
  disabledHint?: string;
  onChange: (value: number) => void;
}

export function SliderField({
  id,
  label,
  value,
  min,
  max,
  step,
  valueText,
  hint,
  disabled = false,
  disabledHint,
  onChange,
}: SliderFieldProps) {
  const percent = ((value - min) / (max - min)) * 100;
  const helpId = hint ? `${id}-hint` : undefined;
  const style = { '--range-fill': `${Math.max(0, Math.min(100, percent))}%` } as CSSProperties;

  return (
    <div className={`slider-field${disabled ? ' is-disabled' : ''}`}>
      <div className="slider-field__head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="slider-field__value">
          {valueText}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={style}
        aria-describedby={helpId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {disabled && disabledHint ? (
        <p className="field-hint">{disabledHint}</p>
      ) : hint ? (
        <p className="field-hint" id={helpId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
