import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassWorkspaceNav from '../components/classroom/ClassWorkspaceNav';
import { BookmarkIcon, DiscussionIcon, EditIcon, MaterialIcon } from '../components/icons';
import { Badge, Button, Card, EmptyState, Progress, Skeleton, buttonClassName } from '../components/ui';
import MaterialBlocks from '../features/materials/components/MaterialBlocks';
import { getMaterial, materialErrorMessage, saveProgress, setMaterialBookmark } from '../services/material.service';

export default function MaterialReader({ role }) {
  const { classId, materialId } = useParams();
  const [state, setState] = useState({ status: 'loading', material: null, error: null });
  const [actionError, setActionError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    started.current = false;
    getMaterial(classId, materialId, { signal: controller.signal })
      .then(async (material) => {
        if (controller.signal.aborted) return;
        setState({ status: 'success', material, error: null });
        if (role === 'student' && !started.current && (material.progress?.percent || 0) === 0) {
          started.current = true;
          try {
            const progress = await saveProgress(classId, materialId, 1);
            if (!controller.signal.aborted) setState((current) => ({ ...current, material: { ...current.material, progress } }));
          } catch {
            // Reading remains available when the non-critical progress write fails.
          }
        }
      })
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', material: null, error }); });
    return () => controller.abort();
  }, [classId, materialId, role]);

  const toggleBookmark = async () => {
    const next = !state.material.bookmarked;
    setActionError('');
    try {
      await setMaterialBookmark(classId, materialId, next);
      setState((current) => ({ ...current, material: { ...current.material, bookmarked: next } }));
    } catch (error) { setActionError(materialErrorMessage(error)); }
  };

  const complete = async () => {
    setActionError('');
    try {
      const progress = await saveProgress(classId, materialId, 100);
      setState((current) => ({ ...current, material: { ...current.material, progress } }));
    } catch (error) { setActionError(materialErrorMessage(error)); }
  };

  if (state.status === 'loading') return <div className="qz-dashboard"><Skeleton width="52%" height={42} /><Skeleton height={560} /></div>;
  if (state.status === 'error') return <Card className="qz-placeholder"><EmptyState icon={MaterialIcon} title="Materi tidak dapat dibuka" description={materialErrorMessage(state.error)} action={<Link to={`/${role}/classes/${classId}/materials`} className={buttonClassName()}>Kembali ke materi</Link>} /></Card>;
  const material = state.material;
  const completed = material.progress?.percent === 100;
  return (
    <div className="qz-dashboard qz-enter">
      <ClassWorkspaceNav role={role} classId={classId} />
      <article className="qz-reader">
        <header className="qz-reader__header"><div className="qz-reader__meta"><Badge tone={material.status === 'published' ? 'success' : 'warning'}>{material.status === 'published' ? 'Terbit' : 'Draf'}</Badge><span>{material.blocksCount} blok</span></div><h1>{material.title}</h1>{material.summary ? <p>{material.summary}</p> : null}</header>
        {role === 'student' ? <div className="qz-reader__student-actions"><div><Progress value={material.progress?.percent || 0} label={completed ? 'Materi selesai' : 'Progres membaca'} /></div><Link to={`/student/classes/${classId}/materials/${materialId}/discussions`} className={buttonClassName({ variant: 'secondary' })}><DiscussionIcon size={17} /> Diskusi</Link><Button variant="secondary" onClick={toggleBookmark}><BookmarkIcon size={17} /> {material.bookmarked ? 'Hapus simpanan' : 'Simpan materi'}</Button><Button onClick={complete} disabled={completed}>{completed ? 'Sudah selesai' : 'Tandai selesai'}</Button></div> : <div className="qz-reader__teacher-actions"><Link to={`/teacher/classes/${classId}/materials/${materialId}/discussions`} className={buttonClassName({ variant: 'secondary' })}><DiscussionIcon size={17} /> Diskusi</Link><Link to={`/teacher/classes/${classId}/materials/${materialId}/edit`} className={buttonClassName()}><EditIcon size={17} /> Edit materi</Link></div>}
        {actionError ? <div className="qz-inline-state qz-inline-state--error" role="alert">{actionError}</div> : null}
        <MaterialBlocks blocks={material.blocks} />
      </article>
    </div>
  );
}
