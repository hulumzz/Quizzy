import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { navigationForRole, pageMeta } from '../../app/navigation';
import { useAuth } from '../../context/useAuth';
import AppHeader from './AppHeader';
import MobileNavigation from './MobileNavigation';
import Sidebar from './Sidebar';

export default function AppShell() {
  const { user, userProfile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const role = userProfile?.role === 'student' ? 'student' : 'teacher';
  const items = navigationForRole(role);
  const meta = pageMeta(location.pathname, role);

  useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = document.getElementById('app-sidebar');
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...sidebar.querySelectorAll('a, button')].filter((node) => node.getClientRects().length);
    focusable()[0]?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const onResize = () => { if (window.innerWidth > 900) setMobileOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      previous?.focus?.();
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="qz-app-shell">
      <a href="#main-content" className="qz-skip-link">Langsung ke konten</a>
      {mobileOpen ? <button type="button" className="qz-mobile-drawer-backdrop" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} /> : null}
      <Sidebar role={role} items={items} profile={userProfile} user={user} open={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      <div className="qz-main" inert={mobileOpen ? true : undefined}>
        <AppHeader meta={meta} role={role} profile={userProfile} user={user} menuOpen={mobileOpen} onMenu={() => setMobileOpen(true)} onLogout={handleLogout} onProfile={() => navigate('/profile')} />
        <main className="qz-content" id="main-content" tabIndex={-1}><Outlet /></main>
      </div>
      {!mobileOpen ? <MobileNavigation items={items} /> : null}
    </div>
  );
}
