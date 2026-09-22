import {
  AttendanceIcon,
  BookmarkIcon,
  ClassesIcon,
  HomeIcon,
  ProgressIcon,
  QuizIcon,
} from '../components/icons';

export const teacherNavigation = [
  { label: 'Beranda', path: '/teacher/home', icon: HomeIcon, end: true },
  { label: 'Kelas', path: '/teacher/classes', icon: ClassesIcon },
  { label: 'Kuis', path: '/teacher/quizzes', icon: QuizIcon },
  { label: 'Presensi', path: '/teacher/attendance', icon: AttendanceIcon },
];

export const studentNavigation = [
  { label: 'Beranda', path: '/student/home', icon: HomeIcon, end: true },
  { label: 'Kelas', path: '/student/classes', icon: ClassesIcon },
  { label: 'Progres', path: '/student/progress', icon: ProgressIcon },
  { label: 'Tersimpan', path: '/student/saved', icon: BookmarkIcon },
];

export function navigationForRole(role) {
  return role === 'teacher' ? teacherNavigation : role === 'student' ? studentNavigation : [];
}

export function homeForRole(role) {
  return role === 'teacher' ? '/teacher/home' : role === 'student' ? '/student/home' : '/onboarding';
}

export function pageMeta(pathname, role) {
  const navigation = navigationForRole(role);
  const exact = navigation.find((item) => pathname === item.path);
  if (exact) return { title: exact.label, subtitle: role === 'teacher' ? 'Ruang guru' : 'Ruang belajar' };
  if (pathname.startsWith('/quiz/join')) return { title: 'Gabung kuis', subtitle: 'Masukkan PIN dari guru' };
  if (pathname.includes('/classes/')) return { title: 'Ruang kelas', subtitle: 'Materi dan aktivitas kelas' };
  return { title: 'Quizzy', subtitle: role === 'teacher' ? 'Ruang guru' : 'Ruang belajar' };
}
