import { useEffect, useRef, useState } from 'react';
import { NotificationIcon } from '../icons';
import { IconButton } from '../ui';

export default function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    const escape = (event) => { if (event.key === 'Escape' && open) { setOpen(false); rootRef.current?.querySelector('button')?.focus(); } };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', escape); };
  }, [open]);

  return (
    <div className="qz-popover-wrap" ref={rootRef}>
      <IconButton label="Notifikasi" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <NotificationIcon size={19} />
      </IconButton>
      {open ? (
        <div className="qz-popover qz-enter" role="status">
          <div className="qz-popover__header">
            <p className="qz-popover__title">Belum ada notifikasi</p>
            <p className="qz-popover__copy">Aktivitas kelas terbaru akan muncul di sini ketika fitur kelas sudah aktif.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
