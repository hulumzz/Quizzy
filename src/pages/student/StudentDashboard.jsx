import React, { useState } from 'react';
import { 
  BookOpen, 
  Gamepad2, 
  Plus, 
  QrCode, 
  Users, 
  ChevronRight, 
  Sparkles,
  ArrowRight,
  Search
} from 'lucide-react';

export default function StudentDashboard({ onOpenClassDetail, onJoinLiveGame }) {
  const [showJoinClassModal, setShowJoinClassModal] = useState(false);
  const [classCodeInput, setClassCodeInput] = useState('');
  const [gamePinInput, setGamePinInput] = useState('');

  // Sample enrolled classes
  const [joinedClasses, setJoinedClasses] = useState([
    {
      id: 'c1',
      name: 'Matematika XI IPA 1',
      code: 'MTK-11A',
      teacherName: 'Pak Budi Prasetyo',
      materialsCount: 5,
      quizzesCount: 3,
    },
    {
      id: 'c2',
      name: 'Fisika Dasar - Gelombang',
      code: 'FIS-GEL',
      teacherName: 'Bu Siti Rahma',
      materialsCount: 4,
      quizzesCount: 2,
    }
  ]);

  const handleJoinClass = (e) => {
    e.preventDefault();
    if (!classCodeInput.trim()) return;

    const newCls = {
      id: 'c_joined_' + Date.now(),
      name: `Kelas ${classCodeInput.toUpperCase()}`,
      code: classCodeInput.toUpperCase(),
      teacherName: 'Guru Quizzy',
      materialsCount: 2,
      quizzesCount: 1,
    };

    setJoinedClasses([...joinedClasses, newCls]);
    setClassCodeInput('');
    setShowJoinClassModal(false);
  };

  const handleJoinGamePIN = (e) => {
    e.preventDefault();
    if (!gamePinInput.trim()) return;
    onJoinLiveGame(gamePinInput);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Live Quiz Quick Join Banner */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-900/40 via-bg-dark to-blue-900/30 space-y-4">
        <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
          <Gamepad2 className="w-4 h-4 text-pink-400" /> Live Game Arena
        </div>
        <h2 className="text-2xl md:text-3xl font-black">Ikuti Kuis Live Pertemuan</h2>
        <p className="text-xs text-gray-300">Masukkan 6 digit Game PIN yang diberikan oleh guru untuk langsung bergabung ke kuis interaktif.</p>

        <form onSubmit={handleJoinGamePIN} className="flex flex-col sm:flex-row gap-3 pt-2">
          <input 
            type="text"
            placeholder="Masukkan Game PIN (cth: 482910)"
            value={gamePinInput}
            onChange={(e) => setGamePinInput(e.target.value)}
            className="flex-1 px-5 py-3.5 rounded-2xl bg-black/50 border border-white/20 text-center sm:text-left font-mono font-bold tracking-widest text-lg uppercase focus:outline-none focus:border-pink-500"
          />
          <button 
            type="submit"
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-sm hover:scale-105 transition flex items-center justify-center gap-2"
          >
            Gabung Game <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Enrolled Classes Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold">Kelas Saya ({joinedClasses.length})</h3>
          <p className="text-xs text-gray-400">Pilih kelas untuk membaca materi, berdiskusi, & presensi</p>
        </div>

        <button 
          onClick={() => setShowJoinClassModal(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Gabung Kelas
        </button>
      </div>

      {/* Joined Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {joinedClasses.map((cls) => (
          <div
            key={cls.id}
            onClick={() => onOpenClassDetail(cls)}
            className="group glass-card p-6 rounded-3xl border border-white/10 hover:border-blue-500/50 transition duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-mono font-bold">
                  {cls.code}
                </span>
                <span className="text-xs text-gray-400">{cls.teacherName}</span>
              </div>

              <h4 className="font-bold text-lg group-hover:text-blue-300 transition">{cls.name}</h4>
            </div>

            <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between text-xs text-gray-400">
              <div className="flex gap-3">
                <span>📚 {cls.materialsCount} Materi</span>
                <span>🎮 {cls.quizzesCount} Kuis</span>
              </div>

              <div className="w-7 h-7 rounded-full bg-white/5 group-hover:bg-blue-600 group-hover:text-white transition flex items-center justify-center">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Join Class Modal */}
      {showJoinClassModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-3xl border border-white/20 w-full max-w-sm space-y-5">
            <h3 className="text-lg font-bold">Gabung Kelas Baru</h3>
            <p className="text-xs text-gray-400">Masukkan kode akses 6 karakter yang dibagikan oleh guru Anda.</p>

            <form onSubmit={handleJoinClass} className="space-y-4">
              <input 
                type="text" 
                required
                maxLength={8}
                placeholder="Kode Kelas (cth: MTK-11A)"
                value={classCodeInput}
                onChange={(e) => setClassCodeInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-center font-mono font-bold tracking-widest text-base uppercase focus:outline-none focus:border-blue-500"
              />

              <div className="flex gap-2 pt-1">
                <button 
                  type="button"
                  onClick={() => setShowJoinClassModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-xs transition"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs transition"
                >
                  Gabung Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
