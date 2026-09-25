import { useCallback, useState } from 'react';
import { AddIcon, ErrorIcon } from '../../components/icons';
import { Button, Dialog, Input, PageHeader, ProcessLoader, Textarea, Toast } from '../../components/ui';
import ClassCollection from '../../features/classes/components/ClassCollection';
import { useClasses } from '../../features/classes/hooks/useClasses';
import { classErrorMessage } from '../../services/class.service';

const initialForm = { name: '', description: '' };

export default function TeacherClasses() {
  const { classes, status, error, configured, reload, createClass } = useClasses();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState(null);

  const closeDialog = useCallback(() => {
    if (submitting) return;
    setDialogOpen(false);
    setFieldErrors({});
    setSubmitError('');
  }, [submitting]);

  const openDialog = () => {
    setForm(initialForm);
    setFieldErrors({});
    setSubmitError('');
    setDialogOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = form.name.trim().replace(/\s+/g, ' ');
    const errors = {};
    if (name.length < 3) errors.name = 'Nama kelas minimal 3 karakter.';
    if (name.length > 80) errors.name = 'Nama kelas maksimal 80 karakter.';
    if (form.description.trim().length > 400) errors.description = 'Deskripsi maksimal 400 karakter.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const created = await createClass({ name, description: form.description.trim() });
      setDialogOpen(false);
      setForm(initialForm);
      setNotice({ title: 'Kelas berhasil dibuat', message: `${created.name} siap digunakan.` });
    } catch (caught) {
      setFieldErrors(caught.details || {});
      setSubmitError(classErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="qz-dashboard qz-enter">
      <PageHeader
        eyebrow="Ruang guru"
        title="Kelas"
        description="Buat dan kelola ruang belajar untuk setiap kelompok siswa."
        actions={<Button onClick={openDialog} disabled={!configured}><AddIcon size={18} /> Buat kelas</Button>}
      />

      {!configured ? <div className="qz-status-strip"><ErrorIcon size={19} /> Layanan kelas belum tersedia. Hubungi pengelola Nalaro Class.</div> : null}
      {status === 'error' ? <div className="qz-inline-state qz-inline-state--error" role="alert">{classErrorMessage(error)} <Button variant="ghost" size="sm" onClick={reload}>Coba lagi</Button></div> : null}

      <ClassCollection classes={classes} status={status} configured={configured} role="teacher" onCreate={openDialog} />

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title="Buat kelas baru"
        description="Kode kelas dibuat otomatis setelah kelas tersimpan."
        footer={<><Button variant="secondary" onClick={closeDialog} disabled={submitting}>Batal</Button><Button type="submit" form="create-class-form" disabled={submitting}>{submitting ? <><ProcessLoader size={16} label="Membuat kelas" /> Menyimpan...</> : 'Buat kelas'}</Button></>}
      >
        <form id="create-class-form" onSubmit={handleSubmit} className="qz-form-stack">
          <Input label="Nama kelas" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contoh: Matematika XI A" maxLength={80} error={fieldErrors.name} autoFocus />
          <Textarea label="Deskripsi" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Jelaskan fokus pembelajaran kelas ini." maxLength={400} error={fieldErrors.description} hint={`${form.description.length}/400 karakter`} />
          {submitError ? <div className="qz-inline-state qz-inline-state--error" role="alert">{submitError}</div> : null}
        </form>
      </Dialog>

      {notice ? <div className="qz-toast-stack"><Toast title={notice.title} message={notice.message} onClose={() => setNotice(null)} /></div> : null}
    </div>
  );
}
