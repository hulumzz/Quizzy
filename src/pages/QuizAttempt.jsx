import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Dialog, PageHeader, Progress, buttonClassName } from '../components/ui';
import { initialiseArrangeAnswers } from '../features/quiz/runtime';
import { getQuiz, getQuizResults, quizErrorMessage, submitQuiz } from '../services/quiz.service';

const questionTypeLabel = {
  multiple_choice: 'Pilihan ganda',
  true_false: 'Benar / Salah',
  short_answer: 'Jawaban singkat',
  arrange: 'Susun urutan',
  image_hotspot: 'Klik gambar',
};

const draftKey = (classId, quizId, version) => `nalaro.quiz.draft.${classId}.${quizId}.${version || 'v1'}`;

function ArrangeAnswer({ question, value, onChange }) {
  const [dragging, setDragging] = useState(null);
  const order = Array.isArray(value) ? value : [];
  const items = new Map((question.items || []).map((item) => [item.id, item]));
  const move = (from, to) => {
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  return <ol className="qz-arrange-answer">{order.map((id, index) => <li key={id} draggable onDragStart={() => setDragging(index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (dragging !== null) move(dragging, index); setDragging(null); }}><span aria-hidden="true">⠿</span><strong>{items.get(id)?.text}</strong><button type="button" aria-label="Naik" disabled={index === 0} onClick={() => move(index, index - 1)}>↑</button><button type="button" aria-label="Turun" disabled={index === order.length - 1} onClick={() => move(index, index + 1)}>↓</button></li>)}</ol>;
}

function HotspotAnswer({ question, value, onChange }) {
  const choose = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    onChange({
      x: Math.max(0, Math.min(100, ((event.clientX - box.left) / box.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - box.top) / box.height) * 100)),
    });
  };
  return <div className="qz-hotspot-answer qz-hotspot-answer--interactive" onClick={choose}><img src={question.imageUrl} alt="Gambar untuk dijawab" /><span className="qz-hotspot-answer__hint">Klik titik yang menurutmu paling tepat</span>{value && typeof value === 'object' ? <i style={{ left: `${value.x}%`, top: `${value.y}%` }} /> : null}</div>;
}

function AnswerInput({ question, value, onChange }) {
  if (question.type === 'multiple_choice') return <div className="qz-choice-list qz-choice-list--interactive">{question.choices.map((choice, index) => <motion.button whileTap={{ scale: 0.98 }} type="button" key={choice} className={value === choice ? 'is-selected' : ''} aria-pressed={value === choice} onClick={() => onChange(choice)}><i>{String.fromCharCode(65 + index)}</i><span>{choice}</span><kbd>{index + 1}</kbd></motion.button>)}</div>;
  if (question.type === 'true_false') {
    const choices = [{ label: 'Benar', value: true }, { label: 'Salah', value: false }];
    return <div className="qz-choice-list qz-choice-list--interactive">{choices.map((choice, index) => <motion.button whileTap={{ scale: 0.98 }} type="button" key={choice.label} className={value === choice.value ? 'is-selected' : ''} onClick={() => onChange(choice.value)}><i>{index + 1}</i><span>{choice.label}</span><kbd>{index + 1}</kbd></motion.button>)}</div>;
  }
  if (question.type === 'arrange') return <ArrangeAnswer question={question} value={value} onChange={onChange} />;
  if (question.type === 'image_hotspot') return <HotspotAnswer question={question} value={value} onChange={onChange} />;
  return <input className="qz-answer-input qz-answer-input--focus" value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="Tulis jawabanmu di sini..." />;
}

function answered(value) {
  return Array.isArray(value) ? value.length > 0 : value && typeof value === 'object' ? true : value !== '' && value !== undefined && value !== null;
}

function resultAnswer(value) {
  if (Array.isArray(value)) return value.join(' → ');
  if (value && typeof value === 'object') return 'Titik pada gambar';
  return String(value) || 'Tidak dijawab';
}

export default function QuizAttempt() {
  const { classId, quizId } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const existingResult = getQuizResults(classId, quizId, { signal: controller.signal }).catch((caught) => {
      if (caught?.status === 404) return null;
      throw caught;
    });
    Promise.all([getQuiz(classId, quizId, { signal: controller.signal }), existingResult])
      .then(([item, previousResult]) => {
        setQuiz(item);
        if (previousResult && !Array.isArray(previousResult)) setResult(previousResult);
      })
      .catch((caught) => { if (caught.name !== 'AbortError') setError(quizErrorMessage(caught)); })
      .finally(() => setBusy(false));
    return () => controller.abort();
  }, [classId, quizId]);

  const questions = useMemo(() => {
    if (!quiz) return [];
    const items = [...quiz.questions];
    if (!quiz.settings?.shuffleQuestions) return items;
    for (let index = items.length - 1; index > 0; index -= 1) {
      const random = new Uint32Array(1);
      crypto.getRandomValues(random);
      const target = random[0] % (index + 1);
      [items[index], items[target]] = [items[target], items[index]];
    }
    return items;
  }, [quiz]);

  useEffect(() => {
    if (!quiz || !questions.length || result || draftReady) return;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(draftKey(classId, quizId, quiz.updatedAt)) || 'null'); } catch { saved = null; }
    const prepared = initialiseArrangeAnswers(questions, saved?.answers || {});
    setAnswers(prepared);
    const savedIndex = questions.findIndex((question) => question.id === saved?.activeQuestionId);
    if (savedIndex >= 0) setActiveIndex(savedIndex);
    setDraftReady(true);
  }, [classId, draftReady, questions, quiz, quizId, result]);

  useEffect(() => {
    if (!quiz || !draftReady || result || !questions.length) return;
    const activeQuestionId = questions[activeIndex]?.id || questions[0]?.id;
    sessionStorage.setItem(draftKey(classId, quizId, quiz.updatedAt), JSON.stringify({ answers, activeQuestionId, savedAt: new Date().toISOString() }));
  }, [activeIndex, answers, classId, draftReady, questions, quiz, quizId, result]);

  const activeQuestion = questions[activeIndex];
  const answeredCount = questions.filter((question) => answered(answers[question.id])).length;
  const remainingCount = Math.max(0, questions.length - answeredCount);
  const setAnswer = (value) => setAnswers((current) => ({ ...current, [activeQuestion.id]: value }));

  useEffect(() => {
    if (!activeQuestion || confirmOpen || result) return undefined;
    const onKeyDown = (event) => {
      const target = event.target;
      if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft' && activeIndex > 0) setActiveIndex((index) => index - 1);
      if (event.key === 'ArrowRight' && activeIndex < questions.length - 1) setActiveIndex((index) => index + 1);
      const optionIndex = Number(event.key) - 1;
      if (Number.isInteger(optionIndex) && optionIndex >= 0) {
        if (activeQuestion.type === 'multiple_choice' && activeQuestion.choices?.[optionIndex] !== undefined) setAnswer(activeQuestion.choices[optionIndex]);
        if (activeQuestion.type === 'true_false' && optionIndex < 2) setAnswer(optionIndex === 0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, activeQuestion, confirmOpen, questions.length, result]);

  const submit = async () => {
    setConfirmOpen(false);
    setBusy(true);
    setError('');
    try {
      const nextResult = await submitQuiz(classId, quizId, questions.map((question) => ({ questionId: question.id, answer: answers[question.id] ?? '' })));
      sessionStorage.removeItem(draftKey(classId, quizId, quiz.updatedAt));
      setResult(nextResult);
    } catch (caught) {
      setError(quizErrorMessage(caught));
    } finally { setBusy(false); }
  };

  if (result) return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Hasil kuis" title={quiz?.title || 'Hasil kuis'} description="Jawabanmu sudah dinilai oleh Nalaro Class." /><motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 20 }}><Card className={`qz-quiz-score qz-quiz-score--${result.passed ? 'passed' : 'retry'}`}><div className="qz-result-burst" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div><span>{result.passed ? 'Target tercapai' : 'Hasil tersimpan'}</span><strong>{result.score}</strong><p>{result.passed ? 'Mantap! Kamu mencapai nilai kelulusan.' : 'Nilaimu belum mencapai batas kelulusan, tetapi hasilnya sudah tercatat.'}</p><small>{result.earnedPoints} dari {result.totalPoints} poin</small></Card></motion.div>{result.review?.map((item, index) => <motion.div key={item.questionId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.35) }}><Card className="qz-review"><span className="qz-eyebrow">SOAL {index + 1}</span><strong>{item.prompt}</strong><p><b>Jawabanmu:</b> {resultAnswer(item.answer)}</p><p><b>Jawaban benar:</b> {resultAnswer(item.correctAnswer)}</p>{item.explanation ? <small>{item.explanation}</small> : null}</Card></motion.div>)}<Link className={buttonClassName({ variant: 'secondary' })} to={`/student/classes/${classId}/quizzes`}>Kembali ke daftar kuis</Link></div>;

  return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Kuis mandiri" title={quiz?.title || 'Memuat kuis...'} description={quiz?.description} actions={<Link className={buttonClassName({ variant: 'secondary' })} to={`/student/classes/${classId}/quizzes`}>Keluar</Link>} />{error ? <div className="qz-inline-state qz-inline-state--error" role="alert">{error}</div> : null}{quiz && activeQuestion ? <div className="qz-attempt"><Card className="qz-attempt__progress"><div className="qz-attempt__status"><span>{remainingCount ? `${remainingCount} soal tersisa` : 'Semua soal terjawab'}</span><small>{draftReady ? 'Progres tersimpan otomatis di tab ini' : 'Menyiapkan progres...'}</small></div><Progress value={answeredCount} max={questions.length} label={`${answeredCount} dari ${questions.length} soal terjawab`} /><div className="qz-attempt-navigator" aria-label="Navigasi soal">{questions.map((question, index) => <motion.button whileTap={{ scale: 0.92 }} key={question.id} type="button" className={`${index === activeIndex ? 'is-active ' : ''}${answered(answers[question.id]) ? 'is-answered' : ''}`.trim()} aria-label={`Buka soal ${index + 1}${answered(answers[question.id]) ? ', sudah dijawab' : ', belum dijawab'}`} aria-current={index === activeIndex ? 'step' : undefined} onClick={() => setActiveIndex(index)}>{index + 1}</motion.button>)}</div></Card><AnimatePresence mode="wait" initial={false}><motion.div key={activeQuestion.id} initial={{ opacity: 0, x: 28, filter: 'blur(3px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: -20, filter: 'blur(2px)' }} transition={{ duration: 0.22 }}><Card className="qz-attempt-question"><div className="qz-attempt-question__head"><div><span className="qz-eyebrow">SOAL {activeIndex + 1}</span><small>{questionTypeLabel[activeQuestion.type] || 'Pertanyaan'}</small></div><span className="qz-question-points">{activeQuestion.points} poin</span></div><h2>{activeQuestion.prompt}</h2>{activeQuestion.imageUrl && activeQuestion.type !== 'image_hotspot' ? <img className="qz-question-image__player" src={activeQuestion.imageUrl} alt="Ilustrasi soal" /> : null}<AnswerInput question={activeQuestion} value={answers[activeQuestion.id]} onChange={setAnswer} /><div className="qz-attempt-actions"><Button variant="secondary" disabled={activeIndex === 0 || busy} onClick={() => setActiveIndex((index) => index - 1)}>← Sebelumnya</Button><span className="qz-attempt-shortcut">Gunakan ← → untuk pindah soal</span>{activeIndex < questions.length - 1 ? <Button disabled={busy} onClick={() => setActiveIndex((index) => index + 1)}>Soal berikutnya →</Button> : <Button disabled={busy} onClick={() => setConfirmOpen(true)}>Tinjau & kumpulkan</Button>}</div></Card></motion.div></AnimatePresence></div> : null}<Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title={remainingCount ? 'Masih ada soal kosong' : 'Kumpulkan jawaban?'} description={`${answeredCount} dari ${questions.length} soal sudah terjawab.`} footer={<><Button variant="secondary" onClick={() => setConfirmOpen(false)}>Periksa lagi</Button><Button disabled={busy} onClick={submit}>{busy ? 'Mengumpulkan...' : 'Kumpulkan sekarang'}</Button></>}><p className="qz-dialog__copy">{remainingCount ? `${remainingCount} soal belum dijawab dan akan dikumpulkan sebagai kosong.` : 'Semua soal sudah terjawab. Setelah dikumpulkan, jawaban tidak dapat diubah.'}</p></Dialog></div>;
}
