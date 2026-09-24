import { Link } from 'react-router-dom';
import { QuizIcon } from '../../components/icons';
import { Card, EmptyState, PageHeader, Skeleton, buttonClassName } from '../../components/ui';
import { useClasses } from '../../features/classes/hooks/useClasses';

export default function TeacherQuizzes() {
  const { classes, status } = useClasses();
  return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Ruang guru" title="Kuis" description="Pilih kelas untuk membuat kuis dan melihat hasil siswa." actions={<Link className={buttonClassName({ variant: 'secondary' })} to="/teacher/quiz-bank">Bank Kuis</Link>} />{status === 'loading' ? <Skeleton height={180} /> : classes.length ? <div className="qz-quiz-grid">{classes.map((item) => <Card className="qz-quiz-card" key={item.id}><QuizIcon size={25} /><h3>{item.name}</h3><p>{item.description || 'Kelola evaluasi untuk kelas ini.'}</p><Link className={buttonClassName({ size: 'sm' })} to={`/teacher/classes/${item.id}/quizzes`}>Buka kuis kelas</Link></Card>)}</div> : <Card><EmptyState icon={QuizIcon} title="Belum ada kelas" description="Buat kelas terlebih dahulu sebelum menyusun kuis." /></Card>}</div>;
}
