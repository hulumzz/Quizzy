import { Link } from 'react-router-dom';
import { QuizIcon } from '../../components/icons';
import { Card, EmptyState, PageHeader, Skeleton, buttonClassName } from '../../components/ui';
import { useClasses } from '../../features/classes/hooks/useClasses';

export default function TeacherQuizzes() {
  const { classes, status } = useClasses();
  return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Ruang guru" title="Kuis" description="Buat kuis mandiri, kelola evaluasi tiap kelas, atau temukan inspirasi dari Bank Kuis." />
    <div className="qz-quiz-grid qz-quiz-grid--hub">
      <Card className="qz-quiz-card qz-quiz-card--feature"><QuizIcon size={25} /><h3>Kuis umum</h3><p>Kuis mandiri yang belum terhubung ke kelas mana pun. Siapkan dulu, gunakan atau bagikan nanti.</p><Link className={buttonClassName({ size: 'sm' })} to="/teacher/general-quizzes">Kelola kuis umum</Link></Card>
      <Card className="qz-quiz-card qz-quiz-card--feature"><QuizIcon size={25} /><h3>Bank Kuis</h3><p>Jelajahi karya guru lain dan terbitkan kuis pilihan Anda agar dapat digunakan bersama.</p><Link className={buttonClassName({ variant: 'secondary', size: 'sm' })} to="/teacher/quiz-bank">Buka Bank Kuis</Link></Card>
    </div>
    <section className="qz-bank-section"><h2>Kuis di kelas</h2>{status === 'loading' ? <Skeleton height={180} /> : classes.length ? <div className="qz-quiz-grid">{classes.map((item) => <Card className="qz-quiz-card" key={item.id}><QuizIcon size={25} /><h3>{item.name}</h3><p>{item.description || 'Kelola evaluasi untuk kelas ini.'}</p><Link className={buttonClassName({ size: 'sm' })} to={`/teacher/classes/${item.id}/quizzes`}>Buka kuis kelas</Link></Card>)}</div> : <Card><EmptyState icon={QuizIcon} title="Belum ada kelas" description="Kuis umum tetap bisa dibuat tanpa kelas. Buat kelas saat evaluasi perlu dibagikan ke siswa tertentu." /></Card>}</section>
  </div>;
}
