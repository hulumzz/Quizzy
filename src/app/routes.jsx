import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { PageLoader } from '../components/ui';
import { useAuth } from '../context/useAuth';
import { homeForRole } from './navigation';
import { PublicOnly, RequireAuth, RequireRole } from './guards/RouteGuards';

const AuthBoundary = lazy(() => import('./AuthBoundary'));
const Auth = lazy(() => import('../pages/Auth'));
const Profile = lazy(() => import('../pages/Profile'));
const FeaturePlaceholder = lazy(() => import('../pages/FeaturePlaceholder'));
const Landing = lazy(() => import('../pages/Landing'));
const QuizJoin = lazy(() => import('../pages/QuizJoin'));
const StudentDashboard = lazy(() => import('../pages/student/StudentDashboard'));
const StudentClasses = lazy(() => import('../pages/student/StudentClasses'));
const TeacherDashboard = lazy(() => import('../pages/teacher/TeacherDashboard'));
const TeacherClasses = lazy(() => import('../pages/teacher/TeacherClasses'));
const TeacherAttendance = lazy(() => import('../pages/teacher/TeacherAttendance'));
const ClassOverview = lazy(() => import('../pages/ClassOverview'));
const ClassSessions = lazy(() => import('../pages/ClassSessions'));
const ClassMaterials = lazy(() => import('../pages/ClassMaterials'));
const ClassAttendance = lazy(() => import('../pages/ClassAttendance'));
const MaterialReader = lazy(() => import('../pages/MaterialReader'));
const MaterialEditor = lazy(() => import('../pages/teacher/MaterialEditor'));
const StudentLearningLibrary = lazy(() => import('../pages/student/StudentLearningLibrary'));
const ClassDiscussions = lazy(() => import('../pages/ClassDiscussions'));
const MaterialDiscussion = lazy(() => import('../pages/MaterialDiscussion'));
const ClassQuizzes = lazy(() => import('../pages/ClassQuizzes'));
const QuizAttempt = lazy(() => import('../pages/QuizAttempt'));
const QuizEditor = lazy(() => import('../pages/teacher/QuizEditor'));
const QuizResults = lazy(() => import('../pages/teacher/QuizResults'));
const TeacherQuizzes = lazy(() => import('../pages/teacher/TeacherQuizzes'));
const TeacherGeneralQuizzes = lazy(() => import('../pages/teacher/TeacherGeneralQuizzes'));
const QuizBank = lazy(() => import('../pages/teacher/QuizBank'));
const LiveQuizHost = lazy(() => import('../pages/LiveQuizHost'));
const LiveQuizPlayer = lazy(() => import('../pages/LiveQuizPlayer'));
const ClassTasks = lazy(() => import('../pages/ClassTasks'));
const TaskDetail = lazy(() => import('../pages/TaskDetail'));
const TaskEditor = lazy(() => import('../pages/teacher/TaskEditor'));

function RouteLoading() {
  return <PageLoader label="Memuat halaman..." />;
}

function LandingRoute() {
  const navigate = useNavigate();
  return <Landing onEnterApp={() => navigate('/login')} />;
}

function AuthRoute({ onboarding = false }) {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  if (onboarding) {
    if (!user) return <Navigate to="/login" replace />;
    if (!['teacher', 'student'].includes(userProfile?.role)) return <Navigate to="/login" replace />;
    if (userProfile?.isAnonymous || (userProfile?.profileCompleted && userProfile?.institution?.trim())) return <Navigate to={homeForRole(userProfile.role)} replace />;
    return <Profile onboarding onComplete={(role) => navigate(homeForRole(role), { replace: true })} />;
  }
  if (user && userProfile?.role) return <Navigate to={userProfile.isAnonymous || (userProfile.profileCompleted && userProfile.institution?.trim()) ? homeForRole(userProfile.role) : '/onboarding'} replace />;
  return <Auth onAuthComplete={(role) => navigate(homeForRole(role), { replace: true })} />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}><Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="quiz/join" element={<QuizJoin />} />
      <Route path="quiz/join/:code" element={<QuizJoin />} />
      <Route path="quiz/play/:code" element={<LiveQuizPlayer />} />
      <Route element={<AuthBoundary />}>
        <Route path="/login" element={<PublicOnly><AuthRoute /></PublicOnly>} />
        <Route path="/onboarding" element={<AuthRoute onboarding />} />

        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="profile" element={<Profile />} />
          <Route path="teacher" element={<RequireRole role="teacher"><Navigate to="home" replace /></RequireRole>} />
          <Route path="teacher/home" element={<RequireRole role="teacher"><TeacherDashboard /></RequireRole>} />
          <Route path="teacher/classes" element={<RequireRole role="teacher"><TeacherClasses /></RequireRole>} />
          <Route path="teacher/classes/:classId/overview" element={<RequireRole role="teacher"><ClassOverview role="teacher" /></RequireRole>} />
          <Route path="teacher/classes/:classId/sessions" element={<RequireRole role="teacher"><ClassSessions role="teacher" /></RequireRole>} />
          <Route path="teacher/classes/:classId/materials" element={<RequireRole role="teacher"><ClassMaterials role="teacher" /></RequireRole>} />
          <Route path="teacher/classes/:classId/materials/new" element={<RequireRole role="teacher"><MaterialEditor /></RequireRole>} />
          <Route path="teacher/classes/:classId/materials/:materialId/edit" element={<RequireRole role="teacher"><MaterialEditor /></RequireRole>} />
          <Route path="teacher/classes/:classId/materials/:materialId/discussions" element={<RequireRole role="teacher"><MaterialDiscussion role="teacher" /></RequireRole>} />
          <Route path="teacher/classes/:classId/materials/:materialId" element={<RequireRole role="teacher"><MaterialReader role="teacher" /></RequireRole>} />
          <Route path="teacher/classes/:classId/discussions" element={<RequireRole role="teacher"><ClassDiscussions role="teacher" /></RequireRole>} />
          <Route path="teacher/classes/:classId/attendance" element={<RequireRole role="teacher"><ClassAttendance role="teacher" /></RequireRole>} />
          <Route path="teacher/classes/:classId/quizzes" element={<RequireRole role="teacher"><ClassQuizzes role="teacher" /></RequireRole>} />
          <Route path="teacher/classes/:classId/quizzes/new" element={<RequireRole role="teacher"><QuizEditor /></RequireRole>} />
          <Route path="teacher/classes/:classId/quizzes/:quizId/edit" element={<RequireRole role="teacher"><QuizEditor /></RequireRole>} />
          <Route path="teacher/classes/:classId/quizzes/:quizId/results" element={<RequireRole role="teacher"><QuizResults /></RequireRole>} />
          <Route path="teacher/classes/:classId/quizzes/:quizId/live" element={<RequireRole role="teacher"><LiveQuizHost /></RequireRole>} />
          <Route path="teacher/classes/:classId/tasks" element={<RequireRole role="teacher"><ClassTasks role="teacher" /></RequireRole>} />
          <Route path="teacher/classes/:classId/tasks/new" element={<RequireRole role="teacher"><TaskEditor /></RequireRole>} />
          <Route path="teacher/classes/:classId/tasks/:taskId/edit" element={<RequireRole role="teacher"><TaskEditor /></RequireRole>} />
          <Route path="teacher/classes/:classId/tasks/:taskId" element={<RequireRole role="teacher"><TaskDetail role="teacher" /></RequireRole>} />
          <Route path="teacher/classes/:classId/*" element={<RequireRole role="teacher"><FeaturePlaceholder title="Ruang kelas" description="Materi, diskusi, dan presensi sudah tersedia. Modul kuis serta pengaturan anggota lanjutan akan diteruskan pada tahap berikutnya." emptyTitle="Modul ini belum tersedia" /></RequireRole>} />
          <Route path="teacher/quizzes" element={<RequireRole role="teacher"><TeacherQuizzes /></RequireRole>} />
          <Route path="teacher/general-quizzes" element={<RequireRole role="teacher"><TeacherGeneralQuizzes /></RequireRole>} />
          <Route path="teacher/general-quizzes/new" element={<RequireRole role="teacher"><QuizEditor scope="general" /></RequireRole>} />
          <Route path="teacher/general-quizzes/:quizId/edit" element={<RequireRole role="teacher"><QuizEditor scope="general" /></RequireRole>} />
          <Route path="teacher/general-quizzes/:quizId/live" element={<RequireRole role="teacher"><LiveQuizHost scope="general" /></RequireRole>} />
          <Route path="teacher/quiz-bank" element={<RequireRole role="teacher"><QuizBank /></RequireRole>} />
          <Route path="teacher/attendance" element={<RequireRole role="teacher"><TeacherAttendance /></RequireRole>} />

          <Route path="student" element={<RequireRole role="student"><Navigate to="home" replace /></RequireRole>} />
          <Route path="student/home" element={<RequireRole role="student"><StudentDashboard /></RequireRole>} />
          <Route path="student/classes" element={<RequireRole role="student"><StudentClasses /></RequireRole>} />
          <Route path="student/classes/:classId/overview" element={<RequireRole role="student"><ClassOverview role="student" /></RequireRole>} />
          <Route path="student/classes/:classId/sessions" element={<RequireRole role="student"><ClassSessions role="student" /></RequireRole>} />
          <Route path="student/classes/:classId/materials" element={<RequireRole role="student"><ClassMaterials role="student" /></RequireRole>} />
          <Route path="student/classes/:classId/materials/:materialId/discussions" element={<RequireRole role="student"><MaterialDiscussion role="student" /></RequireRole>} />
          <Route path="student/classes/:classId/materials/:materialId" element={<RequireRole role="student"><MaterialReader role="student" /></RequireRole>} />
          <Route path="student/classes/:classId/discussions" element={<RequireRole role="student"><ClassDiscussions role="student" /></RequireRole>} />
          <Route path="student/classes/:classId/attendance" element={<RequireRole role="student"><ClassAttendance role="student" /></RequireRole>} />
          <Route path="student/classes/:classId/quizzes" element={<RequireRole role="student"><ClassQuizzes role="student" /></RequireRole>} />
          <Route path="student/classes/:classId/quizzes/:quizId" element={<RequireRole role="student"><QuizAttempt /></RequireRole>} />
          <Route path="student/classes/:classId/tasks" element={<RequireRole role="student"><ClassTasks role="student" /></RequireRole>} />
          <Route path="student/classes/:classId/tasks/:taskId" element={<RequireRole role="student"><TaskDetail role="student" /></RequireRole>} />
          <Route path="student/classes/:classId/*" element={<RequireRole role="student"><FeaturePlaceholder title="Ruang kelas" description="Materi, diskusi, dan presensi kelas tersedia dari navigasi ruang belajar." emptyTitle="Konten kelas belum tersedia" /></RequireRole>} />
          <Route path="student/progress" element={<RequireRole role="student"><StudentLearningLibrary mode="progress" /></RequireRole>} />
          <Route path="student/saved" element={<RequireRole role="student"><StudentLearningLibrary mode="saved" /></RequireRole>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
  );
}
