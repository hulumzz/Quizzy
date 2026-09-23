import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MaterialIcon } from '../../components/icons';
import { Button, Card, EmptyState, Input, PageHeader, Skeleton, Textarea, buttonClassName } from '../../components/ui';
import BlockEditor from '../../features/materials/components/BlockEditor';
import { createMaterial, getMaterial, materialErrorMessage, updateMaterial } from '../../services/material.service';

const initial = { title: '', summary: '', blocks: [] };

export default function MaterialEditor() {
  const { classId, materialId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(materialId);
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState(editing ? 'loading' : 'ready');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    if (!editing) return undefined;
    const controller = new AbortController();
    getMaterial(classId, materialId, { signal: controller.signal })
      .then((material) => { setForm({ title: material.title, summary: material.summary, blocks: material.blocks }); setStatus('ready'); })
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
      const payload = { title, summary: form.summary.trim(), blocks: form.blocks, status: publishStatus };
      const material = editing ? await updateMaterial(classId, materialId, payload) : await createMaterial(classId, payload);
      navigate(`/teacher/classes/${classId}/materials/${material.id}`, { replace: true });
    } catch (caught) {
      setFieldErrors(caught.details || {});
      setError(caught);
    } finally {
      setSaving('');
    }
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
