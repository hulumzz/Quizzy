import { CalendarIcon, MenuIcon } from '../icons';
import { IconButton } from '../ui';
import NotificationMenu from './NotificationMenu';
import UserMenu from './UserMenu';

export default function AppHeader({ meta, role, profile, user, onMenu, onLogout, onProfile, menuOpen }) {
  return (
    <header className="qz-header">
      <div className="qz-header__left">
        <IconButton className="qz-header__menu" label="Buka menu" aria-controls="app-sidebar" aria-expanded={menuOpen} onClick={onMenu}><MenuIcon size={20} /></IconButton>
        <div>
          <p className="qz-header__title">{meta.title}</p>
          <p className="qz-header__subtitle">{meta.subtitle}</p>
        </div>
      </div>
      <div className="qz-header__right">
        <span className="qz-header__date"><CalendarIcon size={16} />{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}</span>
        <NotificationMenu />
        <UserMenu role={role} profile={profile} user={user} onLogout={onLogout} onProfile={onProfile} />
      </div>
    </header>
  );
}
