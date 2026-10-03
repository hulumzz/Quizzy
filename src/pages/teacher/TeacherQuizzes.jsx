import { Link } from 'react-router-dom';
import { LibraryBig } from 'lucide-react';
import { QuizIcon } from '../../components/icons';
import { Card, ContentCard, EmptyState, PageHeader, Skeleton, buttonClassName } from '../../components/ui';
import { useClasses } from '../../features/classes/hooks/useClasses';

export default function TeacherQuizzes() {
  const { classes, status } = useClasses();
  return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Ruang guru" title="Kuis" description="Buat kuis mandiri, kelola evaluasi tiap kelas, atau temukan inspirasi dari Bank Kuis." />
    <div className="qz-quiz-grid qz-quiz-grid--hub">
      <ContentCard featured icon={QuizIcon} title="Kuis umum" description="Siapkan kuis mandiri, lalu gunakan untuk evaluasi atau bagikan saat kelas sudah siap." actions={<Link className={buttonClassName({ size: 'sm' })} to="/teacher/general-quizzes">Kelola kuis umum</Link>} />
      <ContentCard featured icon={LibraryBig} title="Bank Kuis" description="Temukan inspirasi dari karya guru lain dan bagikan kuis pilihan Anda ke komunitas." actions={<Link className={buttonClassName({ variant: 'secondary', size: 'sm' })} to="/teacher/quiz-bank">Buka Bank Kuis</Link>} />
    </div>
    <section className="qz-bank-section"><h2>Kuis di kelas</h2>{status === 'loading' ? <Skeleton height={180} /> : classes.length ? <div className="qz-quiz-grid">{classes.map((item) => <ContentCard key={item.id} icon={QuizIcon} title={item.name} description={item.description || 'Kelola evaluasi untuk kelas ini.'} actions={<Link className={buttonClassName({ size: 'sm' })} to={`/teacher/classes/${item.id}/quizzes`}>Buka kuis kelas</Link>} />)}</div> : <Card><EmptyState icon={QuizIcon} title="Belum ada kelas" description="Kuis umum tetap bisa dibuat tanpa kelas. Buat kelas saat evaluasi perlu dibagikan ke siswa tertentu." /></Card>}</section>
  </div>;
}
