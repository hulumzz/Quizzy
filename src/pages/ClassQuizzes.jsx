import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassWorkspaceNav from '../components/classroom/ClassWorkspaceNav';
import { AddIcon, QuizIcon } from '../components/icons';
import { Button, Card, ConfirmDialog, Dialog, EmptyState, PageHeader, Skeleton, buttonClassName } from '../components/ui';
import { getClass } from '../services/class.service';
import { downloadClassLiveResult, getClassLiveResult, listClassLiveResults, liveQuizErrorMessage } from '../services/live-quiz.service';
import { deleteQuiz, exportQuiz, listQuizzes, quizErrorMessage } from '../services/quiz.service';

function dateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function ClassQuizzes({ role }) {
  const { classId } = useParams();
  const [state, setState] = useState({ loading: true, quizzes: [], error: null });
  const [className, setClassName] = useState('Ruang kelas');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [liveSessions, setLiveSessions] = useState([]);
  const [liveLoading, setLiveLoading] = useState(role === 'teacher');
  const [liveError, setLiveError] = useState('');
  const [liveDetail, setLiveDetail] = useState(null);
  const [liveDetailLoading, setLiveDetailLoading] = useState(false);

  const load = () => listQuizzes(classId).then((quizzes) => setState({ loading: false, quizzes, error: null })).catch((error) => setState({ loading: false, quizzes: [], error }));
  const loadLive = () => {
    if (role !== 'teacher') return Promise.resolve();
    setLiveLoading(true); setLiveError('');
    return listClassLiveResults(classId)
      .then(setLiveSessions)
      .catch((error) => setLiveError(liveQuizErrorMessage(error)))
      .finally(() => setLiveLoading(false));
  };

  useEffect(() => {
    const controller = new AbortController();
    getClass(classId, { signal: controller.signal }).then((item) => setClassName(item.name)).catch(() => {});
    listQuizzes(classId, { signal: controller.signal }).then((quizzes) => setState({ loading: false, quizzes, error: null })).catch((error) => { if (error.name !== 'AbortError') setState({ loading: false, quizzes: [], error }); });
    if (role === 'teacher') listClassLiveResults(classId, { signal: controller.signal }).then(setLiveSessions).catch((error) => { if (error.name !== 'AbortError') setLiveError(liveQuizErrorMessage(error)); }).finally(() => setLiveLoading(false));
    return () => controller.abort();
  }, [classId, role]);

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try { await deleteQuiz(classId, pendingDelete.id); setPendingDelete(null); load(); }
    catch (error) { setState((current) => ({ ...current, error })); }
    finally { setDeleting(false); }
  };

  const download = async (quiz) => {
    try {
      const payload = await exportQuiz(classId, quiz.id);
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${quiz.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'kuis'}-quizzy.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { setState((current) => ({ ...current, error })); }
  };

  const openLiveDetail = async (sessionId) => {
    setLiveDetailLoading(true); setLiveError('');
    try { setLiveDetail(await getClassLiveResult(classId, sessionId)); }
    catch (error) { setLiveError(liveQuizErrorMessage(error)); }
    finally { setLiveDetailLoading(false); }
  };

  const exportLive = async (session) => {
    setLiveError('');
    try {
      const { blob } = await downloadClassLiveResult(classId, session.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${session.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'nalaro-live'}-hasil.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { setLiveError(liveQuizErrorMessage(error)); }
  };

  return <div className="qz-dashboard qz-enter">
    <PageHeader eyebrow={`${role === 'teacher' ? 'Ruang guru' : 'Ruang siswa'} · ${className}`} title="Kuis kelas" description={role === 'teacher' ? 'Susun evaluasi mandiri, jalankan Nalaro Live, lalu buka kembali hasil yang sudah tersimpan permanen.' : 'Kerjakan kuis yang telah diterbitkan oleh guru.'} actions={role === 'teacher' ? <Link className={buttonClassName()} to={`/teacher/classes/${classId}/quizzes/new`}><AddIcon size={18} /> Buat kuis</Link> : null} />
    <ClassWorkspaceNav role={role} classId={classId} />
    {state.error ? <div className="qz-inline-state qz-inline-state--error">{quizErrorMessage(state.error)} <Button variant="ghost" size="sm" onClick={load}>Coba lagi</Button></div> : null}
    {state.loading ? <div className="qz-quiz-grid"><Skeleton height={190} /><Skeleton height={190} /></div> : state.quizzes.length ? <div className="qz-quiz-grid">{state.quizzes.map((quiz) => <Card key={quiz.id} className="qz-quiz-card">
      <div className="qz-quiz-card__top"><span className={`qz-quiz-status qz-quiz-status--${role === 'student' && quiz.attempt ? 'complete' : quiz.status}`}>{role === 'student' && quiz.attempt ? 'Selesai' : quiz.status === 'published' ? 'Diterbitkan' : 'Draf'}</span><QuizIcon size={22} /></div>
      <h3>{quiz.title}</h3><p>{quiz.description || 'Tanpa deskripsi.'}</p><div className="qz-quiz-meta"><span>{quiz.questionCount} soal</span><span>{quiz.totalPoints} poin</span><span>Lulus {quiz.settings?.passingScore ?? 70}</span>{role === 'student' && quiz.attempt ? <span className="qz-quiz-meta__score">Nilai {quiz.attempt.score}</span> : null}</div>
      <div className="qz-quiz-actions">{role === 'teacher' ? <>{quiz.status === 'published' ? <><Link className={buttonClassName({ size: 'sm' })} to={`/teacher/classes/${classId}/quizzes/${quiz.id}/live`}>Mulai live</Link><Link className={buttonClassName({ variant: 'ghost', size: 'sm' })} to={`/teacher/quiz-bank?classId=${classId}&quizId=${quiz.id}`}>Bagikan</Link></> : null}<Link className={buttonClassName({ variant: 'secondary', size: 'sm' })} to={`/teacher/classes/${classId}/quizzes/${quiz.id}/edit`}>Edit</Link><Link className={buttonClassName({ variant: 'ghost', size: 'sm' })} to={`/teacher/classes/${classId}/quizzes/${quiz.id}/results`}>Hasil</Link><Button variant="ghost" size="sm" onClick={() => download(quiz)}>Unduh</Button><Button variant="ghost" size="sm" onClick={() => setPendingDelete(quiz)}>Hapus</Button></> : <Link className={buttonClassName({ size: 'sm', variant: quiz.attempt ? 'secondary' : 'primary' })} to={`/student/classes/${classId}/quizzes/${quiz.id}`}>{quiz.attempt ? 'Lihat hasil' : 'Kerjakan sekarang'}</Link>}</div>
    </Card>)}</div> : <Card><EmptyState icon={QuizIcon} title={role === 'teacher' ? 'Buat kuis pertama' : 'Belum ada kuis'} description={role === 'teacher' ? 'Mulai dari draf, tambahkan soal, lalu terbitkan saat siap.' : 'Kuis yang diterbitkan guru akan muncul di sini.'} /></Card>}

    {role === 'teacher' ? <section className="qz-live-history">
      <div className="qz-live-history__head"><div><span className="qz-eyebrow">RIWAYAT NALARO LIVE</span><h2>Hasil sesi tersimpan</h2></div><Button variant="ghost" size="sm" disabled={liveLoading} onClick={loadLive}>{liveLoading ? 'Memuat…' : 'Muat ulang'}</Button></div>
      {liveError ? <div className="qz-inline-state qz-inline-state--error">{liveError}</div> : null}
      {liveLoading ? <><Skeleton height={110} /><Skeleton height={110} /></> : liveSessions.length ? <div className="qz-live-history__list">{liveSessions.map((session) => <Card key={session.id} className="qz-live-history__item"><div><h3>{session.title}</h3><p>{dateTime(session.finishedAt)} · {session.participantCount} peserta · {session.questionCount} soal</p></div><div className="qz-live-history__actions"><Button variant="secondary" size="sm" onClick={() => openLiveDetail(session.id)}>Lihat laporan</Button><Button variant="ghost" size="sm" onClick={() => exportLive(session)}>CSV</Button></div></Card>)}</div> : <Card><EmptyState icon={QuizIcon} title="Belum ada hasil Live tersimpan" description="Sesi yang selesai akan muncul di sini setelah hasil berhasil diamankan ke D1." /></Card>}
    </section> : null}

    <Dialog open={Boolean(liveDetail) || liveDetailLoading} onClose={() => setLiveDetail(null)} title={liveDetail ? `Laporan Live · ${liveDetail.title}` : 'Memuat laporan Live'} description={liveDetail ? `${dateTime(liveDetail.finishedAt)} · ${liveDetail.participantCount} peserta` : 'Mengambil hasil permanen dari D1.'}>
      {liveDetailLoading ? <Skeleton height={280} /> : liveDetail ? <div className="qz-live-report"><div className="qz-live-report__summary"><strong>{liveDetail.participantCount}</strong><span>peserta</span><strong>{liveDetail.questionCount}</strong><span>soal</span></div>{liveDetail.questions?.length ? <div className="qz-live-report__questions"><h3>Akurasi per soal</h3>{liveDetail.questions.map((question, index) => <div key={question.id}><span>{index + 1}. {question.prompt}</span><strong>{question.accuracy === null ? '—' : `${question.accuracy}%`}</strong></div>)}</div> : null}<div className="qz-live-report__ranking"><h3>Peringkat akhir</h3>{liveDetail.participants?.map((participant) => <div key={participant.participantId}><b>#{participant.rank}</b><span>{participant.name}{participant.studentId ? ' · siswa terhubung' : ''}</span><strong>{participant.score} poin</strong></div>)}</div></div> : null}
    </Dialog>
    <ConfirmDialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} onConfirm={remove} busy={deleting} title="Hapus kuis?" description={pendingDelete ? `Kuis "${pendingDelete.title}" beserta hasilnya akan dihapus.` : ''} confirmLabel="Hapus kuis" />
  </div>;
}
