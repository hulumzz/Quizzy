import { GraduationCap, Users } from 'lucide-react';
import { Badge, Button, Card } from '../ui';

export default function ClassSummary({ classItem, role, onCopyCode }) {
  return <Card className="qz-class-summary-card">
    <div className="qz-class-summary-card__head"><span className="qz-eyebrow">Informasi kelas</span><Badge tone={classItem.status === 'active' ? 'success' : 'neutral'}>{classItem.status === 'active' ? 'Kelas aktif' : 'Kelas tidak aktif'}</Badge></div>
    <dl className="qz-class-summary-card__details"><div><dt><GraduationCap size={17} aria-hidden="true" /> Pengajar</dt><dd>{classItem.teacherName || 'Guru Nalaro'}</dd></div><div><dt><Users size={17} aria-hidden="true" /> Anggota</dt><dd>{classItem.studentsCount || 0} <span>siswa</span></dd></div></dl>
    {role === 'teacher' ? <div className="qz-class-summary-card__invite"><div><span>Kode undangan</span><strong>{classItem.code}</strong></div><Button variant="secondary" size="sm" onClick={onCopyCode}>Salin kode</Button></div> : null}
  </Card>;
}
