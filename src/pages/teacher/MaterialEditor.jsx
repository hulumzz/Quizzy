import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MaterialIcon } from '../../components/icons';
import { Button, Card, EmptyState, Input, PageHeader, Skeleton, Textarea, buttonClassName } from '../../components/ui';
import BlockEditor from '../../features/materials/components/BlockEditor';
import { createMaterial, getMaterial, materialErrorMessage, updateMaterial } from '../../services/material.service';
import { askQuizzyAi } from '../../services/ai.service';
import { listLearningSessions } from '../../services/learning-session.service';

const initial = { title: '', summary: '', blocks: [], sessionId: '' };

export default function MaterialEditor() {
  const { classId, materialId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editing = Boolean(materialId);
  const requestedSessionId = searchParams.get('sessionId') || '';
  const [form, setForm] = useState(() => ({ ...initial, sessionId: requestedSessionId }));
  const [sessions, setSessions] = useState([]);
  const [status, setStatus] = useState(editing ? 'loading' : 'ready');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listLearningSessions(classId, { signal: controller.signal }).then((items) => setSessions(items.filter((item) => item.status !== 'archived'))).catch(() => {});
    return () => controller.abort();
  }, [classId]);

  useEffect(() => {
    if (!editing) return undefined;
    const controller = new AbortController();
    getMaterial(classId, materialId, { signal: controller.signal })
      .then((material) => { setForm({ title: material.title, summary: material.summary, blocks: material.blocks, sessionId: material.sessionId || '' }); setStatus('ready'); })
      .catch((caught) => { if (caught.name !== 'AbortError') { setError(caught); setStatus('error'); } });
    return () => controller.abort();
  }, [classId, editing, materialId]);

  const save = async (publishStatus) => {
    const errors = {};
    const title = form.title.trim().replace(/\s+/g, ' ');
    if (title.length < 3 || title.length > 120) errors.title = 'Judul materi harus terdiri dari 3–120 karakter.';
    if (form.summary.trim().length > 400) errors.summary = 'Ringkasan maksimal 400 karakter.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(publishStatus);
    setError(null);
    try {
      const payload = { title, summary: form.summary.trim(), blocks: form.blocks, status: publishStatus, sessionId: form.sessionId || null };
      const material = editing ? await updateMaterial(classId, materialId, payload) : await createMaterial(classId, payload);
      navigate(`/teacher/classes/${classId}/materials/${material.id}`, { replace: true });
    } catch (caught) {
      setFieldErrors(caught.details || {});
      setError(caught);
    } finally {
      setSaving('');
    }
  };

  const generateByAi = async () => {
    if (form.title.trim().length < 3) return setError(new Error('Isi judul materi terlebih dahulu agar AI memahami konteks.'));
    setAiBusy(true); setError(null);
    try {
      const response = await askQuizzyAi({ task: 'material_draft', context: `Kelas: ${classId}\nJudul materi: ${form.title.trim()}\nRingkasan guru: ${form.summary.trim().slice(0, 400) || '-'}`, instruction: 'Buat draf yang siap diedit guru dan sesuai tingkat pembelajar.' });
      const draft = JSON.parse(response.content); const allowed = new Set(['heading', 'paragraph', 'bullet_list']);
      const blocks = Array.isArray(draft.blocks) ? draft.blocks.slice(0, 7).filter((block) => allowed.has(block?.type)).map((block) => ({ id: crypto.randomUUID(), type: block.type, ...(block.type === 'bullet_list' ? { items: Array.isArray(block.items) ? block.items.map(String).filter(Boolean).slice(0, 8) : [] } : { content: String(block.content || '').slice(0, 5000), ...(block.type === 'heading' ? { level: 2 } : {}) }) })) : [];
      if (!blocks.length) throw new Error('Draf AI belum memiliki blok materi yang dapat digunakan.');
      setForm((current) => ({ ...current, summary: String(draft.summary || current.summary).slice(0, 400), blocks: [...current.blocks, ...blocks] }));
    } catch (caught) { setError(caught); } finally { setAiBusy(false); }
  };

  if (status === 'loading') return <div className="qz-dashboard"><Skeleton width="45%" height={38} /><Skeleton height={520} /></div>;
  if (status === 'error') return <Card className="qz-placeholder"><EmptyState icon={MaterialIcon} title="Editor tidak dapat dibuka" description={materialErrorMessage(error)} action={<Link to={`/teacher/classes/${classId}/materials`} className={buttonClassName()}>Kembali ke materi</Link>} /></Card>;

  return (
    <div className="qz-dashboard qz-enter">
      <PageHeader eyebrow="Workspace materi" title={editing ? 'Edit materi' : 'Materi baru'} description="Susun penjelasan dalam blok dan unggah gambar atau dokumen langsung ke Cloudinary." actions={<Link to={`/teacher/classes/${classId}/materials`} className={buttonClassName({ variant: 'secondary' })}>Batal</Link>} />
      <div className="qz-editor-layout">
        <main className="qz-editor-canvas">
          <Input label="Judul materi" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Contoh: Memahami sistem tata surya" maxLength={120} error={fieldErrors.title} autoFocus={!editing} />
          <Textarea label="Ringkasan" value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Jelaskan secara singkat apa yang akan dipelajari siswa." maxLength={400} error={fieldErrors.summary} hint={`${form.summary.length}/400 karakter`} />
          <label className="qz-field"><span>Pertemuan (opsional)</span><select value={form.sessionId} onChange={(event) => setForm((current) => ({ ...current, sessionId: event.target.value }))}><option value="">Tanpa pertemuan</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.meetingDate} · {session.title}{session.status === 'draft' ? ' (Draf)' : ''}</option>)}</select></label>
          <Button variant="secondary" disabled={aiBusy || saving || form.title.trim().length < 3} onClick={generateByAi}>{aiBusy ? 'AI menyusun materi...' : '✦ Buat draf materi dengan AI'}</Button>
          <BlockEditor classId={classId} blocks={form.blocks} onChange={(blocks) => setForm((current) => ({ ...current, blocks }))} errors={fieldErrors} />
        </main>
        <aside className="qz-editor-publish">
          <span className="qz-eyebrow">PUBLIKASI</span><h2>Siap dibagikan?</h2><p>Simpan draf untuk melanjutkan nanti, atau terbitkan agar langsung terlihat oleh siswa.</p>
          <Button block disabled={Boolean(saving)} onClick={() => save('published')}>{saving === 'published' ? 'Menerbitkan...' : 'Terbitkan materi'}</Button>
          <Button block variant="secondary" disabled={Boolean(saving)} onClick={() => save('draft')}>{saving === 'draft' ? 'Menyimpan...' : 'Simpan sebagai draf'}</Button>
          {error ? <div className="qz-inline-state qz-inline-state--error" role="alert">{materialErrorMessage(error)}</div> : null}
        </aside>
      </div>
    </div>
  );
}
