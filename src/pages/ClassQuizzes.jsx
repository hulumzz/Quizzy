import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassWorkspaceNav from '../components/classroom/ClassWorkspaceNav';
import { AddIcon, QuizIcon } from '../components/icons';
import { Button, Card, EmptyState, PageHeader, Skeleton, buttonClassName } from '../components/ui';
import { getClass } from '../services/class.service';
import { deleteQuiz, listQuizzes, quizErrorMessage } from '../services/quiz.service';

export default function ClassQuizzes({ role }) {
  const { classId } = useParams();
  const [state, setState] = useState({ loading: true, quizzes: [], error: null });
  const [className, setClassName] = useState('Ruang kelas');
  const load = () => listQuizzes(classId).then((quizzes) => setState({ loading: false, quizzes, error: null })).catch((error) => setState({ loading: false, quizzes: [], error }));
  useEffect(() => { const controller = new AbortController(); getClass(classId, { signal: controller.signal }).then((item) => setClassName(item.name)).catch(() => {}); listQuizzes(classId, { signal: controller.signal }).then((quizzes) => setState({ loading: false, quizzes, error: null })).catch((error) => { if (error.name !== 'AbortError') setState({ loading: false, quizzes: [], error }); }); return () => controller.abort(); }, [classId]);
  const remove = async (quiz) => { if (!window.confirm(`Hapus kuis "${quiz.title}"?`)) return; try { await deleteQuiz(classId, quiz.id); load(); } catch (error) { setState((current) => ({ ...current, error })); } };
  return <div className="qz-dashboard qz-enter">
    <PageHeader eyebrow={`${role === 'teacher' ? 'Ruang guru' : 'Ruang siswa'} · ${className}`} title="Kuis kelas" description={role === 'teacher' ? 'Susun evaluasi mandiri, terbitkan, lalu pantau hasil siswa.' : 'Kerjakan kuis yang telah diterbitkan oleh guru.'} actions={role === 'teacher' ? <Link className={buttonClassName()} to={`/teacher/classes/${classId}/quizzes/new`}><AddIcon size={18} /> Buat kuis</Link> : null} />
    <ClassWorkspaceNav role={role} classId={classId} />
    {state.error ? <div className="qz-inline-state qz-inline-state--error">{quizErrorMessage(state.error)} <Button variant="ghost" size="sm" onClick={load}>Coba lagi</Button></div> : null}
    {state.loading ? <div className="qz-quiz-grid"><Skeleton height={190} /><Skeleton height={190} /></div> : state.quizzes.length ? <div className="qz-quiz-grid">{state.quizzes.map((quiz) => <Card key={quiz.id} className="qz-quiz-card">
      <div className="qz-quiz-card__top"><span className={`qz-quiz-status qz-quiz-status--${quiz.status}`}>{quiz.status === 'published' ? 'Diterbitkan' : 'Draf'}</span><QuizIcon size={22} /></div>
      <h3>{quiz.title}</h3><p>{quiz.description || 'Tanpa deskripsi.'}</p><div className="qz-quiz-meta"><span>{quiz.questionCount} soal</span><span>{quiz.totalPoints} poin</span><span>Lulus {quiz.settings?.passingScore ?? 70}</span></div>
      <div className="qz-quiz-actions">{role === 'teacher' ? <>{quiz.status === 'published' ? <Link className={buttonClassName({ size: 'sm' })} to={`/teacher/classes/${classId}/quizzes/${quiz.id}/live`}>Mulai live</Link> : null}<Link className={buttonClassName({ variant: 'secondary', size: 'sm' })} to={`/teacher/classes/${classId}/quizzes/${quiz.id}/edit`}>Edit</Link><Link className={buttonClassName({ variant: 'ghost', size: 'sm' })} to={`/teacher/classes/${classId}/quizzes/${quiz.id}/results`}>Hasil</Link><Button variant="ghost" size="sm" onClick={() => remove(quiz)}>Hapus</Button></> : <Link className={buttonClassName({ size: 'sm' })} to={`/student/classes/${classId}/quizzes/${quiz.id}`}>Kerjakan</Link>}</div>
    </Card>)}</div> : <Card><EmptyState icon={QuizIcon} title={role === 'teacher' ? 'Buat kuis pertama' : 'Belum ada kuis'} description={role === 'teacher' ? 'Mulai dari draf, tambahkan soal, lalu terbitkan saat siap.' : 'Kuis yang diterbitkan guru akan muncul di sini.'} /></Card>}
  </div>;
}
