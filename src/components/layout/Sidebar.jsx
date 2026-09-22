import { Link, NavLink } from 'react-router-dom';
import { ArrowRightIcon, ClassesIcon, CloseIcon } from '../icons';
import { Avatar, IconButton } from '../ui';

export default function Sidebar({ role, items, profile, user, open, onNavigate }) {
  const displayName = profile?.name || user?.displayName || (role === 'teacher' ? 'Guru Quizzy' : 'Siswa Quizzy');
  const avatar = profile?.avatar || user?.photoURL;
  return (
    <aside id="app-sidebar" className={`qz-sidebar${open ? ' is-open' : ''}`} aria-label="Navigasi utama">
      <IconButton className="qz-sidebar__close" label="Tutup menu" onClick={onNavigate}><CloseIcon size={20} /></IconButton>
      <NavLink className="qz-brand" to={role === 'teacher' ? '/teacher/home' : '/student/home'} onClick={onNavigate}>
        <img src="/logo.png" alt="" />
        <span>
          <span className="qz-brand__name">Quizzy</span>
          <span className="qz-brand__role">{role === 'teacher' ? 'Ruang guru' : 'Ruang belajar'}</span>
        </span>
      </NavLink>

      <nav className="qz-sidebar__nav">
        <p className="qz-sidebar__label">Menu utama</p>
        {items.map(({ label, path, icon: Icon, end }) => (
          <NavLink key={path} to={path} end={end} className="qz-nav-link" onClick={onNavigate}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="qz-sidebar__note"><span className="qz-sidebar__note-icon"><ClassesIcon size={23} /></span><strong>{role === 'teacher' ? 'Ruang untuk ide besar.' : 'Selalu ada hal baru.'}</strong><p>{role === 'teacher' ? 'Hubungkan rasa ingin tahu dengan ruang belajar Anda.' : 'Temukan inspirasi baru bersama kelasmu.'}</p><Link to={`/${role}/classes`} onClick={onNavigate}>Jelajahi kelas <ArrowRightIcon size={15} /></Link></div>

      <div className="qz-sidebar__footer">
        <div className="qz-sidebar-profile">
          <Avatar src={avatar} name={displayName} size={38} />
          <div className="qz-sidebar-profile__text">
            <div className="qz-sidebar-profile__name">{displayName}</div>
            <div className="qz-sidebar-profile__role">{role === 'teacher' ? 'Guru' : 'Siswa'}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
