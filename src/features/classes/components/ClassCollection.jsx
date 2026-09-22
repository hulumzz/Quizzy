import { useState } from 'react';
import { ClassesIcon, SearchIcon } from '../../../components/icons';
import { Button, Card, EmptyState, Skeleton } from '../../../components/ui';
import ClassCard from './ClassCard';

export default function ClassCollection({ classes, status, configured, role = 'teacher', onCreate }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const teacher = role === 'teacher';
  const search = query.trim().toLocaleLowerCase('id-ID');
  const visible = classes.filter((item) =>
    (filter === 'all' || item.status === 'active') &&
    [item.name, item.code, item.teacherName].some((value) => String(value || '').toLocaleLowerCase('id-ID').includes(search)));

  return (
    <section className="qz-library" aria-label="Daftar kelas">
      <div className="qz-library__toolbar">
        <label className="qz-search"><SearchIcon size={18} /><span className="qz-sr-only">Cari kelas berdasarkan nama, kode, atau pengajar</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau kode kelas…" /></label>
        <div className="qz-library__filters" role="group" aria-label="Filter kelas"><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Semua kelas</button><button type="button" aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>Aktif</button></div>
      </div>
      {status === 'success' ? <p className="qz-library__count" aria-live="polite">{visible.length} dari {classes.length} kelas ditampilkan</p> : null}
      {status === 'loading' ? <div className="qz-class-grid" role="status" aria-label="Memuat kelas">{[1, 2, 3].map((item) => <Skeleton key={item} height={260} />)}</div> : visible.length ? <div className="qz-class-grid">{visible.map((item) => <ClassCard key={item.id} classItem={item} role={role} />)}</div> : status !== 'error' ? (
        <Card className="qz-class-empty"><EmptyState
          icon={classes.length ? SearchIcon : ClassesIcon}
          title={classes.length ? 'Kelas belum ditemukan' : !configured ? 'Ruang kelas sedang disiapkan' : teacher ? 'Kelas pertama, banyak kemungkinan.' : 'Temukan kelas pertamamu'}
          description={classes.length ? 'Coba kata kunci lain atau tampilkan semua kelas.' : !configured ? 'Layanan kelas belum tersedia. Hubungi pengelola Quizzy untuk mulai menggunakan kelas.' : teacher ? 'Buat ruang belajar, bagikan kodenya, dan undang siswa untuk bergabung.' : 'Minta kode kelas dari guru untuk mulai belajar bersama teman-temanmu.'}
          action={classes.length ? <Button variant="secondary" onClick={() => { setQuery(''); setFilter('all'); }}>Reset pencarian</Button> : configured ? <Button onClick={onCreate}>{teacher ? 'Buat kelas pertama' : 'Masukkan kode kelas'}</Button> : null}
        /></Card>
      ) : null}
    </section>
  );
}
