import { Link } from 'react-router-dom';
import { ArrowRightIcon, ClassesIcon, MembersIcon, QuizIcon } from '../../../components/icons';
import Badge from '../../../components/ui/Badge';

export default function ClassCard({ classItem, role = 'teacher' }) {
  const basePath = role === 'teacher' ? '/teacher/classes' : '/student/classes';
  const tones = ['purple', 'mint', 'peach', 'blue'];
  const colorIndex = Array.from(String(classItem.id)).reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length;
  return (
    <Link to={`${basePath}/${classItem.id}/overview`} className={`qz-class-card qz-tone-${tones[colorIndex]}`}>
      <div className="qz-class-card__top">
        <span className="qz-class-card__icon"><ClassesIcon size={21} /></span>
        <Badge tone="primary">{classItem.status === 'active' ? 'Kelas aktif' : 'Tidak aktif'}</Badge>
      </div>
      <div className="qz-class-card__body">
        <h3>{classItem.name}</h3>
        <p>{classItem.description || 'Belum ada deskripsi kelas.'}</p>
        {role === 'student' ? <p>{classItem.teacherName || 'Guru Nalaro'}</p> : <p>Kode kelas · {classItem.code}</p>}
      </div>
      <div className="qz-class-card__footer">
        <span><MembersIcon size={15} /> {classItem.studentsCount || 0} siswa</span>
        <span><QuizIcon size={15} /> {classItem.quizzesCount || 0} kuis</span>
        <ArrowRightIcon className="qz-class-card__arrow" size={17} />
      </div>
    </Link>
  );
}
