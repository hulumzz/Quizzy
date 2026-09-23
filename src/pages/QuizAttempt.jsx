import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, PageHeader, buttonClassName } from '../components/ui';
import { getQuiz, quizErrorMessage, submitQuiz } from '../services/quiz.service';

export default function QuizAttempt() {
  const { classId, quizId } = useParams(); const [quiz, setQuiz] = useState(null); const [answers, setAnswers] = useState({}); const [result, setResult] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(true);
  useEffect(() => { const controller = new AbortController(); getQuiz(classId, quizId, { signal: controller.signal }).then(setQuiz).catch((caught) => { if (caught.name !== 'AbortError') setError(quizErrorMessage(caught)); }).finally(() => setBusy(false)); return () => controller.abort(); }, [classId, quizId]);
  const questions = useMemo(() => {
    if (!quiz) return [];
    const items = [...quiz.questions];
    if (!quiz.settings?.shuffleQuestions) return items;
    for (let index = items.length - 1; index > 0; index -= 1) {
      const random = new Uint32Array(1); crypto.getRandomValues(random);
      const target = random[0] % (index + 1);
      [items[index], items[target]] = [items[target], items[index]];
    }
    return items;
  }, [quiz]);
  const submit = async () => { setBusy(true); setError(''); try { setResult(await submitQuiz(classId, quizId, questions.map((question) => ({ questionId: question.id, answer: answers[question.id] ?? '' })))); } catch (caught) { setError(quizErrorMessage(caught)); } finally { setBusy(false); } };
  if (result) return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Hasil kuis" title={quiz.title} description="Jawabanmu sudah dinilai oleh Quizzy." /><Card className="qz-quiz-score"><span>Nilai akhir</span><strong>{result.score}</strong><p>{result.passed ? 'Kamu mencapai nilai kelulusan.' : 'Nilaimu belum mencapai batas kelulusan.'}</p><small>{result.earnedPoints} dari {result.totalPoints} poin</small></Card>{result.review?.map((item, index) => <Card className="qz-review" key={item.questionId}><strong>{index + 1}. {item.prompt}</strong><p>Jawabanmu: {String(item.answer) || 'Tidak dijawab'}</p><p>Jawaban benar: {String(item.correctAnswer)}</p>{item.explanation ? <small>{item.explanation}</small> : null}</Card>)}<Link className={buttonClassName({ variant: 'secondary' })} to={`/student/classes/${classId}/quizzes`}>Kembali ke daftar kuis</Link></div>;
  return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Kuis mandiri" title={quiz?.title || 'Memuat kuis...'} description={quiz?.description} actions={<Link className={buttonClassName({ variant: 'secondary' })} to={`/student/classes/${classId}/quizzes`}>Keluar</Link>} />{error ? <div className="qz-inline-state qz-inline-state--error">{error}</div> : null}{questions.map((question, index) => <Card className="qz-attempt-question" key={question.id}><h3>{index + 1}. {question.prompt}</h3><span>{question.points} poin</span>{question.type === 'multiple_choice' ? question.choices.map((choice) => <label key={choice}><input type="radio" name={question.id} checked={answers[question.id] === choice} onChange={() => setAnswers({ ...answers, [question.id]: choice })} /> {choice}</label>) : question.type === 'true_false' ? ['true', 'false'].map((value) => <label key={value}><input type="radio" name={question.id} checked={String(answers[question.id]) === value} onChange={() => setAnswers({ ...answers, [question.id]: value === 'true' })} /> {value === 'true' ? 'Benar' : 'Salah'}</label>) : <input className="qz-answer-input" value={answers[question.id] || ''} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })} placeholder="Tulis jawabanmu" />}</Card>)}{quiz ? <Button disabled={busy} onClick={submit}>{busy ? 'Mengumpulkan...' : 'Kumpulkan jawaban'}</Button> : null}</div>;
}
