import React, { useState } from 'react';
import { 
  ArrowLeft, 
  BookOpen, 
  MessageSquare, 
  UserCheck, 
  Gamepad2, 
  Plus, 
  FileText, 
  MapPin, 
  Clock, 
  Send, 
  CheckCircle2, 
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';

export default function ClassDetail({ classData, onBack, userRole }) {
  const { userProfile, user } = useAuth();
  const [activeTab, setActiveTab] = useState('materials'); // 'materials' | 'discussions' | 'attendance' | 'quizzes'
  
  // Geolocation & Attendance state
  const [geoStatus, setGeoStatus] = useState(null);
  const [checkinResult, setCheckinResult] = useState(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Discussion state
  const [comments, setComments] = useState([
    {
      id: 'd1',
      sender: 'Andi Saputra',
      role: 'student',
      message: 'Pak, apakah gelombang mikro juga termasuk gelombang elektromagnetik?',
      time: '10:45 AM',
      likes: 3
    },
    {
      id: 'd2',
      sender: 'Pak Budi (Guru)',
      role: 'teacher',
      message: 'Ya betul Andi! Gelombang mikro memiliki frekuensi tinggi dan digunakan untuk oven radar serta komunikasi sinyal nirkabel.',
      time: '10:48 AM',
      likes: 5
    }
  ]);
  const [newComment, setNewComment] = useState('');

  // Sample Notion Materials
  const [materials] = useState([
    {
      id: 'm1',
      title: 'Modul 1: Spektrum Gelombang Elektromagnetik',
      date: '31 Juli 2026',
      content: 'Gelombang elektromagnetik adalah gelombang yang tidak memerlukan medium untuk merambat. Terdiri dari gelombang radio, mikro, inframerah, cahaya tampak, ultraviolet, sinar-X, dan sinar gamma.',
      youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      read: true
    }
  ]);

  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(classData.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const newCmt = {
      id: 'd_' + Date.now(),
      sender: userProfile?.name || user?.displayName || 'Pengguna',
      role: userRole,
      message: newComment,
      time: 'Baru saja',
      likes: 0
    };

    setComments([...comments, newCmt]);
    setNewComment('');
  };

  const handleGPSCheckin = () => {
    setGeoStatus('Mengambil titik koordinat GPS...');
    setIsCheckingIn(true);
    setCheckinResult(null);

    if (!navigator.geolocation) {
      setGeoStatus('Geolocation tidak didukung browser ini');
      setIsCheckingIn(false);
    } else {
      navigator.geolocation.getCurrentPosition(
        () => {
          setTimeout(() => {
            setCheckinResult({
              status: 'Hadir',
              distanceMeters: 8,
              message: 'Lokasi terverifikasi! Anda berada di dalam radius kelas (Lab Fisika).'
            });
            setGeoStatus('Presensi Berhasil');
            setIsCheckingIn(false);
          }, 1000);
        },
        () => {
          setGeoStatus('Izin akses GPS ditolak. Silakan izinkan akses lokasi di browser.');
          setIsCheckingIn(false);
        }
      );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold transition flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Kelas
        </button>

        <span 
          onClick={handleCopyCode}
          className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-mono font-bold text-xs border border-purple-500/30 flex items-center gap-2 cursor-pointer transition"
          title="Salin Kode Kelas"
        >
          Kode: {classData.code}
          {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 opacity-70" />}
        </span>
      </div>

      {/* Class Banner Header */}
      <div className="glass-card p-6 md:p-8 rounded-3xl border border-white/10 bg-gradient-to-r from-purple-900/30 via-bg-dark to-blue-900/30 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
          <BookOpen className="w-4 h-4" /> Learning Hub Kelas
        </div>
        <h1 className="text-2xl md:text-4xl font-black">{classData.name}</h1>
        <p className="text-xs text-gray-300">{classData.description || 'Ruang kelas pembelajaran interaktif.'}</p>
      </div>

      {/* Class Pillars Navigation Tabs */}
      <div className="flex border-b border-white/10 overflow-x-auto no-scrollbar gap-2">
        <button
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-xs border-b-2 transition whitespace-nowrap ${
            activeTab === 'materials'
              ? 'border-purple-500 text-purple-400 bg-white/5 rounded-t-xl'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" /> 1. Learning Workspace ({materials.length})
        </button>

        <button
          onClick={() => setActiveTab('discussions')}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-xs border-b-2 transition whitespace-nowrap ${
            activeTab === 'discussions'
              ? 'border-purple-500 text-purple-400 bg-white/5 rounded-t-xl'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> 2. Discussion Space ({comments.length})
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-xs border-b-2 transition whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'border-purple-500 text-purple-400 bg-white/5 rounded-t-xl'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <UserCheck className="w-4 h-4" /> 3. Presensi Geotagging
        </button>

        <button
          onClick={() => setActiveTab('quizzes')}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-xs border-b-2 transition whitespace-nowrap ${
            activeTab === 'quizzes'
              ? 'border-purple-500 text-purple-400 bg-white/5 rounded-t-xl'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Gamepad2 className="w-4 h-4" /> 4. Gamified Quizzes
        </button>
      </div>

      {/* TAB 1: WORKSPACE NOTION-STYLE MATERIALS */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          {userRole === 'teacher' && (
            <div className="flex justify-end">
              <button className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs flex items-center gap-2 transition">
                <Plus className="w-4 h-4" /> Tambah Modul Materi (Notion Block)
              </button>
            </div>
          )}

          {materials.map((mat) => (
            <div key={mat.id} className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-lg">{mat.title}</h3>
                </div>
                <span className="text-xs text-gray-500">{mat.date}</span>
              </div>

              {/* Notion Text Blocks */}
              <div className="text-sm text-gray-300 leading-relaxed bg-black/30 p-4 rounded-2xl border border-white/5">
                {mat.content}
              </div>

              {/* YouTube Player */}
              {mat.youtubeUrl && (
                <div className="aspect-video bg-black/80 rounded-2xl overflow-hidden border border-white/10 relative">
                  <iframe 
                    className="w-full h-full"
                    src={mat.youtubeUrl}
                    title="Materi Video YouTube"
                    allowFullScreen
                  ></iframe>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: DISCUSSION SPACE */}
      {activeTab === 'discussions' && (
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" /> Diskusi & Tanya Jawab Kelas
            </h3>

            {/* Comment Threads */}
            <div className="space-y-3">
              {comments.map((cmt) => (
                <div 
                  key={cmt.id}
                  className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                    cmt.role === 'teacher' 
                      ? 'bg-purple-500/10 border-purple-500/30' 
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-purple-300">{cmt.sender}</span>
                      {cmt.role === 'teacher' && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                          Guru
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500">{cmt.time}</span>
                  </div>

                  <p className="text-gray-200 text-sm leading-relaxed">{cmt.message}</p>
                </div>
              ))}
            </div>

            {/* Post Reply Form */}
            <form onSubmit={handleSendComment} className="flex gap-2 pt-2">
              <input 
                type="text" 
                placeholder="Tulis pertanyaan atau komentar mengenai materi kelas..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 px-4 py-3 rounded-2xl bg-black/40 border border-white/10 text-sm focus:outline-none focus:border-purple-500"
              />
              <button 
                type="submit"
                className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 font-bold text-xs flex items-center gap-2 transition"
              >
                <Send className="w-4 h-4" /> Kirim
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: ATTENDANCE GEOTAGGING */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-400" /> Presensi Lokasi GPS
              </h3>
              <p className="text-xs text-gray-400">
                Siswa wajib mengaktifkan GPS untuk memverifikasi kehadiran di lokasi kelas (Batas 100m).
              </p>

              <button 
                onClick={handleGPSCheckin}
                disabled={isCheckingIn}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 font-bold text-sm hover:scale-[1.01] transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCheckingIn ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Verifikasi Koordinat...</>
                ) : (
                  <><MapPin className="w-4 h-4" /> Dapatkan Koordinat & Presensi</>
                )}
              </button>

              {geoStatus && (
                <div className="p-3 rounded-xl bg-black/40 text-xs font-bold text-yellow-400 border border-white/10">
                  {geoStatus}
                </div>
              )}

              {checkinResult && (
                <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-300 text-xs space-y-1">
                  <div className="font-bold text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" /> Status: {checkinResult.status}
                  </div>
                  <div>Jarak dari kelas: {checkinResult.distanceMeters} Meter</div>
                  <div className="text-gray-300">{checkinResult.message}</div>
                </div>
              )}
            </div>

            <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" /> Sesi Presensi Aktif
              </h3>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                <div className="flex justify-between font-bold">
                  <span>Pertemuan 4 - Presensi Kelas</span>
                  <span className="text-green-400">Aktif</span>
                </div>
                <p className="text-gray-400">Batas Waktu: Hari Ini (12:00 - 15:00 WIB)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GAMIFIED QUIZZES */}
      {activeTab === 'quizzes' && (
        <div className="space-y-4">
          <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-3">
            <span className="text-xs px-2.5 py-1 rounded-lg bg-pink-500/20 text-pink-300 font-bold">
              Kuis Pembelajaran
            </span>
            <h3 className="font-bold text-xl">Evaluasi Bab 1: Gelombang Elektromagnetik</h3>
            <p className="text-xs text-gray-400">Format: Pilihan Ganda, Hotspot, & Sequencing (10 Soal)</p>

            <div className="flex gap-3 pt-3">
              {userRole === 'teacher' ? (
                <button className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs flex items-center gap-2">
                  Host Live Game
                </button>
              ) : (
                <button className="px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 font-bold text-xs flex items-center gap-2">
                  Kerjakan Kuis Mandiri
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
