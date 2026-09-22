import { useState } from 'react';

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'Q';
}

export default function Avatar({ src, name, size = 40 }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <span className="qz-avatar" style={{ '--qz-avatar-size': `${size}px` }} aria-label={name || 'Pengguna'}>
      {src && !imageFailed ? <img src={src} alt="" onError={() => setImageFailed(true)} /> : initials(name)}
    </span>
  );
}
