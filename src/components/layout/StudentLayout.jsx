import React from 'react';
import { 
  BookOpen, 
  Gamepad2, 
  LogOut, 
  Sparkles, 
  User, 
  QrCode,
  Compass
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function StudentLayout({ children, activeTab, setActiveTab, onLogout, userProfile }) {
  const { user } = useAuth();
  const avatarUrl = userProfile?.avatar || user?.photoURL || '/logo.png';
  const userName = userProfile?.name || user?.displayName || 'Siswa';

  const navItems = [
    { id: 'classes', label: 'Kelas Saya', icon: BookOpen },
    { id: 'join', label: 'Gabung PIN', icon: QrCode, highlight: true },
    { id: 'ai', label: 'AI Tutor', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-bg-dark text-white flex flex-col font-outfit pb-20 md:pb-0">
      {/* Top Header Navigation */}
      <header className="glass-nav sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Quizzy" className="h-8 w-auto drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
          <div>
            <span className="font-extrabold text-base tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Quizzy Student
            </span>
          </div>
        </div>

        {/* Student Profile Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 text-xs">
            <img 
              src={avatarUrl} 
              alt={userName} 
              className="w-5 h-5 rounded-full object-cover" 
              onError={(e) => { e.target.src = '/logo.png'; }}
            />
            <span className="font-bold truncate max-w-[100px]">{userName}</span>
          </div>

          <button 
            onClick={onLogout}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
            title="Keluar Akun"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 overflow-y-auto no-scrollbar">
        {children}
      </main>

      {/* Mobile & Desktop Bottom/Navigation Dock */}
      <div className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-white/10 px-6 py-3 flex justify-around items-center max-w-md mx-auto md:max-w-xl md:rounded-t-3xl shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          if (item.highlight) {
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="relative -top-5 p-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xl shadow-purple-500/40 hover:scale-110 active:scale-95 transition"
              >
                <Icon className="w-6 h-6" />
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 transition ${
                isActive ? 'text-purple-400 font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
