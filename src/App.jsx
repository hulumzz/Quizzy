import { useEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import AppRoutes from './app/routes';

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
  return <BrowserRouter><RouteMetadata /><AppRoutes /></BrowserRouter>;
}
