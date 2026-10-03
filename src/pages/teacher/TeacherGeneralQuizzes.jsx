import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QuizIcon } from '../../components/icons';
import { Badge, Button, Card, ContentCard, ConfirmDialog, Dialog, EmptyState, PageHeader, Skeleton, buttonClassName } from '../../components/ui';
import { downloadGeneralLiveResult, getGeneralLiveResult, listGeneralLiveResults, liveQuizErrorMessage } from '../../services/live-quiz.service';
import { deleteGeneralQuiz, listGeneralQuizzes, quizErrorMessage } from '../../services/quiz.service';

function dateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function TeacherGeneralQuizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [liveSessions, setLiveSessions] = useState([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState('');
  const [liveDetail, setLiveDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setQuizzes(await listGeneralQuizzes()); }
    catch (caught) { setError(quizErrorMessage(caught)); }
    finally { setLoading(false); }
  }, []);

  const loadLive = useCallback(async () => {
    setLiveLoading(true); setLiveError('');
    try { setLiveSessions(await listGeneralLiveResults()); }
    catch (caught) { setLiveError(liveQuizErrorMessage(caught)); }
    finally { setLiveLoading(false); }
  }, []);

  useEffect(() => { load(); loadLive(); }, [load, loadLive]);

  const remove = async () => {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id); setError('');
    try {
      await deleteGeneralQuiz(pendingDelete.id);
      setQuizzes((current) => current.filter((item) => item.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (caught) { setError(quizErrorMessage(caught)); }
    finally { setBusyId(''); }
  };

  const openDetail = async (sessionId) => {
    setDetailLoading(true); setLiveError('');
    try { setLiveDetail(await getGeneralLiveResult(sessionId)); }
    catch (caught) { setLiveError(liveQuizErrorMessage(caught)); }
    finally { setDetailLoading(false); }
  };

  const exportResult = async (session) => {
    setLiveError('');
    try {
      const { blob } = await downloadGeneralLiveResult(session.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${session.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'nalaro-live'}-hasil.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) { setLiveError(liveQuizErrorMessage(caught)); }
  };

  return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Studio mandiri" title="Kuis umum" description="Kuis ini milik Anda. Sesi Nalaro Live yang selesai sekarang tetap tersimpan sebagai laporan." actions={<><Link className={buttonClassName({ variant: 'secondary' })} to="/teacher/quizzes">Kembali ke Kuis</Link><Link className={buttonClassName()} to="/teacher/general-quizzes/new">Buat kuis umum</Link></>} />
    {error ? <div className="qz-inline-state qz-inline-state--error">{error}</div> : null}
    {loading ? <div className="qz-quiz-grid"><Skeleton height={220} /><Skeleton height={220} /></div> : quizzes.length ? <div className="qz-quiz-grid">{quizzes.map((quiz) => <ContentCard key={quiz.id} icon={QuizIcon} title={quiz.title} description={quiz.description || 'Tambahkan soal dan siapkan kuis sebelum diterbitkan.'} badge={<Badge tone={quiz.status === 'published' ? 'success' : 'warning'}>{quiz.status === 'published' ? 'Terbit' : 'Draf'}</Badge>} meta={<span>{quiz.questionCount} soal</span>} actions={<><Link className={buttonClassName({ size: 'sm' })} to={`/teacher/general-quizzes/${quiz.id}/edit`}>Edit kuis</Link>{quiz.status === 'published' ? <><Link className={buttonClassName({ variant: 'secondary', size: 'sm' })} to={`/teacher/general-quizzes/${quiz.id}/live`}>Mulai live</Link><Link className={buttonClassName({ variant: 'ghost', size: 'sm' })} to={`/teacher/quiz-bank?source=general&quizId=${quiz.id}`}>Bagikan</Link></> : null}<Button variant="ghost" size="sm" disabled={busyId === quiz.id} onClick={() => setPendingDelete(quiz)}>Hapus</Button></>} />)}</div> : <Card><EmptyState icon={QuizIcon} title="Belum ada kuis umum" description="Mulai dari draf mandiri untuk menyiapkan soal sebelum memilih kelas atau membagikannya." action={<Link className={buttonClassName()} to="/teacher/general-quizzes/new">Buat kuis umum</Link>} /></Card>}

    <section className="qz-live-history">
      <div className="qz-live-history__head"><div><span className="qz-eyebrow">RIWAYAT LIVE UMUM</span><h2>Hasil sesi tersimpan</h2></div><Button variant="ghost" size="sm" disabled={liveLoading} onClick={loadLive}>{liveLoading ? 'Memuat…' : 'Muat ulang'}</Button></div>
      {liveError ? <div className="qz-inline-state qz-inline-state--error">{liveError}</div> : null}
      {liveLoading ? <Skeleton height={120} /> : liveSessions.length ? <div className="qz-live-history__list">{liveSessions.map((session) => <Card key={session.id} className="qz-live-history__item"><div><h3>{session.title}</h3><p>{dateTime(session.finishedAt)} · {session.participantCount} peserta · {session.questionCount} soal</p></div><div className="qz-live-history__actions"><Button variant="secondary" size="sm" onClick={() => openDetail(session.id)}>Lihat hasil</Button><Button variant="ghost" size="sm" onClick={() => exportResult(session)}>CSV</Button></div></Card>)}</div> : <Card><EmptyState icon={QuizIcon} title="Belum ada riwayat Live" description="Sesi umum yang selesai akan tersimpan di sini." /></Card>}
    </section>

    <Dialog open={Boolean(liveDetail) || detailLoading} onClose={() => setLiveDetail(null)} title={liveDetail ? `Hasil Live · ${liveDetail.title}` : 'Memuat hasil Live'} description={liveDetail ? `${dateTime(liveDetail.finishedAt)} · ${liveDetail.participantCount} peserta` : 'Mengambil hasil permanen dari D1.'}>
      {detailLoading ? <Skeleton height={240} /> : liveDetail ? <div className="qz-live-report"><div className="qz-live-report__ranking"><h3>Peringkat akhir</h3>{liveDetail.participants?.map((participant) => <div key={participant.participantId}><b>#{participant.rank}</b><span>{participant.name}</span><strong>{participant.score} poin</strong></div>)}</div></div> : null}
    </Dialog>
    <ConfirmDialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} onConfirm={remove} busy={Boolean(busyId)} title="Hapus draf kuis?" description={pendingDelete ? `Draf "${pendingDelete.title}" akan dihapus.` : ''} confirmLabel="Hapus draf" />
  </div>;
}
