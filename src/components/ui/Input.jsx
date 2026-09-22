import { useId } from 'react';
import { cn } from '../../lib/cn';

export default function Input({ label, hint, error, id, className, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const descriptionId = `${inputId}-description`;

  return (
    <label className="qz-field" htmlFor={inputId}>
      {label ? <span className="qz-field__label">{label}</span> : null}
      <input id={inputId} className={cn('qz-input', className)} aria-invalid={Boolean(error)} aria-describedby={hint || error ? descriptionId : undefined} {...props} />
      {error ? <span id={descriptionId} className="qz-field__error">{error}</span> : hint ? <span id={descriptionId} className="qz-field__hint">{hint}</span> : null}
    </label>
  );
}
