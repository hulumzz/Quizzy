import { useEffect } from 'react';

export default function Toast({ title, message, duration = 4000, onClose }) {
  useEffect(() => {
    if (!duration) return undefined;
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="qz-toast qz-enter" role="status">
      <div className="qz-toast__content">
        <p className="qz-toast__title">{title}</p>
        {message ? <p className="qz-toast__message">{message}</p> : null}
      </div>
    </div>
  );
}
