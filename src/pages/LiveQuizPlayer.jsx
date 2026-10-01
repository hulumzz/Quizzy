import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, PageHeader, buttonClassName } from '../components/ui';
import { shuffledItemIds } from '../features/quiz/runtime';
import { answerLiveQuestion, getLiveParticipantResult, getLiveSession, liveQuizErrorMessage, openLiveSocket } from '../services/live-quiz.service';

const storageKey = (code) => `quizzy.live.${code.toUpperCase()}`;

function LiveInteractiveAnswer({ question, value, onChange, disabled }) {
  const [dragging, setDragging] = useState(null);
  if (question.type === 'arrange') {
    const order = Array.isArray(value) && value.length ? value : (question.items || []).map((item) => item.id);
    const map = new Map((question.items || []).map((item) => [item.id, item]));
    const move = (from, to) => {
      const next = [...order];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      onChange(next);
    };
    return <ol className="qz-arrange-answer qz-arrange-answer--live">{order.map((id, index) => <motion.li layout draggable={!disabled} key={id} onDragStart={() => setDragging(index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!disabled && dragging !== null) move(dragging, index); setDragging(null); }}><span aria-hidden="true">⠿</span><strong>{map.get(id)?.text}</strong><button type="button" disabled={disabled || index === 0} onClick={() => move(index, index - 1)}>↑</button><button type="button" disabled={disabled || index === order.length - 1} onClick={() => move(index, index + 1)}>↓</button></motion.li>)}</ol>;
  }
  if (question.type === 'image_hotspot') return <div className="qz-hotspot-answer qz-hotspot-answer--interactive" onClick={(event) => { if (disabled) return; const box = event.currentTarget.getBoundingClientRect(); onChange({ x: Math.max(0, Math.min(100, ((event.clientX - box.left) / box.width) * 100)), y: Math.max(0, Math.min(100, ((event.clientY - box.top) / box.height) * 100)) }); }}><img src={question.imageUrl} alt="Gambar untuk dijawab" /><span className="qz-hotspot-answer__hint">Klik titik yang menurutmu paling tepat</span>{value && typeof value === 'object' ? <i style={{ left: `${value.x}%`, top: `${value.y}%` }} /> : null}</div>;
  if (question.type === 'short_answer') return <input className="qz-answer-input qz-answer-input--focus" disabled={disabled} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="Tulis jawabanmu" />;
  const choices = question.type === 'true_false' ? [{ label: 'Benar', value: true }, { label: 'Salah', value: false }] : question.choices.map((label) => ({ label, value: label }));
  return <div className="qz-live-answer-grid">{choices.map((choice, index) => <motion.button whileHover={disabled ? undefined : { y: -3 }} whileTap={disabled ? undefined : { scale: 0.98 }} type="button" disabled={disabled} key={choice.label} className={String(value) === String(choice.value) ? 'selected' : ''} aria-pressed={String(value) === String(choice.value)} onClick={() => onChange(choice.value)}><i>{String.fromCharCode(65 + index)}</i><span>{choice.label}</span></motion.button>)}</div>;
}

function hasAnswer(answer) {
  return Array.isArray(answer) ? answer.length > 0 : answer && typeof answer === 'object' ? true : answer !== '';
}

export default function LiveQuizPlayer() {
  const { code } = useParams();
  const [state, setState] = useState(null);
  const [answer, setAnswer] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const participant = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem(storageKey(code)) || 'null'); } catch { return null; }
  }, [code]);

  useEffect(() => {
    let active = true;
    getLiveSession(code)
      .then((next) => { if (active) setState(next); })
      .catch((caught) => { if (active) setError(liveQuizErrorMessage(caught)); });
    return () => { active = false; };
  }, [code]);

  useEffect(() => {
    if (!participant) return undefined;
    let active = true;
    let closeSocket = null;
    let retryTimer = null;
    const scheduleReconnect = () => {
      if (!active || retryTimer) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        connect();
      }, 1200);
    };
    const connect = () => {
      if (!active) return;
      setRealtimeStatus('connecting');
      closeSocket?.();
      closeSocket = openLiveSocket(code, {
        participant,
        onState: (next) => {
          if (!active) return;
          setState(next);
          setError('');
        },
        onResult: (next) => {
          if (active) setResult(next);
        },
        onStatus: (status) => {
          if (!active) return;
          setRealtimeStatus(status);
          if (status === 'disconnected' || status === 'error') scheduleReconnect();
        },
        onError: (socketError) => {
          if (!active) return;
          setError(socketError?.message || 'Koneksi realtime peserta belum dapat dipulihkan.');
        },
      });
    };
    connect();
    return () => {
      active = false;
      if (retryTimer) window.clearTimeout(retryTimer);
      closeSocket?.();
    };
  }, [code, participant]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    setReceipt(null);
    setAnswer(state?.question?.type === 'arrange' ? shuffledItemIds(state.question.items) : '');
  }, [state?.question?.id]);

  const seconds = state?.endsAt ? Math.max(0, Math.ceil((new Date(state.endsAt).getTime() - now) / 1000)) : 0;
  const duration = Math.max(1, Number(state?.questionDurationSeconds || 30));
  const timerProgress = Math.max(0, Math.min(100, (seconds / duration) * 100));
  const locked = Boolean(receipt) || seconds === 0;

  useEffect(() => {
    if (state?.phase !== 'finished' || result || !participant || realtimeStatus === 'connected') return undefined;
    let active = true;
    getLiveParticipantResult(code, participant)
      .then((next) => { if (active) setResult(next); })
      .catch((caught) => { if (active && caught?.code !== 'LIVE_RESULT_NOT_READY') setError(liveQuizErrorMessage(caught)); });
    return () => { active = false; };
  }, [code, participant, realtimeStatus, result, state?.phase]);

  const submit = async () => {
    if (!participant || !state?.question || locked) return;
    setError('');
    try { setReceipt(await answerLiveQuestion(code, { ...participant, questionId: state.question.id, answer })); }
    catch (caught) { setError(liveQuizErrorMessage(caught)); }
  };

  if (!participant) return <div className="qz-live-public"><PageHeader title="Sesi peserta tidak ditemukan" description="Masuk kembali menggunakan kode kuis dan nama yang sama." /><Link to={`/quiz/join/${code || ''}`} className={buttonClassName()}>Kembali ke gabung kuis</Link></div>;

  const phaseKey = `${state?.phase || 'loading'}:${state?.question?.id || 'none'}`;
  const connectionCopy = realtimeStatus === 'connected' ? 'Realtime tersambung' : realtimeStatus === 'connecting' ? 'Menyambungkan realtime…' : 'Mencoba menyambung ulang…';

  return <div className="qz-live-public qz-live-public--play qz-enter"><PageHeader eyebrow={`Halo, ${participant.name}`} title={state?.title || 'Menyiapkan kuis'} description={state?.phase === 'lobby' ? 'Kamu sudah masuk. Tunggu host memulai kuis.' : 'Jawab dari perangkatmu. Perubahan soal dikirim realtime dari host.'} />{error ? <div className="qz-inline-state qz-inline-state--error" role="alert">{error}</div> : null}<div className={`qz-live-connection qz-live-connection--${realtimeStatus}`}>{connectionCopy}</div><AnimatePresence mode="wait" initial={false}><motion.div key={phaseKey} initial={{ opacity: 0, scale: 0.97, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: -12 }} transition={{ duration: 0.22 }}>
    {state?.phase === 'question' && state.question ? <Card className="qz-live-player-card"><div className={`qz-live-timer-ring${seconds <= 5 ? ' is-urgent' : ''}`} style={{ '--timer-progress': `${timerProgress * 3.6}deg` }}><div><strong>{seconds}</strong><span>{seconds === 0 ? 'habis' : 'detik'}</span></div></div><div className="qz-live-question-meta"><span className="qz-eyebrow">SOAL {state.questionIndex + 1} DARI {state.questionCount}</span><span>{state.question.points} poin</span></div><h1>{state.question.prompt}</h1><LiveInteractiveAnswer question={state.question} value={answer} onChange={setAnswer} disabled={locked} />{receipt ? <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="qz-live-answer-locked" role="status"><strong>✓ Jawaban terkunci</strong><span>Sudah aman di server. Tunggu host membuka pembahasan.</span></motion.div> : seconds === 0 ? <div className="qz-live-timeout" role="status"><strong>Waktu habis</strong><span>Menunggu host membuka jawaban.</span></div> : <Button block disabled={!hasAnswer(answer)} onClick={submit}>Kunci jawaban</Button>}</Card>
      : state?.phase === 'reveal' && state.question ? <Card className="qz-live-reveal qz-live-reveal--player"><motion.span initial={{ rotate: -30, scale: 0 }} animate={{ rotate: 0, scale: 1 }} className="qz-live-wait__spark">✦</motion.span><span className="qz-eyebrow">JAWABAN & PEMBAHASAN</span><h2>{state.question.prompt}</h2><strong>Jawaban benar: {Array.isArray(state.question.correctAnswer) ? 'Susunan yang ditetapkan guru' : String(state.question.correctAnswer)}</strong><p>{receipt ? 'Jawabanmu sudah terkunci dan skor resmi dihitung server.' : 'Kamu belum mengunci jawaban pada soal ini.'}</p>{state.question.explanation ? <p>{state.question.explanation}</p> : null}</Card>
        : state?.phase === 'finished' && result ? <Card className="qz-live-result"><div className="qz-result-burst" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div><span className="qz-live-wait__spark">✦</span><span className="qz-eyebrow">PERINGKAT AKHIR</span><h2>Keren, {result.participant.name}!</h2><strong>{result.participant.score} poin</strong><p>{result.participant.correctCount} jawaban benar dari {result.questionCount} soal · Peringkat #{result.participant.rank}</p></Card>
          : <Card className="qz-live-wait"><motion.span animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1.08, 1] }} transition={{ duration: 2.4, repeat: Infinity }} className="qz-live-wait__spark">✦</motion.span><h2>{state?.phase === 'finished' ? 'Menghitung hasilmu...' : 'Kamu sudah di lobi!'}</h2><p>{state?.phase === 'finished' ? 'Jawaban terakhir sedang diamankan.' : 'Tetap di halaman ini. Soal berikutnya akan muncul otomatis.'}</p></Card>}
  </motion.div></AnimatePresence></div>;
}
