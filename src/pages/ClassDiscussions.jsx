import { Link, useParams } from 'react-router-dom';
import ClassWorkspaceNav from '../components/classroom/ClassWorkspaceNav';
import { ArrowRightIcon, DiscussionIcon, MaterialIcon } from '../components/icons';
import { Badge, Card, EmptyState, PageHeader, Skeleton, buttonClassName } from '../components/ui';
import { useMaterials } from '../features/materials/hooks/useMaterials';
import { materialErrorMessage } from '../services/material.service';

export default function ClassDiscussions({ role }) {
  const { classId } = useParams();
  const { materials, status, error, configured } = useMaterials(classId);
  return <div className="qz-dashboard qz-enter">
    <PageHeader eyebrow={role === 'teacher' ? 'Ruang guru' : 'Ruang siswa'} title="Diskusi kelas" description="Pilih materi agar percakapan tetap menempel pada konteks yang sedang dipelajari." />
    <ClassWorkspaceNav role={role} classId={classId} />
    {!configured ? <div className="qz-status-strip">Layanan diskusi belum tersedia di lingkungan ini.</div> : null}
    {status === 'loading' ? <div className="qz-discussion-materials"><Skeleton height={135} /><Skeleton height={135} /></div> : status === 'error' ? <div className="qz-inline-state qz-inline-state--error" role="alert">{materialErrorMessage(error)}</div> : materials.length ? <div className="qz-discussion-materials">{materials.map((material) => <Card className="qz-discussion-material" key={material.id}><span className="qz-discussion-material__icon"><MaterialIcon size={22} /></span><div><div><Badge tone={material.status === 'published' ? 'success' : 'warning'}>{material.status === 'published' ? 'Terbit' : 'Draf'}</Badge><span>{material.blocksCount} blok</span></div><h2>{material.title}</h2><p>{material.summary || 'Buka ruang diskusi untuk membahas materi ini.'}</p></div><Link className={buttonClassName({ variant: 'secondary', size: 'sm' })} to={`/${role}/classes/${classId}/materials/${material.id}/discussions`}>Buka diskusi <ArrowRightIcon size={16} /></Link></Card>)}</div> : <Card className="qz-class-empty"><EmptyState icon={DiscussionIcon} title="Belum ada ruang diskusi" description={role === 'teacher' ? 'Terbitkan materi terlebih dahulu, lalu mulai percakapan dari konteks materi tersebut.' : 'Ruang diskusi akan tersedia setelah guru menerbitkan materi.'} /></Card>}
  </div>;
}
