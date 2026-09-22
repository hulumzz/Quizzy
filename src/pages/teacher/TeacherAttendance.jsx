import { Link } from 'react-router-dom';
import { AttendanceIcon, ArrowRightIcon, ClassesIcon } from '../../components/icons';
import { Card, EmptyState, PageHeader, Skeleton, buttonClassName } from '../../components/ui';
import { useClasses } from '../../features/classes/hooks/useClasses';
import { classErrorMessage } from '../../services/class.service';

export default function TeacherAttendance() {
  const { classes, status, error, configured, reload } = useClasses({ scope: 'owned' });
  return <div className="qz-dashboard qz-enter">
    <PageHeader eyebrow="Ruang guru" title="Presensi" description="Pilih kelas untuk membuat sesi berbasis lokasi, membuka check-in, dan melihat rekap kehadiran." />
    {!configured ? <div className="qz-status-strip">Layanan presensi belum tersedia di lingkungan ini.</div> : null}
    {status === 'loading' ? <div className="qz-attendance-hub" role="status" aria-label="Memuat kelas"><Skeleton height={130} /><Skeleton height={130} /></div> : null}
    {status === 'error' ? <Card><EmptyState icon={ClassesIcon} title="Daftar kelas tidak dapat dimuat" description={classErrorMessage(error)} action={<button type="button" className={buttonClassName()} onClick={reload}>Coba lagi</button>} /></Card> : null}
    {status === 'success' && classes.length ? <div className="qz-attendance-hub">{classes.map((classItem) => <Card key={classItem.id} className="qz-attendance-hub__card"><span className="qz-attendance-hub__icon"><AttendanceIcon size={24} /></span><div><h2>{classItem.name}</h2><p>{classItem.description || `${classItem.studentsCount || 0} siswa terdaftar di kelas ini.`}</p></div><Link to={`/teacher/classes/${classItem.id}/attendance`} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>Kelola presensi <ArrowRightIcon size={16} /></Link></Card>)}</div> : null}
    {status === 'success' && !classes.length ? <Card><EmptyState icon={AttendanceIcon} title="Belum ada kelas" description="Buat kelas terlebih dahulu sebelum menyiapkan sesi presensi." action={<Link to="/teacher/classes" className={buttonClassName()}>Buka kelas</Link>} /></Card> : null}
  </div>;
}
