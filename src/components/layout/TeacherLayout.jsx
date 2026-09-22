import React from 'react';
import { 
  BookOpen, 
  Gamepad2, 
  Sparkles, 
  LogOut, 
  User, 
  Plus, 
  Settings, 
  ChevronRight,
  Bell
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function TeacherLayout({ children, activeTab, setActiveTab, onLogout, userProfile }) {
  const { user } = useAuth();
  const avatarUrl = userProfile?.avatar || user?.photoURL || '/logo.png';
  const userName = userProfile?.name || user?.displayName || 'Guru';

  const menuItems = [
    { id: 'classes', label: 'Kelas Saya', icon: BookOpen },
    { id: 'quizzes', label: 'Studio & Live Quiz', icon: Gamepad2 },
    { id: 'ai', label: 'Cloudflare AI Assistant', icon: Sparkles, badge: 'Neurons' },
  ];

  return (
    <div className="min-h-screen bg-bg-dark text-white flex flex-col md:flex-row font-outfit">
      {/* Sidebar Desktop */}
      <aside className="w-full md:w-64 bg-black/40 border-r border-white/10 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 px-2">
            <img src="/logo.png" alt="Quizzy Logo" className="h-9 w-auto drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]" />
            <div>
              <span className="font-black text-lg tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                Quizzy LMS
              </span>
              <span className="block text-[10px] text-purple-300 font-semibold uppercase tracking-wider">Dashboard Guru</span>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <img 
              src={avatarUrl} 
              alt={userName} 
              className="w-10 h-10 rounded-full border border-purple-500/50 object-cover" 
              onError={(e) => { e.target.src = '/logo.png'; }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{userName}</div>
              <div className="text-[11px] text-gray-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Mode Guru
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <div className="text-[11px] font-bold text-gray-500 uppercase px-3 py-1 tracking-wider">Menu Pengajar</div>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/25 scale-[1.02]'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.id === 'ai' ? 'text-yellow-400' : 'text-gray-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 font-bold border border-yellow-400/30">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-white/10 space-y-2">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="w-4 h-4" /> Keluar Akun
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="glass-nav px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold capitalize">
              {activeTab === 'classes' && 'Manajemen Kelas & Workspace'}
              {activeTab === 'quizzes' && 'Studio Kuis & Live Host'}
              {activeTab === 'ai' && 'Cloudflare Workers AI Assistant'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-500"></span>
            </button>
          </div>
        </header>

        {/* Dynamic Children Content */}
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
