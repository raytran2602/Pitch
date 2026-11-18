import React from 'react';

interface FormattedNumberInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  id,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  disabled = false,
  className = '',
  placeholder,
  'aria-label': ariaLabel,
}) => {
  const safeValue = Number.isFinite(value) ? Math.round(value) : 0;
  const [draft, setDraft] = React.useState<string | null>(null);

  const clampValue = (n: number): number => {
    const rounded = Math.round(n);
    return Math.max(min, Math.min(max, rounded));
  };

  const displayText =
    draft !== null ? draft : safeValue.toLocaleString('en-US');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/[^\d]/g, '');
    if (digitsOnly === '') {
      setDraft('');
      onChange(min > 0 ? 0 : 0);
      return;
    }
    const parsed = Number.parseInt(digitsOnly, 10);
    if (!Number.isFinite(parsed)) {
      setDraft('');
      return;
    }
    const bounded = Math.min(max, parsed);
    setDraft(bounded.toLocaleString('en-US'));
    onChange(bounded);
  };

  const handleBlur = () => {
    const numeric =
      draft === null
        ? safeValue
        : draft === ''
          ? min
          : Number.parseInt(draft.replace(/[^\d]/g, ''), 10) || min;
    const clamped = clampValue(numeric);
    setDraft(null);
    if (clamped !== value) {
      onChange(clamped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = e.key === 'ArrowUp' ? step : -step;
      const next = clampValue(safeValue + delta);
      setDraft(next.toLocaleString('en-US'));
      onChange(next);
    } else if (e.key === 'Enter') {
      handleBlur();
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      disabled={disabled}
      placeholder={placeholder}
      value={displayText}
      onChange={handleChange}
      onFocus={() => setDraft(safeValue.toLocaleString('en-US'))}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`tabular-nums ${className}`}
    />
  );
};
