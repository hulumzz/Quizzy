import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import TeacherLayout from './components/layout/TeacherLayout';
import StudentLayout from './components/layout/StudentLayout';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import ClassDetail from './pages/ClassDetail';

function MainApp() {
  const { user, userProfile, signOut, loading } = useAuth();
  
  // Navigation State
  const [view, setView] = useState('landing'); // 'landing' | 'auth' | 'app' | 'class_detail'
  const [activeTab, setActiveTab] = useState('classes');
  const [selectedClass, setSelectedClass] = useState(null);
  const [currentRole, setCurrentRole] = useState(userProfile?.role || 'teacher');

  // Handle Logout
  const handleLogout = async () => {
    await signOut();
    setView('landing');
  };

  // Open specific class detail
  const handleOpenClassDetail = (cls) => {
    setSelectedClass(cls);
    setView('class_detail');
  };

  // View: Landing Page
  if (view === 'landing') {
    return (
      <Landing 
        onEnterApp={() => {
          if (user) setView('app');
          else setView('auth');
        }} 
      />
    );
  }

  // View: Auth (Login & Role Selection)
  if (view === 'auth' || (!user && view !== 'landing')) {
    return (
      <Auth 
        onAuthComplete={(role) => {
          setCurrentRole(role);
          setView('app');
        }} 
      />
    );
  }

  // Active User Role (fallback to userProfile role or selected role)
  const role = userProfile?.role || currentRole || 'teacher';

  // View: Class Detail View (Shared for both roles)
  if (view === 'class_detail' && selectedClass) {
    return (
      <div className="min-h-screen bg-bg-dark text-white p-6 font-outfit">
        <ClassDetail 
          classData={selectedClass} 
          onBack={() => setView('app')} 
          userRole={role}
        />
      </div>
    );
  }

  // View: Teacher Dashboard Layout
  if (role === 'teacher') {
    return (
      <TeacherLayout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        userProfile={userProfile}
      >
        {activeTab === 'classes' && (
          <TeacherDashboard onOpenClassDetail={handleOpenClassDetail} />
        )}
        {activeTab === 'quizzes' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold">Studio & Live Quiz Host</h2>
            <p className="text-xs text-gray-400">Buat dan luncurkan kuis live ke seluruh siswa di kelas.</p>
            <div className="glass-card p-6 rounded-3xl border border-white/10 text-sm">
              [Studio Engine Ready - Terintegrasi dengan Firebase Live Quiz]
            </div>
          </div>
        )}
        {activeTab === 'ai' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold">Cloudflare Workers AI (Neurons)</h2>
            <p className="text-xs text-gray-400">Generasi kuis otomatis & rangkuman materi dari edge AI.</p>
            <div className="glass-card p-6 rounded-3xl border border-white/10 text-sm">
              [Cloudflare Neurons AI API Endpoints Ready]
            </div>
          </div>
        )}
      </TeacherLayout>
    );
  }

  // View: Student Dashboard Layout
  return (
    <StudentLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onLogout={handleLogout}
      userProfile={userProfile}
    >
      {activeTab === 'classes' && (
        <StudentDashboard 
          onOpenClassDetail={handleOpenClassDetail}
          onJoinLiveGame={(pin) => alert(`Menghubungkan ke Live Game PIN: ${pin}`)}
        />
      )}
      {activeTab === 'join' && (
        <div className="space-y-4 max-w-md mx-auto py-8">
          <h2 className="text-2xl font-bold text-center">Gabung Live Game PIN</h2>
          <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
            <input 
              type="text"
              placeholder="Masukkan 6 Digit PIN"
              className="w-full p-4 rounded-2xl bg-black/40 border border-white/10 text-center font-mono font-bold tracking-widest text-xl uppercase focus:outline-none focus:border-purple-500"
            />
            <button className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-sm">
              Masuk Arena Game
            </button>
          </div>
        </div>
      )}
      {activeTab === 'ai' && (
        <div className="space-y-4 max-w-xl mx-auto py-4">
          <h2 className="text-2xl font-bold">AI Tutor Pembimbing</h2>
          <p className="text-xs text-gray-400">Tanyakan apapun seputar materi pelajaranmu pada AI Tutor.</p>
          <div className="glass-card p-6 rounded-3xl border border-white/10 text-sm">
            [AI Class Tutor Powered by Cloudflare Workers AI]
          </div>
        </div>
      )}
    </StudentLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
