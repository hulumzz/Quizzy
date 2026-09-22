import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, ClassesIcon, ProgressIcon, QuizIcon } from '../../components/icons';
import { Button, Card, EmptyState, SectionHeader, Skeleton } from '../../components/ui';
import { GettingStarted, QuickAction, WeekAgenda, WelcomeBanner } from '../../components/dashboard/DashboardWidgets';
import { useAuth } from '../../context/useAuth';
import ClassCard from '../../features/classes/components/ClassCard';
import { useClasses } from '../../features/classes/hooks/useClasses';
import { classErrorMessage } from '../../services/class.service';
import { listProgressMaterials } from '../../services/material.service';

export default function StudentDashboard() {
  const { user, userProfile } = useAuth();
  const { classes, status, error, configured, reload } = useClasses({ scope: 'joined' });
  const [learning, setLearning] = useState({ status: configured ? 'loading' : 'unconfigured', material: null });
  const firstName = (userProfile?.name || user?.displayName || 'Siswa').trim().split(/\s+/)[0];

  useEffect(() => {
    if (!configured) {
      setLearning({ status: 'unconfigured', material: null });
      return undefined;
    }
    const controller = new AbortController();
    setLearning({ status: 'loading', material: null });
    listProgressMaterials({ signal: controller.signal })
      .then((materials) => setLearning({ status: 'success', material: materials[0] || null }))
      .catch((caught) => { if (caught.name !== 'AbortError') setLearning({ status: 'error', material: null }); });
    return () => controller.abort();
  }, [configured]);

  const currentMaterial = learning.material;
  const learningTarget = currentMaterial
    ? `/student/classes/${currentMaterial.classId}/materials/${currentMaterial.id}`
    : '/student/classes';
  const learningTitle = currentMaterial?.title || (learning.status === 'loading' ? 'Menyiapkan progres belajarmu…' : 'Langkah pertamamu menanti');
  const learningDescription = currentMaterial
    ? `${currentMaterial.progress?.percent || 0}% dibaca · ${currentMaterial.summary || 'Lanjutkan membaca materi ini.'}`
    : learning.status === 'error'
      ? 'Progres belum dapat dimuat. Kamu tetap dapat membuka materi dari ruang kelas.'
      : configured
        ? 'Buka materi dari salah satu kelas untuk mulai mencatat progres belajarmu.'
        : 'Layanan kelas dan materi akan muncul di sini setelah lingkungan terhubung.';
  return (
    <div className="qz-dashboard qz-enter">
      <div className="qz-workspace-heading"><div><span className="qz-eyebrow">RUANG BELAJARMU</span><h2>Siap menemukan hal baru?</h2></div><Link className="qz-text-link" to="/quiz/join">Gabung kuis <ArrowRightIcon size={17} /></Link></div>
      <div className="qz-home-layout">
        <div className="qz-home-main">
          <WelcomeBanner name={firstName} role="student" />
          <section><SectionHeader title="Mulai dari sini" /><div className="qz-quick-grid"><QuickAction to="/student/classes" icon={ClassesIcon} title="Gabung kelas" description="Masukkan kode dari guru" /><QuickAction to="/quiz/join" icon={QuizIcon} title="Gabung kuis" description="Siapkan rasa ingin tahu" tone="peach" /><QuickAction to="/student/progress" icon={ProgressIcon} title="Progres belajar" description="Lihat perjalananmu" tone="mint" /></div></section>
          <section><SectionHeader title="Lanjutkan belajar" /><Card className="qz-learning-card"><span className="qz-learning-card__icon"><ProgressIcon size={26} /></span><div><h3>{learningTitle}</h3><p>{learningDescription}</p></div><Link to={learningTarget} className="qz-text-link">{currentMaterial ? 'Lanjutkan' : 'Buka kelas'} <ArrowRightIcon size={16} /></Link></Card></section>
          <section>
            <SectionHeader title="Kelas saya" description="Ruang untuk belajar dan tumbuh bersama." action={<Link to="/student/classes" className="qz-text-link">Semua kelas <ArrowRightIcon size={16} /></Link>} />
            {status === 'loading' ? <div className="qz-class-grid qz-class-grid--preview" role="status" aria-label="Memuat kelas"><Skeleton height={215} /><Skeleton height={215} /></div> : status === 'error' ? <div className="qz-inline-state qz-inline-state--error" role="alert">{classErrorMessage(error)} <Button variant="ghost" size="sm" onClick={reload}>Coba lagi</Button></div> : classes.length ? <div className="qz-class-grid qz-class-grid--preview">{classes.slice(0, 4).map((item) => <ClassCard key={item.id} classItem={item} role="student" />)}</div> : <Card className="qz-class-empty"><EmptyState icon={ClassesIcon} title={configured ? 'Temukan kelas pertamamu' : 'Ruang kelas sedang disiapkan'} description={configured ? 'Minta kode dari guru dan bergabung bersama teman-temanmu.' : 'Layanan kelas belum tersedia. Kelasmu akan muncul di sini setelah terhubung.'} action={<Link to="/student/classes" className="qz-text-link">Buka halaman kelas <ArrowRightIcon size={17} /></Link>} /></Card>}
          </section>
        </div>
        <div className="qz-home-rail"><WeekAgenda /><GettingStarted role="student" /></div>
      </div>
    </div>
  );
}
