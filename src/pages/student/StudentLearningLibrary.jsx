import { useEffect, useState } from 'react';
import { BookmarkIcon, ProgressIcon } from '../../components/icons';
import { Card, EmptyState, PageHeader, Skeleton } from '../../components/ui';
import MaterialCard from '../../features/materials/components/MaterialCard';
import { listProgressMaterials, listSavedMaterials, materialErrorMessage } from '../../services/material.service';

export default function StudentLearningLibrary({ mode }) {
  const saved = mode === 'saved';
  const [state, setState] = useState({ status: 'loading', materials: [], error: null });
  useEffect(() => {
    const controller = new AbortController();
    const request = saved ? listSavedMaterials : listProgressMaterials;
    request({ signal: controller.signal })
      .then((materials) => setState({ status: 'success', materials, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', materials: [], error }); });
    return () => controller.abort();
  }, [saved]);
  const Icon = saved ? BookmarkIcon : ProgressIcon;
  return (
    <div className="qz-dashboard qz-enter">
      <PageHeader eyebrow="Ruang belajar" title={saved ? 'Materi tersimpan' : 'Progres belajar'} description={saved ? 'Kembali ke materi penting yang sudah kamu tandai.' : 'Lanjutkan materi yang pernah kamu buka dan lihat apa yang sudah selesai.'} />
      {state.status === 'loading' ? <div className="qz-material-list" role="status" aria-label="Memuat materi"><Skeleton height={180} /><Skeleton height={180} /></div> : state.status === 'error' ? <div className="qz-inline-state qz-inline-state--error" role="alert">{materialErrorMessage(state.error)}</div> : state.materials.length ? <div className="qz-material-list">{state.materials.map((material) => <MaterialCard key={`${material.classId}-${material.id}`} material={material} role="student" />)}</div> : <Card className="qz-class-empty"><EmptyState icon={Icon} title={saved ? 'Belum ada materi tersimpan' : 'Belum ada progres belajar'} description={saved ? 'Gunakan tombol Simpan saat membaca materi agar mudah ditemukan kembali.' : 'Materi yang kamu buka akan mulai tercatat di halaman ini.'} /></Card>}
    </div>
  );
}
