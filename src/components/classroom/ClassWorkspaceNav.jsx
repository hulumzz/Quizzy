import { useEffect, useRef } from 'react';
import { BarChart3, CalendarDays } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { AttendanceIcon, ClassesIcon, DiscussionIcon, MaterialIcon, QuizIcon, TaskIcon } from '../icons';

export default function ClassWorkspaceNav({ role, classId }) {
  const base = `/${role}/classes/${classId}`;
  const { pathname } = useLocation();
  const navRef = useRef(null);
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector('a.active');
    if (!active) return;
    const frame = nav.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    if (tab.left < frame.left || tab.right > frame.right) {
      nav.scrollTo({ left: nav.scrollLeft + tab.left - frame.left - (frame.width - tab.width) / 2, behavior: 'auto' });
    }
  }, [pathname]);
  return (
    <nav ref={navRef} className="qz-class-nav" aria-label="Navigasi ruang kelas">
      <NavLink to={`${base}/overview`}><ClassesIcon size={18} /> Ringkasan</NavLink>
      <NavLink to={`${base}/sessions`}><CalendarDays size={18} /> Pertemuan</NavLink>
      <NavLink to={`${base}/materials`} className={pathname.includes('/materials') && !pathname.includes('/discussions') ? 'active' : undefined}><MaterialIcon size={18} /> Materi</NavLink>
      <NavLink to={`${base}/discussions`} className={pathname.includes('/discussions') ? 'active' : undefined}><DiscussionIcon size={18} /> Diskusi</NavLink>
      <NavLink to={`${base}/quizzes`}><QuizIcon size={18} /> Kuis</NavLink>
      <NavLink to={`${base}/tasks`}><TaskIcon size={18} /> Tugas</NavLink>
      <NavLink to={`${base}/attendance`}><AttendanceIcon size={18} /> Presensi</NavLink>
      <NavLink to={`${base}/analytics`}><BarChart3 size={18} /> Analitik</NavLink>
    </nav>
  );
}
