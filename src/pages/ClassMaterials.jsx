import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassWorkspaceNav from '../components/classroom/ClassWorkspaceNav';
import { AddIcon, MaterialIcon } from '../components/icons';
import { Button, Card, Dialog, EmptyState, PageHeader, Skeleton, buttonClassName } from '../components/ui';
import MaterialCard from '../features/materials/components/MaterialCard';
import { useMaterials } from '../features/materials/hooks/useMaterials';
import { getClass } from '../services/class.service';
import { materialErrorMessage } from '../services/material.service';

export default function ClassMaterials({ role }) {
  const { classId } = useParams();
  const { materials, status, error, configured, reload, remove } = useMaterials(classId);
  const [className, setClassName] = useState('Ruang kelas');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!configured) return undefined;
    const controller = new AbortController();
    getClass(classId, { signal: controller.signal }).then((item) => setClassName(item.name)).catch(() => {});
    return () => controller.abort();
  }, [classId, configured]);

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await remove(pendingDelete.id);
      setPendingDelete(null);
    } catch (caught) {
      setDeleteError(materialErrorMessage(caught));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="qz-dashboard qz-enter">
      <PageHeader eyebrow={`${role === 'teacher' ? 'Ruang guru' : 'Ruang siswa'} · ${className}`} title="Materi kelas" description={role === 'teacher' ? 'Susun penjelasan, referensi, dan media belajar dalam blok yang mudah dibaca.' : 'Pelajari materi yang telah dibagikan guru dan pantau progres bacamu.'} actions={role === 'teacher' ? <Link to={`/teacher/classes/${classId}/materials/new`} className={buttonClassName()}><AddIcon size={18} /> Materi baru</Link> : null} />
      <ClassWorkspaceNav role={role} classId={classId} />
      {status === 'error' ? <div className="qz-inline-state qz-inline-state--error" role="alert">{materialErrorMessage(error)} <Button variant="ghost" size="sm" onClick={reload}>Coba lagi</Button></div> : null}
      {!configured ? <div className="qz-status-strip">Layanan materi belum tersedia di lingkungan ini.</div> : null}
      {status === 'loading' ? <div className="qz-material-list" role="status" aria-label="Memuat materi"><Skeleton height={180} /><Skeleton height={180} /></div> : materials.length ? <div className="qz-material-list">{materials.map((item) => <MaterialCard key={item.id} material={item} role={role} onDelete={setPendingDelete} />)}</div> : status !== 'error' ? <Card className="qz-class-empty"><EmptyState icon={MaterialIcon} title={role === 'teacher' ? 'Mulai dari materi pertama' : 'Belum ada materi'} description={role === 'teacher' ? 'Tulis materi dalam blok sederhana, lalu simpan sebagai draf atau terbitkan untuk siswa.' : 'Materi yang diterbitkan guru akan muncul di ruang ini.'} action={role === 'teacher' && configured ? <Link to={`/teacher/classes/${classId}/materials/new`} className={buttonClassName()}><AddIcon size={18} /> Buat materi</Link> : null} /></Card> : null}

      <Dialog open={Boolean(pendingDelete)} onClose={() => !deleting && setPendingDelete(null)} title="Hapus materi?" description="Materi tidak lagi terlihat oleh siswa dan jumlah materi kelas akan diperbarui." footer={<><Button variant="secondary" disabled={deleting} onClick={() => setPendingDelete(null)}>Batal</Button><Button variant="danger" disabled={deleting} onClick={confirmDelete}>{deleting ? 'Menghapus...' : 'Hapus materi'}</Button></>}>
        <p className="qz-dialog-confirm">{pendingDelete?.title}</p>
        {deleteError ? <div className="qz-inline-state qz-inline-state--error" role="alert">{deleteError}</div> : null}
      </Dialog>
    </div>
  );
}
