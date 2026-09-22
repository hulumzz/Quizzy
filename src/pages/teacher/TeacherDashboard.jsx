import React, { useState } from 'react';
import { 
  Plus, 
  BookOpen, 
  Users, 
  Gamepad2, 
  Sparkles, 
  ChevronRight, 
  Copy, 
  Check, 
  QrCode,
  Calendar,
  Layers
} from 'lucide-react';

export default function TeacherDashboard({ onOpenClassDetail }) {
  const [copiedCode, setCopiedCode] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');

  // Sample initial classes state
  const [classes, setClasses] = useState([
    {
      id: 'c1',
      name: 'Matematika XI IPA 1',
      code: 'MTK-11A',
      description: 'Kelas matematika materi aljabar & kalkulus dasar',
      studentsCount: 32,
      materialsCount: 5,
      quizzesCount: 3,
      updatedAt: 'Kemarin'
    },
    {
      id: 'c2',
      name: 'Fisika Dasar - Gelombang',
      code: 'FIS-GEL',
      description: 'Studi gelombang mekanik & elektromagnetik',
      studentsCount: 28,
      materialsCount: 4,
      quizzesCount: 2,
      updatedAt: 'Hari ini'
    }
  ]);

  const handleCopyCode = (code, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateClass = (e) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newCls = {
      id: 'c_' + Date.now(),
      name: newClassName,
      code: newCode,
      description: newClassDesc || 'Kelas pembelajaran baru',
      studentsCount: 0,
      materialsCount: 0,
      quizzesCount: 0,
      updatedAt: 'Baru saja'
    };

    setClasses([newCls, ...classes]);
    setNewClassName('');
    setNewClassDesc('');
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl glass-card p-8 border border-purple-500/20 bg-gradient-to-r from-purple-900/30 via-bg-dark to-blue-900/20">
        <div className="relative z-10 space-y-3 max-w-2xl">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
            <Sparkles className="w-3.5 h-3.5" /> Workspace Pengajar Quizzy
          </span>
          <h2 className="text-3xl md:text-4xl font-black leading-tight">
            Selamat Datang di <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Quizzy LMS</span>
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            Kelola ruang kelas, susun materi Notion-style, berdiskusi dengan siswa, pantau presensi Geotagging, dan jalankan Live Game Kuis interaktif.
          </p>
        </div>

        <button 
          onClick={() => setShowCreateModal(true)}
          className="mt-6 sm:mt-0 relative z-10 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-sm hover:scale-105 transition shadow-lg shadow-purple-500/30 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Buat Kelas Baru
        </button>
      </div>

      {/* Class List Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold">Daftar Kelas Saya ({classes.length})</h3>
          <p className="text-xs text-gray-400">Pilih kelas untuk mengelola materi, presensi, & kuis</p>
        </div>
      </div>

      {/* Class Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((cls) => (
          <div
            key={cls.id}
            onClick={() => onOpenClassDetail(cls)}
            className="group glass-card p-6 rounded-3xl border border-white/10 hover:border-purple-500/50 transition duration-300 cursor-pointer flex flex-col justify-between hover:shadow-xl hover:shadow-purple-500/10"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <span 
                  onClick={(e) => handleCopyCode(cls.code, e)}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-mono font-bold border border-purple-500/30 flex items-center gap-1.5 transition"
                  title="Klik untuk salin kode kelas"
                >
                  {cls.code}
                  {copiedCode === cls.code ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 opacity-70" />}
                </span>

                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-400" /> {cls.studentsCount} Siswa
                </span>
              </div>

              <div>
                <h4 className="font-extrabold text-xl group-hover:text-purple-300 transition mb-1">{cls.name}</h4>
                <p className="text-xs text-gray-400 line-clamp-2">{cls.description}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 mt-6 flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-purple-400" /> {cls.materialsCount} Materi</span>
                <span className="flex items-center gap-1"><Gamepad2 className="w-3.5 h-3.5 text-pink-400" /> {cls.quizzesCount} Kuis</span>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-purple-600 group-hover:text-white transition flex items-center justify-center">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Class Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card p-6 md:p-8 rounded-3xl border border-white/20 w-full max-w-md space-y-6">
            <h3 className="text-xl font-bold">Buat Kelas Pembelajaran Baru</h3>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">Nama Kelas</label>
                <input 
                  type="text" 
                  required
                  placeholder="Contoh: Fisika Kuantum XI IPA 2"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">Deskripsi / Mata Pelajaran</label>
                <textarea 
                  rows="3"
                  placeholder="Deskripsi singkat mengenai fokus materi kelas ini..."
                  value={newClassDesc}
                  onChange={(e) => setNewClassDesc(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm focus:outline-none focus:border-purple-500"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm transition"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-sm transition hover:scale-[1.02]"
                >
                  Buat Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
