import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import IconButton from './IconButton';
import { CloseIcon } from '../icons';

export default function Dialog({ open, onClose, title, description, children, footer, className = '' }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const focusable = () => [...(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') || [])].filter((node) => node.getClientRects().length);
    const input = dialogRef.current?.querySelector('input:not(:disabled), textarea:not(:disabled)');
    (input || dialogRef.current)?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.();
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="qz-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCloseRef.current?.()}>
      <div ref={dialogRef} className={`qz-dialog qz-dialog--open ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1}>
        <div className="qz-dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <IconButton label="Tutup dialog" onClick={() => onCloseRef.current?.()}><CloseIcon size={18} /></IconButton>
        </div>
        <div className="qz-dialog__body">{children}</div>
        {footer ? <div className="qz-dialog__footer">{footer}</div> : null}
      </div>
    </div>
    , document.body
  );
}
