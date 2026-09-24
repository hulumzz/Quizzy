import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QuizIcon } from '../../components/icons';
import { Button, Card, EmptyState, PageHeader, Skeleton, buttonClassName } from '../../components/ui';
import { deleteGeneralQuiz, listGeneralQuizzes, quizErrorMessage } from '../../services/quiz.service';

export default function TeacherGeneralQuizzes() {
  const [quizzes, setQuizzes] = useState([]); const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState(''); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setQuizzes(await listGeneralQuizzes()); } catch (caught) { setError(quizErrorMessage(caught)); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const remove = async (quiz) => { if (!window.confirm(`Hapus draf "${quiz.title}"?`)) return; setBusyId(quiz.id); setError(''); try { await deleteGeneralQuiz(quiz.id); setQuizzes((current) => current.filter((item) => item.id !== quiz.id)); } catch (caught) { setError(quizErrorMessage(caught)); } finally { setBusyId(''); } };
  return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Studio mandiri" title="Kuis umum" description="Kuis ini milik Anda dan tidak otomatis terlihat oleh siswa atau kelas mana pun." actions={<><Link className={buttonClassName({ variant: 'secondary' })} to="/teacher/quizzes">Kembali ke Kuis</Link><Link className={buttonClassName()} to="/teacher/general-quizzes/new">Buat kuis umum</Link></>} />
    {error ? <div className="qz-inline-state qz-inline-state--error">{error}</div> : null}
    {loading ? <div className="qz-quiz-grid"><Skeleton height={220} /><Skeleton height={220} /></div> : quizzes.length ? <div className="qz-quiz-grid">{quizzes.map((quiz) => <Card className="qz-quiz-card" key={quiz.id}><QuizIcon size={25} /><div className="qz-bank-card__head"><span>{quiz.status === 'published' ? 'Terbit' : 'Draf'}</span><small>{quiz.questionCount} soal</small></div><h3>{quiz.title}</h3><p>{quiz.description || 'Belum ada deskripsi.'}</p><div className="qz-quiz-card__actions"><Link className={buttonClassName({ size: 'sm' })} to={`/teacher/general-quizzes/${quiz.id}/edit`}>Edit kuis</Link>{quiz.status === 'published' ? <><Link className={buttonClassName({ variant: 'secondary', size: 'sm' })} to={`/teacher/general-quizzes/${quiz.id}/live`}>Mulai live</Link><Link className={buttonClassName({ variant: 'ghost', size: 'sm' })} to={`/teacher/quiz-bank?source=general&quizId=${quiz.id}`}>Bagikan</Link></> : null}<Button variant="ghost" size="sm" disabled={busyId === quiz.id} onClick={() => remove(quiz)}>Hapus</Button></div></Card>)}</div> : <Card><EmptyState icon={QuizIcon} title="Belum ada kuis umum" description="Mulai dari draf mandiri untuk menyiapkan soal sebelum memilih kelas atau membagikannya." action={<Link className={buttonClassName()} to="/teacher/general-quizzes/new">Buat kuis umum</Link>} /></Card>}
  </div>;
}
