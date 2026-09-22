import { NavLink, useLocation } from 'react-router-dom';
import { ClassesIcon, DiscussionIcon, MaterialIcon } from '../icons';

export default function ClassWorkspaceNav({ role, classId }) {
  const base = `/${role}/classes/${classId}`;
  const { pathname } = useLocation();
  return (
    <nav className="qz-class-nav" aria-label="Navigasi ruang kelas">
      <NavLink to={`${base}/overview`}><ClassesIcon size={18} /> Ringkasan</NavLink>
      <NavLink to={`${base}/materials`} className={pathname.includes('/materials') && !pathname.includes('/discussions') ? 'active' : undefined}><MaterialIcon size={18} /> Materi</NavLink>
      <NavLink to={`${base}/discussions`} className={pathname.includes('/discussions') ? 'active' : undefined}><DiscussionIcon size={18} /> Diskusi</NavLink>
    </nav>
  );
}
