import { useId } from 'react';
import { cn } from '../../lib/cn';

export default function Textarea({ label, hint, error, id, className, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const descriptionId = `${inputId}-description`;
  return (
    <label className="qz-field" htmlFor={inputId}>
      {label ? <span className="qz-field__label">{label}</span> : null}
      <textarea id={inputId} className={cn('qz-textarea', className)} aria-invalid={Boolean(error)} aria-describedby={hint || error ? descriptionId : undefined} {...props} />
      {error ? <span id={descriptionId} className="qz-field__error">{error}</span> : hint ? <span id={descriptionId} className="qz-field__hint">{hint}</span> : null}
    </label>
  );
}
