import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassWorkspaceNav from '../components/classroom/ClassWorkspaceNav';
import { ClassesIcon, MaterialIcon, MembersIcon } from '../components/icons';
import { Badge, Button, Card, EmptyState, PageHeader, SectionHeader, Skeleton, buttonClassName } from '../components/ui';
import { classErrorMessage, getClass, listClassMembers } from '../services/class.service';

function OverviewLoading() {
  return <div className="qz-dashboard" aria-label="Memuat ruang kelas"><Skeleton width="45%" height={34} /><Skeleton width="70%" height={16} /><div className="qz-overview-grid"><Skeleton height={230} /><Skeleton height={230} /></div></div>;
}

function joinedDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'baru-baru ini' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

export default function ClassOverview({ role }) {
  const { classId } = useParams();
  const [state, setState] = useState({ status: 'loading', classItem: null, members: [], error: null });
  const [copyNotice, setCopyNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setCopyNotice('');
      setState((current) => ({ ...current, status: 'loading', error: null }));
      try {
        const classItem = await getClass(classId, { signal: controller.signal });
        const members = role === 'teacher' ? await listClassMembers(classId, { signal: controller.signal }) : [];
        setState({ status: 'success', classItem, members, error: null });
      } catch (error) {
        if (error.name !== 'AbortError') setState((current) => ({ ...current, status: 'error', error }));
      }
    }
    load();
    return () => controller.abort();
  }, [classId, role]);

  if (state.status === 'loading') return <OverviewLoading />;
  if (state.status === 'error') {
    return <Card className="qz-placeholder"><EmptyState icon={ClassesIcon} title="Ruang kelas tidak dapat dibuka" description={classErrorMessage(state.error)} action={<Link className={buttonClassName()} to={`/${role}/classes`}>Kembali ke kelas</Link>} /></Card>;
  }

  const classItem = state.classItem;
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(classItem.code);
      setCopyNotice('Kode kelas berhasil disalin. Bagikan kepada siswa agar mereka dapat bergabung.');
    } catch {
      setCopyNotice('Kode belum dapat disalin otomatis. Pilih kode kelas di atas untuk menyalinnya secara manual.');
    }
  };
  return (
    <div className="qz-dashboard qz-enter">
      <PageHeader eyebrow={role === 'teacher' ? 'Ruang guru · Kelas' : 'Ruang siswa · Kelas'} title={classItem.name} description={classItem.description || 'Belum ada deskripsi kelas.'} actions={<Link to={`/${role}/classes`} className={buttonClassName({ variant: 'secondary' })}>Semua kelas</Link>} />
      <ClassWorkspaceNav role={role} classId={classId} />

      <div className="qz-class-summary">
        <div><span className="qz-class-summary__label">Pengajar</span><strong>{classItem.teacherName || 'Guru Nalaro'}</strong></div>
        <div><span className="qz-class-summary__label">Anggota</span><strong>{classItem.studentsCount || 0} siswa</strong></div>
        <div><span className="qz-class-summary__label">Status</span><Badge tone={classItem.status === 'active' ? 'success' : 'neutral'}>{classItem.status === 'active' ? 'Aktif' : 'Tidak aktif'}</Badge></div>
        {role === 'teacher' ? <div><span className="qz-class-summary__label">Undang siswa</span><div className="qz-code-copy"><strong className="qz-class-summary__code">{classItem.code}</strong><Button variant="ghost" size="sm" onClick={copyCode}>Salin</Button></div></div> : null}
      </div>
      {copyNotice ? <div className="qz-inline-state" role="status">{copyNotice}</div> : null}

      <div className="qz-overview-grid">
        <section>
          <SectionHeader title="Materi dan aktivitas" description="Konten pembelajaran untuk kelas ini." action={<Link to={`/${role}/classes/${classId}/materials`} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>Buka materi</Link>} />
          <Card className="qz-class-empty"><EmptyState icon={MaterialIcon} title="Workspace materi siap digunakan" description={role === 'teacher' ? 'Susun, simpan sebagai draf, dan terbitkan konten pembelajaran dari satu ruang.' : 'Baca konten yang telah diterbitkan guru dan lanjutkan progres belajarmu.'} action={<Link to={`/${role}/classes/${classId}/materials`} className={buttonClassName()}>Lihat materi kelas</Link>} /></Card>
        </section>

        <section>
          <SectionHeader title={role === 'teacher' ? 'Anggota kelas' : 'Tentang kelas'} description={role === 'teacher' ? 'Siswa yang telah bergabung menggunakan kode kelas.' : 'Informasi ruang belajar yang kamu ikuti.'} />
          <Card>
            {role === 'teacher' ? (state.members.length ? <ul className="qz-member-list">{state.members.map((member) => <li key={member.uid}><span className="qz-member-avatar" aria-hidden="true">{member.name.charAt(0).toUpperCase()}</span><div><strong>{member.name}</strong><span>Bergabung {joinedDate(member.joinedAt)}</span></div></li>)}</ul> : <EmptyState icon={MembersIcon} title="Belum ada anggota" description="Bagikan kode kelas agar siswa dapat bergabung." />) : <div className="qz-class-about"><ClassesIcon size={24} /><p>Kamu terdaftar sebagai anggota kelas ini. Gunakan tab Materi untuk melihat konten terbaru dan melanjutkan progres belajar.</p></div>}
          </Card>
        </section>
      </div>
    </div>
  );
}
