import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CalendarIcon, ClassesIcon, QuizIcon } from '../icons';
import { Card, SectionHeader, buttonClassName } from '../ui';

export function WelcomeBanner({ name, role = 'teacher' }) {
  const teacher = role === 'teacher';
  return (
    <section className={`qz-welcome${teacher ? '' : ' qz-welcome--student'}`}>
      <div className="qz-welcome__copy">
        <span className="qz-welcome__eyebrow"><span /> {teacher ? 'RUANG UNTUK MENGINSPIRASI' : 'LANGKAH KECIL, IDE BESAR'}</span>
        <h1>{teacher ? 'Selamat datang,' : 'Halo,'}<br /><span>{name}.</span></h1>
        <p>{teacher ? 'Kelas yang seru dimulai dari sini. Siapkan ruang belajar dan tumbuhkan rasa ingin tahu.' : 'Ada banyak hal baru untuk dipelajari. Buka kelasmu dan mulai perjalanan hari ini.'}</p>
        <Link to={`/${role}/classes`} className={buttonClassName({ className: 'qz-welcome__button' })}>{teacher ? 'Buka ruang kelas' : 'Jelajahi kelas saya'} <ArrowRightIcon size={18} /></Link>
      </div>
      <div className="qz-welcome-art" aria-hidden="true">
        <div className="qz-art-orbit" />
        <div className="qz-art-card"><span className="qz-art-label">LET'S LEARN</span><ClassesIcon size={54} /><span className="qz-art-line" /><span className="qz-art-line qz-art-line--short" /><div className="qz-art-dots"><i /><i /><i /></div></div>
        <div className="qz-art-note"><QuizIcon size={26} /><span>Ide besar<br /><strong>mulai di sini.</strong></span></div>
        <span className="qz-art-spark">✦</span><span className="qz-art-star">✳</span>
      </div>
    </section>
  );
}

export function QuickAction({ to, icon: Icon, title, description, tone = 'purple' }) {
  return <Link to={to} className={`qz-quick-action qz-tone-${tone}`}><span className="qz-quick-action__icon"><Icon size={23} /></span><span className="qz-quick-action__copy"><span className="qz-quick-action__label">{title}</span><span className="qz-quick-action__hint">{description}</span></span><ArrowRightIcon className="qz-quick-action__arrow" size={18} /></Link>;
}

export function MetricCard({ icon: Icon, label, value, detail, tone = 'purple' }) {
  return <div className={`qz-metric qz-tone-${tone}`}><span className="qz-metric__icon"><Icon size={21} /></span><div><span className="qz-metric__label">{label}</span><strong>{value}</strong><span className="qz-metric__detail">{detail}</span></div></div>;
}

// Calendar navigation only: agenda data is not available yet.
export function WeekAgenda() {
  const [today] = useState(() => new Date());
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(today);
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (today.getDay() + 6) % 7 + offset * 7);
  const days = Array.from({ length: 7 }, (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index));
  const sameDay = (left, right) => left.toDateString() === right.toDateString();
  const changeWeek = (direction) => {
    setOffset((value) => value + direction);
    setSelected(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + direction * 7));
  };
  return (
    <Card className="qz-agenda">
      <SectionHeader title="Agenda belajar" action={<CalendarIcon size={20} />} />
      <div className="qz-agenda__month"><span>{new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(selected)}</span><div><button type="button" onClick={() => changeWeek(-1)} aria-label="Minggu sebelumnya">‹</button><button type="button" onClick={() => changeWeek(1)} aria-label="Minggu berikutnya">›</button></div></div>
      <div className="qz-week" role="group" aria-label="Pilih tanggal">
        {days.map((day) => <button type="button" key={day.toDateString()} aria-pressed={sameDay(day, selected)} aria-current={sameDay(day, today) ? 'date' : undefined} aria-label={new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(day)} onClick={() => setSelected(day)}><span>{new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong><i /></button>)}
      </div>
      <div className="qz-agenda__empty" aria-live="polite"><span className="qz-agenda__date">{new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }).format(selected)}</span><CalendarIcon size={28} /><strong>Agenda belum tersedia</strong><p>Jadwal kelas akan tampil saat layanan agenda aktif.</p></div>
      <button type="button" className="qz-text-button" onClick={() => { setOffset(0); setSelected(today); }}>Kembali ke hari ini <ArrowRightIcon size={15} /></button>
    </Card>
  );
}

export function GettingStarted({ role = 'teacher' }) {
  const teacher = role === 'teacher';
  return <aside className="qz-start-guide"><span className="qz-start-guide__eyebrow">SATU LANGKAH PERTAMA</span><h2>{teacher ? 'Bangun ruang belajar Anda.' : 'Temukan ruang belajarmu.'}</h2><p>{teacher ? 'Buat kelas, bagikan kodenya, dan sambut siswa di satu tempat.' : 'Minta kode kelas dari guru, lalu bergabung bersama teman-temanmu.'}</p><Link to={`/${role}/classes`}>{teacher ? 'Mulai dari kelas' : 'Gabung ke kelas'} <ArrowRightIcon size={17} /></Link><ClassesIcon className="qz-start-guide__art" size={88} /></aside>;
}
