import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../context/useAuth';
import { homeForRole } from './navigation';
import { PublicOnly, RequireAuth, RequireRole } from './guards/RouteGuards';

const AuthBoundary = lazy(() => import('./AuthBoundary'));
const Auth = lazy(() => import('../pages/Auth'));
const FeaturePlaceholder = lazy(() => import('../pages/FeaturePlaceholder'));
const Landing = lazy(() => import('../pages/Landing'));
const QuizJoin = lazy(() => import('../pages/QuizJoin'));
const StudentDashboard = lazy(() => import('../pages/student/StudentDashboard'));
const StudentClasses = lazy(() => import('../pages/student/StudentClasses'));
const TeacherDashboard = lazy(() => import('../pages/teacher/TeacherDashboard'));
const TeacherClasses = lazy(() => import('../pages/teacher/TeacherClasses'));
const ClassOverview = lazy(() => import('../pages/ClassOverview'));
const ClassMaterials = lazy(() => import('../pages/ClassMaterials'));
const MaterialReader = lazy(() => import('../pages/MaterialReader'));
const MaterialEditor = lazy(() => import('../pages/teacher/MaterialEditor'));
const StudentLearningLibrary = lazy(() => import('../pages/student/StudentLearningLibrary'));
const ClassDiscussions = lazy(() => import('../pages/ClassDiscussions'));
const MaterialDiscussion = lazy(() => import('../pages/MaterialDiscussion'));

function RouteLoading() {
  return <div className="qz-app-shell" style={{ display: 'grid', minHeight: '45vh', placeItems: 'center' }} role="status"><div className="qz-status-strip">Menyiapkan halaman...</div></div>;
}

function LandingRoute() {
  const navigate = useNavigate();
  return <Landing onEnterApp={() => navigate('/login')} />;
}

function AuthRoute({ onboarding = false }) {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  if (onboarding && !user) return <Navigate to="/login" replace />;
  if (user && userProfile?.role) return <Navigate to={homeForRole(userProfile.role)} replace />;
  return <Auth initialStep={onboarding || user ? 'role' : 'login'} onAuthComplete={(role) => navigate(homeForRole(role), { replace: true })} />;
}

const teacherPlaceholder = {
  quizzes: <FeaturePlaceholder title="Kuis" description="Siapkan evaluasi dan sesi kuis untuk siswa." emptyTitle="Belum ada kuis" emptyDescription="Studio kuis akan dibangun setelah fondasi kelas dan materi selesai." />,
  attendance: <FeaturePlaceholder title="Presensi" description="Kelola sesi dan riwayat kehadiran kelas." emptyTitle="Belum ada sesi presensi" emptyDescription="Presensi akan diaktifkan setelah kelas memiliki data yang tersimpan." />,
};

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}><Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route element={<AuthBoundary />}>
        <Route path="/login" element={<PublicOnly><AuthRoute /></PublicOnly>} />
        <Route path="/onboarding" element={<AuthRoute onboarding />} />

        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="teacher" element={<RequireRole role="teacher"><Navigate to="home" replace /></RequireRole>} />
        <Route path="teacher/home" element={<RequireRole role="teacher"><TeacherDashboard /></RequireRole>} />
        <Route path="teacher/classes" element={<RequireRole role="teacher"><TeacherClasses /></RequireRole>} />
        <Route path="teacher/classes/:classId/overview" element={<RequireRole role="teacher"><ClassOverview role="teacher" /></RequireRole>} />
        <Route path="teacher/classes/:classId/materials" element={<RequireRole role="teacher"><ClassMaterials role="teacher" /></RequireRole>} />
        <Route path="teacher/classes/:classId/materials/new" element={<RequireRole role="teacher"><MaterialEditor /></RequireRole>} />
        <Route path="teacher/classes/:classId/materials/:materialId/edit" element={<RequireRole role="teacher"><MaterialEditor /></RequireRole>} />
        <Route path="teacher/classes/:classId/materials/:materialId/discussions" element={<RequireRole role="teacher"><MaterialDiscussion role="teacher" /></RequireRole>} />
        <Route path="teacher/classes/:classId/materials/:materialId" element={<RequireRole role="teacher"><MaterialReader role="teacher" /></RequireRole>} />
        <Route path="teacher/classes/:classId/discussions" element={<RequireRole role="teacher"><ClassDiscussions role="teacher" /></RequireRole>} />
        <Route path="teacher/classes/:classId/*" element={<RequireRole role="teacher"><FeaturePlaceholder title="Ruang kelas" description="Materi dan diskusi sudah tersedia. Modul kuis, presensi, serta pengaturan anggota akan dilanjutkan pada tahap berikutnya." emptyTitle="Modul ini belum tersedia" /></RequireRole>} />
        <Route path="teacher/quizzes" element={<RequireRole role="teacher">{teacherPlaceholder.quizzes}</RequireRole>} />
        <Route path="teacher/attendance" element={<RequireRole role="teacher">{teacherPlaceholder.attendance}</RequireRole>} />

        <Route path="student" element={<RequireRole role="student"><Navigate to="home" replace /></RequireRole>} />
        <Route path="student/home" element={<RequireRole role="student"><StudentDashboard /></RequireRole>} />
        <Route path="student/classes" element={<RequireRole role="student"><StudentClasses /></RequireRole>} />
        <Route path="student/classes/:classId/overview" element={<RequireRole role="student"><ClassOverview role="student" /></RequireRole>} />
        <Route path="student/classes/:classId/materials" element={<RequireRole role="student"><ClassMaterials role="student" /></RequireRole>} />
        <Route path="student/classes/:classId/materials/:materialId/discussions" element={<RequireRole role="student"><MaterialDiscussion role="student" /></RequireRole>} />
        <Route path="student/classes/:classId/materials/:materialId" element={<RequireRole role="student"><MaterialReader role="student" /></RequireRole>} />
        <Route path="student/classes/:classId/discussions" element={<RequireRole role="student"><ClassDiscussions role="student" /></RequireRole>} />
        <Route path="student/classes/:classId/*" element={<RequireRole role="student"><FeaturePlaceholder title="Ruang kelas" description="Materi dan aktivitas kelas akan tersedia setelah data kelas diaktifkan." emptyTitle="Konten kelas belum tersedia" /></RequireRole>} />
        <Route path="student/progress" element={<RequireRole role="student"><StudentLearningLibrary mode="progress" /></RequireRole>} />
        <Route path="student/saved" element={<RequireRole role="student"><StudentLearningLibrary mode="saved" /></RequireRole>} />
          <Route path="quiz/join" element={<RequireRole role="student"><QuizJoin /></RequireRole>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
  );
}
