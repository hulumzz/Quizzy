import { Link } from 'react-router-dom';
import { ArrowRightIcon, BookmarkIcon, DeleteIcon, EditIcon, MaterialIcon } from '../../../components/icons';
import { Badge, Button, Progress, buttonClassName } from '../../../components/ui';

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Baru diperbarui' : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export default function MaterialCard({ material, role, onDelete }) {
  const base = `/${role}/classes/${material.classId}/materials/${material.id}`;
  const percent = material.progress?.percent || 0;
  return (
    <article className="qz-material-card">
      <div className="qz-material-card__mark"><MaterialIcon size={24} /></div>
      <div className="qz-material-card__content">
        <div className="qz-material-card__meta">
          <Badge tone={material.status === 'published' ? 'success' : 'warning'}>{material.status === 'published' ? 'Terbit' : 'Draf'}</Badge>
          {material.bookmarked ? <span><BookmarkIcon size={14} /> Tersimpan</span> : null}
          <span>{dateLabel(material.updatedAt)}</span>
        </div>
        <h2>{material.title}</h2>
        <p>{material.summary || 'Materi ini belum memiliki ringkasan.'}</p>
        {role === 'student' ? <Progress value={percent} label={percent === 100 ? 'Selesai dibaca' : `${percent}% dibaca`} /> : <span className="qz-material-card__blocks">{material.blocksCount || 0} blok konten</span>}
      </div>
      <div className="qz-material-card__actions">
        <Link to={base} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>{role === 'teacher' ? 'Pratinjau' : 'Baca'} <ArrowRightIcon size={16} /></Link>
        {role === 'teacher' ? <><Link to={`${base}/edit`} className={buttonClassName({ variant: 'ghost', size: 'sm' })}><EditIcon size={16} /> Edit</Link><Button variant="ghost" size="sm" onClick={() => onDelete(material)} aria-label={`Hapus ${material.title}`}><DeleteIcon size={16} /></Button></> : null}
      </div>
    </article>
  );
}
