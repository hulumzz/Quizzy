import { useEffect, useState } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import AppRoutes from './app/routes';
import { PageLoader } from './components/ui';

function RouteTransitionLoader() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 420);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return visible ? <PageLoader overlay label="Menyiapkan ruang belajarmu..." /> : null;
}

function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const publicLanding = pathname === '/';
    document.title = publicLanding
      ? 'Nalaro Class — Belajar, bermain, dan tumbuh'
      : pathname === '/login' ? 'Masuk atau daftar — Nalaro Class' : 'Nalaro Class — Ruang belajar';
    document.querySelector('meta[name="robots"]')?.setAttribute('content', publicLanding ? 'index, follow' : 'noindex, nofollow');
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://quizzy-f01.pages.dev/');
  }, [pathname]);
  return null;
}

export default function App() {
  return <BrowserRouter><RouteMetadata /><RouteTransitionLoader /><AppRoutes /></BrowserRouter>;
}
