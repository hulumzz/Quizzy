import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, EmptyState, PageHeader, buttonClassName } from '../../components/ui';
import { QuizIcon } from '../../components/icons';
import { getQuiz, getQuizResults, quizErrorMessage } from '../../services/quiz.service';

export default function QuizResults() {
  const { classId, quizId } = useParams(); const [quiz, setQuiz] = useState(null); const [results, setResults] = useState([]); const [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); Promise.all([getQuiz(classId, quizId, { signal: controller.signal }), getQuizResults(classId, quizId, { signal: controller.signal })]).then(([item, list]) => { setQuiz(item); setResults(list); }).catch((caught) => { if (caught.name !== 'AbortError') setError(quizErrorMessage(caught)); }); return () => controller.abort(); }, [classId, quizId]);
  return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Analisis kuis" title={quiz?.title || 'Hasil kuis'} description="Pantau nilai percobaan siswa yang sudah terkumpul." actions={<Link className={buttonClassName({ variant: 'secondary' })} to={`/teacher/classes/${classId}/quizzes`}>Kembali</Link>} />{error ? <div className="qz-inline-state qz-inline-state--error">{error}</div> : null}{results.length ? <Card><div className="qz-results-table"><div className="qz-results-row qz-results-row--head"><span>Siswa</span><span>Nilai</span><span>Status</span><span>Waktu</span></div>{results.map((result) => <div className="qz-results-row" key={result.id}><span>{result.studentId}</span><strong>{result.score}</strong><span>{result.passed ? 'Lulus' : 'Belum lulus'}</span><time>{new Date(result.submittedAt).toLocaleString('id-ID')}</time></div>)}</div></Card> : <Card><EmptyState icon={QuizIcon} title="Belum ada hasil" description="Hasil akan muncul setelah siswa mengumpulkan kuis." /></Card>}</div>;
}
