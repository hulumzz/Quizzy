import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Input, PageHeader, buttonClassName } from '../components/ui';
import { resolveLiveSessionId } from '../features/quiz/runtime';
import { advanceGeneralLiveSession, advanceLiveSession, createGeneralLiveSession, createLiveSession, getGeneralLiveHostSession, getLiveHostSession, liveQuizErrorMessage } from '../services/live-quiz.service';

const hostStorageKey = ({ general, classId, quizId }) => `nalaro.live.host.${general ? 'general' : classId}.${quizId}`;

export default function LiveQuizHost({ scope = 'class' }) {
  const { classId, quizId } = useParams();
  const general = scope === 'general';
  const [duration, setDuration] = useState(30);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const autoAdvancedQuestionRef = useRef('');
  const storageKey = useMemo(() => hostStorageKey({ general, classId, quizId }), [classId, general, quizId]);
  const backPath = general ? '/teacher/general-quizzes' : `/teacher/classes/${classId}/quizzes`;
  const liveSessionId = resolveLiveSessionId(session);

  const fetchHostState = (sessionId) => general ? getGeneralLiveHostSession(sessionId) : getLiveHostSession(classId, sessionId);
  const advanceHostState = (sessionId, name) => general ? advanceGeneralLiveSession(sessionId, name) : advanceLiveSession(classId, sessionId, name);

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) { setRecovering(false); return undefined; }
    let active = true;
    fetchHostState(saved)
      .then((next) => { if (active) setSession(next); })
      .catch((caught) => {
        sessionStorage.removeItem(storageKey);
        if (active && caught?.status !== 404) setError(liveQuizErrorMessage(caught));
      })
      .finally(() => { if (active) setRecovering(false); });
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    if (liveSessionId) sessionStorage.setItem(storageKey, liveSessionId);
  }, [liveSessionId, storageKey]);

  useEffect(() => {
    if (!liveSessionId) return undefined;
    let active = true;
    const refresh = () => fetchHostState(liveSessionId)
      .then((next) => { if (active) { setSession(next); setError(''); } })
      .catch((caught) => {
        if (!active) return;
        if (caught?.status === 404) {
          sessionStorage.removeItem(storageKey);
          setSession(null);
        }
        setError(liveQuizErrorMessage(caught));
      });
    const timer = window.setInterval(refresh, session?.phase === 'question' ? 1000 : 1800);
    return () => { active = false; window.clearInterval(timer); };
  }, [classId, general, liveSessionId, session?.phase, storageKey]);

  useEffect(() => {
    if (session?.phase !== 'question') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [session?.phase]);

  const create = async () => {
    setBusy(true); setError('');
    try {
      const next = general ? await createGeneralLiveSession(quizId, { questionDurationSeconds: Number(duration) }) : await createLiveSession(classId, quizId, { questionDurationSeconds: Number(duration) });
      setSession(next);
      sessionStorage.setItem(storageKey, resolveLiveSessionId(next));
    } catch (caught) { setError(liveQuizErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  const action = async (name) => {
    if (!liveSessionId) return;
    setBusy(true); setError('');
    try { setSession(await advanceHostState(liveSessionId, name)); }
    catch (caught) {
      if (name === 'advance' && session?.phase === 'question') autoAdvancedQuestionRef.current = '';
      setError(liveQuizErrorMessage(caught));
    } finally { setBusy(false); }
  };

  const resetHostSession = () => {
    sessionStorage.removeItem(storageKey);
    autoAdvancedQuestionRef.current = '';
    setSession(null);
    setError('');
    setCopied(false);
  };

  const joinUrl = `${window.location.origin}/quiz/join/${session?.code || ''}`;
  const seconds = session?.endsAt ? Math.max(0, Math.ceil((new Date(session.endsAt).getTime() - now) / 1000)) : null;
  const durationSeconds = Math.max(1, Number(session?.questionDurationSeconds || duration || 30));
  const timerPercent = seconds === null ? 100 : Math.max(0, Math.min(100, (seconds / durationSeconds) * 100));
  const leaderboard = [...(session?.participants || [])].sort((left, right) => right.score - left.score || right.correctCount - left.correctCount || String(left.joinedAt).localeCompare(String(right.joinedAt))).map((participant, index) => ({ ...participant, rank: index + 1 }));
  const buttonLabel = session?.phase === 'lobby' ? 'Mulai soal pertama' : session?.phase === 'question' ? 'Buka jawaban sekarang' : session?.phase === 'reveal' ? 'Soal berikutnya' : 'Sesi selesai';

  useEffect(() => {
    const questionId = session?.question?.id;
    if (session?.phase !== 'question' || seconds !== 0 || !questionId || busy || !liveSessionId || autoAdvancedQuestionRef.current === questionId) return;
    autoAdvancedQuestionRef.current = questionId;
    void action('advance');
  }, [busy, liveSessionId, seconds, session?.phase, session?.question?.id]);

  const copyJoin = async () => {
    try {
      await navigator.clipboard?.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { setCopied(false); }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    } catch { /* browser may deny fullscreen */ }
  };

  const phaseKey = `${session?.phase || 'create'}:${session?.question?.id || 'none'}`;

  return <div className="qz-dashboard qz-enter"><PageHeader eyebrow={general ? 'Host kuis umum' : 'Nalaro Live'} title={session?.title || 'Mulai kuis live'} description="Bagikan QR atau kode sesi. Saat kuis berjalan, jawaban akan terbuka otomatis ketika waktu habis." actions={<><Button variant="ghost" onClick={toggleFullscreen}>Mode layar penuh</Button><Link className={buttonClassName({ variant: 'secondary' })} to={backPath}>Kembali</Link></>} />
    {error ? <div className="qz-inline-state qz-inline-state--error" role="alert">{error}</div> : null}
    {recovering ? <Card className="qz-live-create"><h2>Memulihkan sesi...</h2><p>Jika sesi Live sebelumnya masih aktif, host akan tersambung kembali otomatis.</p></Card> : !session ? <Card className="qz-live-create"><span className="qz-live-create__spark">✦</span><h2>Siapkan arena</h2><p>Pilih durasi, buat sesi, lalu tampilkan QR di layar kelas. Skor dan deadline tetap dihitung server.</p><Input label="Durasi per soal (detik)" type="number" min="5" max="300" value={duration} onChange={(event) => setDuration(event.target.value)} /><Button disabled={busy} onClick={create}>{busy ? 'Membuat arena...' : 'Buat sesi live'}</Button></Card> : <div className="qz-live-host">
      <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}><Card className="qz-live-code"><div><span className="qz-eyebrow">KODE KUIS</span><strong>{session.code}</strong><p>{session.participantCount} peserta bergabung</p><button type="button" className="qz-live-link" onClick={copyJoin}>{copied ? '✓ Tautan tersalin' : 'Salin tautan gabung'}</button></div><QRCodeSVG value={joinUrl} size={164} level="M" includeMargin /></Card></motion.div>
      <AnimatePresence mode="wait" initial={false}><motion.div key={phaseKey} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}><Card className="qz-live-stage"><div className="qz-live-stage__meta"><span className={`qz-live-phase qz-live-phase--${session.phase}`}>{session.phase === 'lobby' ? 'Lobi terbuka' : session.phase === 'question' ? `Soal ${session.questionIndex + 1}` : session.phase === 'reveal' ? 'Jawaban & papan skor' : 'Selesai'}</span><span>{session.questionCount} soal</span>{session.phase === 'question' ? <><span>{session.answeredCount}/{session.participantCount} menjawab</span><span className={`qz-live-host-timer${seconds <= 5 ? ' is-urgent' : ''}`}>{seconds === 0 ? 'Waktu habis' : `${seconds} detik`}</span></> : null}</div>{session.phase === 'question' ? <div className="qz-live-host-progress" aria-hidden="true"><b style={{ width: `${timerPercent}%` }} /></div> : null}<h2>{session.question?.prompt || 'Tunggu peserta bergabung, lalu mulai saat siap.'}</h2>{session.question?.choices ? <div className="qz-live-choice-preview">{session.question.choices.map((choice, index) => <span key={choice}><i>{String.fromCharCode(65 + index)}</i>{choice}</span>)}</div> : null}{['question', 'reveal'].includes(session.phase) && Object.keys(session.optionCounts || {}).length ? <div className="qz-live-distribution">{Object.entries(session.optionCounts).map(([choice, count]) => <div key={choice}><span>{choice}</span><b style={{ width: `${Math.round((count / Math.max(session.answeredCount, 1)) * 100)}%` }} /><strong>{count}</strong></div>)}</div> : null}{session.phase === 'reveal' && session.question ? <><motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="qz-live-reveal"><strong>Jawaban benar: {Array.isArray(session.question.correctAnswer) ? 'Susunan yang ditetapkan guru' : String(session.question.correctAnswer)}</strong>{session.question.explanation ? <p>{session.question.explanation}</p> : null}</motion.div>{leaderboard.length ? <ol className="qz-live-leaderboard">{leaderboard.slice(0, 5).map((participant, index) => <motion.li initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} key={participant.id}><b>#{participant.rank}</b><span>{participant.name}</span><strong>{participant.score} poin</strong></motion.li>)}</ol> : null}</> : null}<div className="qz-live-host__actions">{session.phase !== 'finished' ? <Button disabled={busy} onClick={() => action('advance')}>{busy ? 'Memperbarui...' : buttonLabel}</Button> : null}{session.phase !== 'finished' ? <Button variant="secondary" disabled={busy} onClick={() => action('finish')}>Akhiri sesi</Button> : null}</div></Card></motion.div></AnimatePresence>
      <Card className="qz-live-participants"><div className="qz-live-participants__heading"><h2>Peserta</h2><strong>{session.participants?.length || 0}</strong></div><div>{session.participants?.length ? session.participants.map((participant, index) => <motion.span initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(index * 0.025, 0.3) }} key={participant.id}>{participant.name}{session.phase === 'finished' ? ` · ${participant.score} poin` : ''}</motion.span>) : <p>Belum ada peserta. Tampilkan QR atau kode di layar host.</p>}</div></Card>{session.phase === 'finished' ? <Card className="qz-live-results"><div className="qz-result-burst" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div><span className="qz-eyebrow">PAPAN SKOR AKHIR</span><h2>Selamat untuk para pemain!</h2>{session.leaderboard?.length ? <ol>{session.leaderboard.slice(0, 10).map((participant) => <li key={participant.id}><b>#{participant.rank}</b><span>{participant.name}</span><strong>{participant.score} poin</strong></li>)}</ol> : <p>Belum ada jawaban yang selesai diproses.</p>}<div className="qz-live-results__actions"><Button onClick={resetHostSession}>Buat sesi baru</Button><Link className={buttonClassName({ variant: 'secondary' })} to={backPath}>Kembali ke daftar kuis</Link></div></Card> : null}
    </div>}</div>;
}
