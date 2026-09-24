import { useCallback, useState } from 'react';
import { AddIcon, ErrorIcon } from '../../components/icons';
import { Button, Dialog, Input, PageHeader, Toast } from '../../components/ui';
import ClassCollection from '../../features/classes/components/ClassCollection';
import { useClasses } from '../../features/classes/hooks/useClasses';
import { classErrorMessage } from '../../services/class.service';

export default function StudentClasses() {
  const { classes, status, error, configured, reload, joinClass } = useClasses({ scope: 'joined' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const closeDialog = useCallback(() => {
    if (submitting) return;
    setDialogOpen(false);
    setFieldError('');
    setSubmitError('');
  }, [submitting]);

  const openDialog = () => {
    setCode('');
    setFieldError('');
    setSubmitError('');
    setDialogOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!/^[23456789A-HJ-NP-Z]{6}$/.test(normalized)) {
      setFieldError('Kode kelas harus terdiri dari 6 huruf atau angka.');
      return;
    }
    setSubmitting(true);
    setFieldError('');
    setSubmitError('');
    try {
      const joined = await joinClass(normalized);
      setDialogOpen(false);
      setNotice({ title: 'Berhasil bergabung', message: `${joined.name} sudah masuk ke daftar kelasmu.` });
    } catch (caught) {
      setFieldError(caught.details?.code || '');
      setSubmitError(classErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="qz-dashboard qz-enter">
      <PageHeader eyebrow="Ruang siswa" title="Kelas saya" description="Buka ruang belajar yang kamu ikuti atau masukkan kode kelas baru." actions={<Button onClick={openDialog} disabled={!configured}><AddIcon size={18} /> Gabung kelas</Button>} />

      {!configured ? <div className="qz-status-strip"><ErrorIcon size={19} /> Layanan kelas belum tersedia. Hubungi pengelola Nalaro Class.</div> : null}
      {status === 'error' ? <div className="qz-inline-state qz-inline-state--error" role="alert">{classErrorMessage(error)} <Button variant="ghost" size="sm" onClick={reload}>Coba lagi</Button></div> : null}

      <ClassCollection classes={classes} status={status} configured={configured} role="student" onCreate={openDialog} />

      <Dialog open={dialogOpen} onClose={closeDialog} title="Gabung kelas" description="Masukkan kode 6 karakter yang dibagikan oleh guru." footer={<><Button variant="secondary" onClick={closeDialog} disabled={submitting}>Batal</Button><Button type="submit" form="join-class-form" disabled={submitting}>{submitting ? 'Menghubungkan...' : 'Gabung kelas'}</Button></>}>
        <form id="join-class-form" onSubmit={handleSubmit} className="qz-form-stack">
          <Input label="Kode kelas" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Contoh: ABC234" maxLength={6} error={fieldError} autoCapitalize="characters" autoComplete="off" className="qz-code-input" autoFocus />
          {submitError ? <div className="qz-inline-state qz-inline-state--error" role="alert">{submitError}</div> : null}
        </form>
      </Dialog>

      {notice ? <div className="qz-toast-stack"><Toast title={notice.title} message={notice.message} onClose={() => setNotice(null)} /></div> : null}
    </div>
  );
}
