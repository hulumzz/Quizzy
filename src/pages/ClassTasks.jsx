import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClipboardList, Plus } from 'lucide-react';
import ClassWorkspaceNav from '../components/classroom/ClassWorkspaceNav';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, buttonClassName } from '../components/ui';
import { getClass } from '../services/class.service';
import { listTasks, taskErrorMessage } from '../services/task.service';
import { appEnv } from '../config/env';

function formatDate(value) { return value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Belum ditentukan'; }
function submissionLabel(submission) {
  if (!submission) return null;
  if (submission.status === 'graded') return <Badge tone="success">Dinilai · {submission.score}/100</Badge>;
  if (submission.status === 'returned') return <Badge tone="warning">Perlu revisi</Badge>;
  return <Badge tone={submission.late ? 'danger' : 'success'}>{submission.late ? 'Terlambat' : 'Terkumpul'}</Badge>;
}

export default function ClassTasks({ role }) {
  const { classId } = useParams(); const configured = Boolean(appEnv.apiUrl);
  const [state, setState] = useState({ status: configured ? 'loading' : 'unconfigured', tasks: [], error: null }); const [className, setClassName] = useState('Ruang kelas');
  const load = useCallback(async (signal) => { try { const tasks = await listTasks(classId, { signal }); setState({ status: 'success', tasks, error: null }); } catch (error) { if (error.name !== 'AbortError') setState({ status: 'error', tasks: [], error }); } }, [classId]);
  useEffect(() => { if (!configured) return undefined; const controller = new AbortController(); load(controller.signal); getClass(classId, { signal: controller.signal }).then((item) => setClassName(item.name)).catch(() => {}); return () => controller.abort(); }, [classId, configured, load]);
  return <div className="qz-dashboard qz-enter"><PageHeader eyebrow={`${role === 'teacher' ? 'Ruang guru' : 'Ruang siswa'} · ${className}`} title="Tugas kelas" description={role === 'teacher' ? 'Bagikan tugas, tentukan tenggat, lalu nilai pengumpulan siswa.' : 'Lihat tugas kelas, kirim jawaban, dan pantau nilai atau revisi.'} actions={role === 'teacher' ? <Link className={buttonClassName()} to={`/teacher/classes/${classId}/tasks/new`}><Plus size={18} /> Buat tugas</Link> : null} /><ClassWorkspaceNav role={role} classId={classId} />
    {!configured ? <div className="qz-status-strip">Layanan tugas belum tersedia di lingkungan ini.</div> : null}
    {state.status === 'loading' ? <div className="qz-task-list"><Skeleton height={150} /><Skeleton height={150} /></div> : null}
    {state.status === 'error' ? <div className="qz-inline-state qz-inline-state--error" role="alert">{taskErrorMessage(state.error)} <Button variant="ghost" size="sm" onClick={() => load()}>Coba lagi</Button></div> : null}
    {state.status === 'success' && state.tasks.length ? <div className="qz-task-list">{state.tasks.map((task) => <Card key={task.id} className="qz-task-card"><div><div className="qz-task-card__meta"><Badge tone={task.status === 'published' ? 'success' : 'warning'}>{task.status === 'published' ? 'Terbit' : task.status === 'draft' ? 'Draf' : 'Diarsipkan'}</Badge>{role === 'student' ? submissionLabel(task.submission) : null}</div><h2>{task.title}</h2><p>{task.instructions || 'Tidak ada petunjuk tambahan.'}</p><small>Tenggat: <strong>{formatDate(task.dueAt)}</strong> · Jawaban {task.responseMode === 'both' ? 'teks dan lampiran' : task.responseMode === 'text' ? 'teks' : 'lampiran'}</small></div><Link className={buttonClassName({ variant: 'secondary', size: 'sm' })} to={`/${role}/classes/${classId}/tasks/${task.id}`}>Buka tugas</Link></Card>)}</div> : null}
    {state.status === 'success' && !state.tasks.length ? <Card><EmptyState icon={ClipboardList} title={role === 'teacher' ? 'Belum ada tugas' : 'Belum ada tugas terbit'} description={role === 'teacher' ? 'Buat tugas pertama untuk menerima jawaban teks atau lampiran siswa.' : 'Tugas yang diterbitkan guru akan muncul di sini.'} action={role === 'teacher' ? <Link className={buttonClassName()} to={`/teacher/classes/${classId}/tasks/new`}><Plus size={18} /> Buat tugas</Link> : null} /></Card> : null}
  </div>;
}
