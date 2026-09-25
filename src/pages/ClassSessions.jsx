import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, FileText, Plus, Archive, Pencil, Radio } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import ClassWorkspaceNav from '../components/classroom/ClassWorkspaceNav';
import { QuizIcon } from '../components/icons';
import { Badge, Button, Card, Dialog, EmptyState, Input, PageHeader, Skeleton, Textarea, buttonClassName } from '../components/ui';
import { listAttendance } from '../services/attendance.service';
import { getClass } from '../services/class.service';
import { listMaterials } from '../services/material.service';
import { listQuizzes } from '../services/quiz.service';
import {
  createLearningSession,
  learningSessionErrorMessage,
  listLearningSessions,
  reorderLearningSessions,
  updateLearningSession,
} from '../services/learning-session.service';

function localDateValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const emptyForm = () => ({
  title: '',
  description: '',
  meetingDate: localDateValue(),
  status: 'draft',
});

function sessionTone(status) {
  if (status === 'published') return 'success';
  if (status === 'archived') return 'neutral';
  return 'warning';
}

function sessionLabel(status) {
  if (status === 'published') return 'Diterbitkan';
  if (status === 'archived') return 'Diarsipkan';
  return 'Draf';
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(date);
}

function groupBySession(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.sessionId || '__unassigned__';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function SessionContent({ role, classId, sessionId, materialMap, quizMap, attendanceMap }) {
  const materials = materialMap.get(sessionId) || [];
  const quizzes = quizMap.get(sessionId) || [];
  const attendance = attendanceMap.get(sessionId) || [];
  const count = materials.length + quizzes.length + attendance.length;

  if (!count) return <p className="qz-session-empty">Belum ada materi, kuis, atau presensi yang ditautkan ke pertemuan ini.</p>;

  return <div className="qz-session-content">
    {materials.map((item) => <Link key={`material-${item.id}`} to={`/${role}/classes/${classId}/materials/${item.id}`} className="qz-session-resource"><FileText size={17} /><span><b>{item.title}</b><small>Materi · {item.status === 'published' ? 'Diterbitkan' : 'Draf'}</small></span></Link>)}
    {quizzes.map((item) => <Link key={`quiz-${item.id}`} to={role === 'teacher' ? `/teacher/classes/${classId}/quizzes/${item.id}/edit` : `/student/classes/${classId}/quizzes/${item.id}`} className="qz-session-resource"><QuizIcon size={17} /><span><b>{item.title}</b><small>Kuis · {item.questionCount} soal</small></span></Link>)}
    {attendance.map((item) => <Link key={`attendance-${item.id}`} to={`/${role}/classes/${classId}/attendance`} className="qz-session-resource"><Radio size={17} /><span><b>{item.title}</b><small>Presensi · {item.status === 'active' ? 'Aktif' : item.status === 'ended' ? 'Selesai' : 'Draf'}</small></span></Link>)}
  </div>;
}

export default function ClassSessions({ role }) {
  const { classId } = useParams();
  const [className, setClassName] = useState('Ruang kelas');
  const [state, setState] = useState({ loading: true, sessions: [], materials: [], quizzes: [], attendance: [], error: null });
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async ({ signal } = {}) => {
    try {
      const [classItem, sessions, materials, quizzes, attendance] = await Promise.all([
        getClass(classId, { signal }),
        listLearningSessions(classId, { signal }),
        listMaterials(classId, { signal }),
        listQuizzes(classId, { signal }),
        listAttendance(classId, { signal }),
      ]);
      setClassName(classItem.name || 'Ruang kelas');
      setState({ loading: false, sessions, materials, quizzes, attendance, error: null });
    } catch (error) {
      if (error?.name !== 'AbortError') setState((current) => ({ ...current, loading: false, error }));
    }
  }, [classId]);

  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal });
    return () => controller.abort();
  }, [load]);

  const materialMap = useMemo(() => groupBySession(state.materials), [state.materials]);
  const quizMap = useMemo(() => groupBySession(state.quizzes), [state.quizzes]);
  const attendanceMap = useMemo(() => groupBySession(state.attendance), [state.attendance]);
  const unassignedCount = (materialMap.get('__unassigned__')?.length || 0) + (quizMap.get('__unassigned__')?.length || 0) + (attendanceMap.get('__unassigned__')?.length || 0);

  const openCreate = () => { setForm(emptyForm()); setDialog({ mode: 'create' }); setActionError(''); };
  const openEdit = (session) => {
    setForm({ title: session.title, description: session.description || '', meetingDate: session.meetingDate, status: session.status });
    setDialog({ mode: 'edit', session });
    setActionError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setActionError('');
    try {
      if (dialog.mode === 'edit') await updateLearningSession(classId, dialog.session.id, form);
      else await createLearningSession(classId, form);
      setDialog(null);
      await load();
    } catch (error) {
      setActionError(learningSessionErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (session, status) => {
    setSaving(true);
    setActionError('');
    try {
      await updateLearningSession(classId, session.id, {
        title: session.title,
        description: session.description || '',
        meetingDate: session.meetingDate,
        status,
      });
      await load();
    } catch (error) {
      setActionError(learningSessionErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const move = async (index, offset) => {
    const target = index + offset;
    if (target < 0 || target >= state.sessions.length) return;
    const next = [...state.sessions];
    [next[index], next[target]] = [next[target], next[index]];
    setState((current) => ({ ...current, sessions: next }));
    setActionError('');
    try {
      const sessions = await reorderLearningSessions(classId, next.map((item) => item.id));
      setState((current) => ({ ...current, sessions }));
    } catch (error) {
      setActionError(learningSessionErrorMessage(error));
      await load();
    }
  };

  return <div className="qz-dashboard qz-enter">
    <PageHeader
      eyebrow={`${role === 'teacher' ? 'Ruang guru' : 'Ruang siswa'} · ${className}`}
      title="Pertemuan pembelajaran"
      description={role === 'teacher' ? 'Susun alur kelas per pertemuan, lalu hubungkan materi, kuis, dan presensi tanpa memutus konten lama.' : 'Ikuti alur pertemuan yang telah diterbitkan guru dan buka aktivitas belajar dari satu tempat.'}
      actions={role === 'teacher' ? <Button onClick={openCreate}><Plus size={17} /> Pertemuan baru</Button> : null}
    />
    <ClassWorkspaceNav role={role} classId={classId} />

    {actionError ? <div className="qz-inline-state qz-inline-state--error" role="alert">{actionError}</div> : null}
    {state.error ? <div className="qz-inline-state qz-inline-state--error" role="alert">{learningSessionErrorMessage(state.error)} <Button size="sm" variant="ghost" onClick={() => load()}>Coba lagi</Button></div> : null}
    {state.loading ? <div className="qz-session-list"><Skeleton height={210} /><Skeleton height={210} /></div> : null}

    {!state.loading && !state.error && state.sessions.length ? <div className="qz-session-list">
      {state.sessions.map((session, index) => <Card key={session.id} className={`qz-session-card qz-session-card--${session.status}`}>
        <div className="qz-session-card__head">
          <div className="qz-session-card__date"><CalendarDays size={20} /><span>{formatDate(session.meetingDate)}</span></div>
          <Badge tone={sessionTone(session.status)}>{sessionLabel(session.status)}</Badge>
        </div>
        <div className="qz-session-card__body"><span className="qz-eyebrow">PERTEMUAN {index + 1}</span><h2>{session.title}</h2>{session.description ? <p>{session.description}</p> : null}</div>
        <SessionContent role={role} classId={classId} sessionId={session.id} materialMap={materialMap} quizMap={quizMap} attendanceMap={attendanceMap} />
        {role === 'teacher' ? <div className="qz-session-card__actions">
          <Button size="sm" variant="secondary" onClick={() => openEdit(session)}><Pencil size={15} /> Edit</Button>
          <Button size="sm" variant="ghost" disabled={index === 0 || saving} onClick={() => move(index, -1)}><ChevronUp size={15} /> Naik</Button>
          <Button size="sm" variant="ghost" disabled={index === state.sessions.length - 1 || saving} onClick={() => move(index, 1)}><ChevronDown size={15} /> Turun</Button>
          {session.status === 'published' ? <Button size="sm" variant="secondary" disabled={saving} onClick={() => updateStatus(session, 'draft')}>Jadikan draf</Button> : session.status !== 'archived' ? <Button size="sm" disabled={saving} onClick={() => updateStatus(session, 'published')}>Terbitkan</Button> : null}
          {session.status !== 'archived' ? <Button size="sm" variant="ghost" disabled={saving} onClick={() => updateStatus(session, 'archived')}><Archive size={15} /> Arsipkan</Button> : <Button size="sm" variant="secondary" disabled={saving} onClick={() => updateStatus(session, 'draft')}>Pulihkan</Button>}
          {session.status !== 'archived' ? <><Link to={`/teacher/classes/${classId}/materials/new?sessionId=${session.id}`} className={buttonClassName({ variant: 'ghost', size: 'sm' })}>+ Materi</Link><Link to={`/teacher/classes/${classId}/quizzes/new?sessionId=${session.id}`} className={buttonClassName({ variant: 'ghost', size: 'sm' })}>+ Kuis</Link></> : null}
        </div> : null}
      </Card>)}
    </div> : null}

    {!state.loading && !state.error && !state.sessions.length ? <Card><EmptyState icon={CalendarDays} title={role === 'teacher' ? 'Belum ada pertemuan' : 'Belum ada pertemuan yang diterbitkan'} description={role === 'teacher' ? 'Buat pertemuan pertama untuk menyusun alur materi, kuis, dan presensi kelas.' : 'Pertemuan yang diterbitkan guru akan muncul di halaman ini.'} action={role === 'teacher' ? <Button onClick={openCreate}><Plus size={17} /> Buat pertemuan</Button> : null} /></Card> : null}

    {!state.loading && unassignedCount > 0 ? <Card className="qz-session-legacy">
      <div><span className="qz-eyebrow">KONTEN LAMA</span><h2>Tanpa pertemuan</h2><p>Konten yang sudah ada sebelum fitur pertemuan tetap aman dan dapat diakses seperti sebelumnya.</p></div>
      <SessionContent role={role} classId={classId} sessionId="__unassigned__" materialMap={materialMap} quizMap={quizMap} attendanceMap={attendanceMap} />
    </Card> : null}

    <Dialog className="qz-dialog--session" open={Boolean(dialog)} onClose={() => !saving && setDialog(null)} title={dialog?.mode === 'edit' ? 'Edit pertemuan' : 'Pertemuan baru'} description="Tanggal dan status membantu siswa mengikuti urutan belajar yang jelas." footer={<><Button variant="secondary" disabled={saving} onClick={() => setDialog(null)}>Batal</Button><Button form="learning-session-form" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button></>}>
      <form id="learning-session-form" className="qz-session-form" onSubmit={submit}>
        <Input label="Judul pertemuan" required maxLength={120} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Contoh: Pertemuan 3 · Sistem Pencernaan" />
        <Textarea label="Deskripsi" maxLength={600} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Tujuan atau gambaran singkat aktivitas pertemuan." />
        <Input label="Tanggal pertemuan" type="date" required value={form.meetingDate} onChange={(event) => setForm((current) => ({ ...current, meetingDate: event.target.value }))} />
        <label className="qz-field"><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="draft">Draf</option><option value="published">Diterbitkan</option>{dialog?.mode === 'edit' ? <option value="archived">Diarsipkan</option> : null}</select></label>
        {actionError ? <div className="qz-inline-state qz-inline-state--error" role="alert">{actionError}</div> : null}
      </form>
    </Dialog>
  </div>;
}
