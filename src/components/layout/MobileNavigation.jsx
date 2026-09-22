import { NavLink } from 'react-router-dom';

export default function MobileNavigation({ items }) {
  return (
    <nav className="qz-mobile-nav" aria-label="Navigasi seluler">
      {items.map(({ label, path, icon: Icon, end }) => (
        <NavLink key={path} to={path} end={end} className="qz-mobile-nav__link">
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
