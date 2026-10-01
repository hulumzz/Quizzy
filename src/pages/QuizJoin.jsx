import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { QuizIcon } from '../components/icons';
import { Button, Card, Input, PageHeader } from '../components/ui';
import { getLiveSession, joinLiveSession, liveQuizErrorMessage } from '../services/live-quiz.service';

const storageKey = (code) => `quizzy.live.${code.toUpperCase()}`;

export default function QuizJoin() {
  const { code: initialCode = '' } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState('');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialCode.length !== 6) return;
    getLiveSession(initialCode).then(setSession).catch((caught) => setError(liveQuizErrorMessage(caught)));
  }, [initialCode]);

  const inspect = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const normalized = code.trim().toUpperCase();
      const found = await getLiveSession(normalized);
      setSession(found);
      navigate(`/quiz/join/${normalized}`, { replace: true });
    } catch (caught) { setError(liveQuizErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  const join = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const normalized = code.trim().toUpperCase();
      const joined = await joinLiveSession(normalized, name);
      try { sessionStorage.setItem(storageKey(normalized), JSON.stringify(joined.participant)); } catch { /* Navigation state keeps the current play session usable. */ }
      navigate(`/quiz/play/${normalized}`, { replace: true, state: { participant: joined.participant } });
    } catch (caught) { setError(liveQuizErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  return <main className="qz-live-public qz-live-public--join qz-enter"><PageHeader eyebrow="NALARO LIVE" title="Masuk ke arena" description="Masukkan kode dari host atau buka QR. Tidak perlu login dan tidak perlu bergabung ke kelas." />
    <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 20 }}><Card className="qz-live-join"><motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 2.8, repeat: Infinity }} className="qz-live-join__mark"><QuizIcon size={31} /></motion.div>{error ? <div className="qz-inline-state qz-inline-state--error" role="alert">{error}</div> : null}<AnimatePresence mode="wait" initial={false}>{!session ? <motion.form key="code" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} onSubmit={inspect}><div className="qz-live-join__intro"><span className="qz-eyebrow">LANGKAH 1</span><h2>Masukkan kode kuis</h2><p>Kode terdiri dari 6 karakter dan tidak peka huruf besar/kecil.</p></div><div className="qz-live-code-input"><Input label="Kode kuis" placeholder="AB2CDE" value={code} onChange={(event) => setCode(event.target.value.replace(/\s/g, '').toUpperCase())} inputMode="text" autoCapitalize="characters" maxLength={6} autoFocus /></div><Button block disabled={busy || code.trim().length !== 6} type="submit">{busy ? 'Mencari arena...' : 'Temukan kuis'}</Button></motion.form> : <motion.form key="name" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} onSubmit={join}><div className="qz-live-join__intro"><span className="qz-eyebrow">ARENA DITEMUKAN</span><h2>{session.title}</h2><div className="qz-live-join__meta"><span>{session.questionCount} soal</span><span>{session.participantCount} peserta</span></div></div><Input label="Nama pemain" placeholder="Contoh: Aulia" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="name" autoFocus /><Button block disabled={busy || name.trim().length < 2} type="submit">{busy ? 'Menghubungkan...' : 'Masuk arena →'}</Button><button type="button" className="qz-live-link" onClick={() => { setSession(null); setError(''); }}>← Gunakan kode lain</button></motion.form>}</AnimatePresence></Card></motion.div>
  </main>;
}
