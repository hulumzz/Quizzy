import { Link } from 'react-router-dom';
import { ArrowRightIcon, AttendanceIcon, ClassesIcon, MembersIcon, QuizIcon } from '../../components/icons';
import { Button, Card, EmptyState, SectionHeader, Skeleton } from '../../components/ui';
import { GettingStarted, MetricCard, QuickAction, WeekAgenda, WelcomeBanner } from '../../components/dashboard/DashboardWidgets';
import { useAuth } from '../../context/useAuth';
import ClassCard from '../../features/classes/components/ClassCard';
import { useClasses } from '../../features/classes/hooks/useClasses';
import { classErrorMessage } from '../../services/class.service';

export default function TeacherDashboard() {
  const { user, userProfile } = useAuth();
  const { classes, status, error, configured, reload } = useClasses();
  const firstName = (userProfile?.name || user?.displayName || 'Guru').trim().split(/\s+/)[0];
  const ready = status === 'success';
  const count = (field) => classes.reduce((total, item) => total + (Number(item[field]) || 0), 0);

  return (
    <div className="qz-dashboard qz-enter">
      <div className="qz-workspace-heading"><div><span className="qz-eyebrow">WORKSPACE ANDA</span><h2>Hari baru, inspirasi baru.</h2></div><span className="qz-workspace-heading__note">Belajar. Terhubung. Bertumbuh.</span></div>
      <div className="qz-home-layout">
        <div className="qz-home-main">
          <WelcomeBanner name={firstName} />
          <div className="qz-metrics" aria-label="Ringkasan kelas">
            <MetricCard icon={ClassesIcon} label="Kelas aktif" value={ready ? classes.filter((item) => item.status === 'active').length : '—'} detail={ready ? 'Dalam daftar kelas Anda' : 'Menunggu data kelas'} />
            <MetricCard icon={MembersIcon} label="Keanggotaan siswa" value={ready ? count('studentsCount') : '—'} detail="Total anggota di setiap kelas" tone="mint" />
            <MetricCard icon={QuizIcon} label="Kuis kelas" value={ready ? count('quizzesCount') : '—'} detail="Dari daftar kelas Anda" tone="peach" />
          </div>
          <section>
            <SectionHeader title="Apa yang ingin Anda lakukan?" />
            <div className="qz-quick-grid">
              <QuickAction to="/teacher/classes" icon={ClassesIcon} title="Kelola kelas" description="Ruang belajar & anggota" />
              <QuickAction to="/teacher/quizzes" icon={QuizIcon} title="Siapkan kuis" description="Ide untuk evaluasi" tone="peach" />
              <QuickAction to="/teacher/attendance" icon={AttendanceIcon} title="Buka presensi" description="Kehadiran di kelas" tone="mint" />
            </div>
          </section>
          <section className="qz-home-classes">
            <SectionHeader title="Ruang kelas Anda" description="Semua perjalanan belajar dimulai dari sebuah kelas." action={<Link to="/teacher/classes" className="qz-text-link">Semua kelas <ArrowRightIcon size={16} /></Link>} />
            {status === 'loading' ? <div className="qz-class-grid qz-class-grid--preview" role="status" aria-label="Memuat kelas"><Skeleton height={215} /><Skeleton height={215} /></div> : status === 'error' ? <div className="qz-inline-state qz-inline-state--error" role="alert">{classErrorMessage(error)} <Button variant="ghost" size="sm" onClick={reload}>Coba lagi</Button></div> : classes.length ? <div className="qz-class-grid qz-class-grid--preview">{classes.slice(0, 4).map((item) => <ClassCard key={item.id} classItem={item} />)}</div> : <Card className="qz-class-empty"><EmptyState icon={ClassesIcon} title={configured ? 'Kelas pertama, banyak kemungkinan.' : 'Ruang kelas sedang disiapkan'} description={configured ? 'Satu tempat untuk berbagi materi, bertukar ide, dan belajar bersama.' : 'Layanan kelas belum tersedia. Kelas Anda akan muncul di sini setelah terhubung.'} action={<Link to="/teacher/classes" className="qz-text-link">{configured ? 'Buat kelas pertama' : 'Buka halaman kelas'} <ArrowRightIcon size={17} /></Link>} /></Card>}
          </section>
        </div>
        <div className="qz-home-rail"><WeekAgenda /><GettingStarted /></div>
      </div>
    </div>
  );
}
