import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, LogoutIcon } from '../icons';
import { UserRound } from 'lucide-react';
import { Avatar } from '../ui';

export default function UserMenu({ role, profile, user, onLogout, onProfile }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const displayName = profile?.name || user?.displayName || (role === 'teacher' ? 'Guru Quizzy' : 'Siswa Quizzy');
  const email = profile?.email || user?.email || (user?.isAnonymous ? 'Akun tamu' : 'Akun Quizzy');
  const avatar = profile?.avatar || user?.photoURL;

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
      <button type="button" className="qz-user-trigger" aria-label={`Menu akun ${displayName}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Avatar src={avatar} name={displayName} size={34} />
        <span className="qz-user-trigger__name">{displayName}</span>
        <ChevronDownIcon size={15} />
      </button>
      {open ? (
        <div className="qz-popover qz-enter">
          <div className="qz-user-menu__identity">
            <Avatar src={avatar} name={displayName} size={42} />
            <div className="qz-user-menu__copy">
              <div className="qz-user-menu__name">{displayName}</div>
              <div className="qz-user-menu__email">{email}</div>
            </div>
          </div>
          <button type="button" className="qz-user-menu__action" onClick={onProfile}><UserRound size={18} /> Profil saya</button>
          <button type="button" className="qz-user-menu__action" onClick={onLogout}>
            <LogoutIcon size={18} /> Keluar
          </button>
        </div>
      ) : null}
    </div>
  );
}
