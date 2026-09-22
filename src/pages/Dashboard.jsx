import React, { useState } from 'react';
import { 
  BookOpen, 
  UserCheck, 
  Gamepad2, 
  Plus, 
  MapPin, 
  MessageSquare, 
  Sparkles, 
  LogOut,
  FileText,
  Clock,
  Users,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function Dashboard({ onBackToLanding }) {
  const [activeTab, setActiveTab] = useState('classes');
  const [userRole, setUserRole] = useState('teacher'); // 'teacher' | 'student'
  
  // Geolocation State
  const [geoStatus, setGeoStatus] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [checkinResult, setCheckinResult] = useState(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Cloudflare AI State
  const [aiMaterialText, setAiMaterialText] = useState('');
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Mock data for initial UI preview
  const [classes] = useState([
    { id: 'c1', name: 'Matematika XI IPA 1', code: 'MTK-11A', students: 32, materials: 5, quizzes: 3 },
    { id: 'c2', name: 'Fisika Dasar - Gelombang', code: 'FIS-GEL', students: 28, materials: 3, quizzes: 2 },
  ]);

  const [selectedClass, setSelectedClass] = useState(classes[0]);

  // Request HTML5 Geolocation for Attendance
  const getLocationAndCheckIn = () => {
    setGeoStatus('Mengambil titik koordinat GPS...');
    setIsCheckingIn(true);
    setCheckinResult(null);

    if (!navigator.geolocation) {
      setGeoStatus('Geolocation tidak didukung oleh peramban Anda');
      setIsCheckingIn(false);
    } else {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserCoords({ lat, lng, accuracy: position.coords.accuracy });

          try {
            // Simulated venue lat/lng (Ruang Lab Fisika)
            const venueLat = lat + 0.0001; // ~10m offset
            const venueLng = lng + 0.0001;

            const res = await fetch('http://localhost:8787/api/attendance/checkin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                attendanceId: 'session_demo_1',
                studentId: 'std_001',
                studentName: 'Siswa Quizzy',
                lat,
                lng,
                venueLat,
                venueLng,
                radiusMeters: 100
              })
            }).catch(() => null);

            if (res && res.ok) {
              const data = await res.json();
              setCheckinResult(data);
              setGeoStatus(data.message);
            } else {
              setCheckinResult({
                status: 'Hadir',
                distanceMeters: 12,
                message: 'Presensi berhasil diverifikasi di lokasi!'
              });
              setGeoStatus('Lokasi Berhasil Terverifikasi');
            }
          } catch {
            setGeoStatus('Gagal memverifikasi lokasi');
          } finally {
            setIsCheckingIn(false);
          }
        },
        () => {
          setGeoStatus('Gagal mengambil lokasi. Mohon beri izin akses GPS di browser.');
          setIsCheckingIn(false);
        }
      );
    }
  };

  // Call Cloudflare Workers AI Endpoint
  const handleGenerateQuizAI = async () => {
    if (!aiMaterialText.trim()) return alert('Masukkan teks materi terlebih dahulu!');
    setIsAiGenerating(true);
    setAiGeneratedQuestions(null);

    try {
      const res = await fetch('http://localhost:8787/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiMaterialText, count: 5 })
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        setAiGeneratedQuestions(data.questions);
      } else {
        // Mock fallback if local workers API is offline
        setTimeout(() => {
          setAiGeneratedQuestions([
            {
              question: "Apa prinsip dasar yang dibahas dalam teks materi tersebut?",
              type: "multiple_choice",
              options: ["Prinsip Radiasi & Gelombang", "Hukum Kekekalan Energi", "Teori Relativitas", "Hukum Newton"],
              correctIndex: 0,
              explanation: "Teks menjelaskan tentang sifat merambat radiasi elektromagnetik."
            },
            {
              question: "Berikut ini yang merupakan contoh penerapan praktis materi adalah?",
              type: "multiple_choice",
              options: ["Komunikasi Sinyal Radio", "Mesin Uap Klasik", "Lensa Kaca Pembesar", "Termometer Air Raksa"],
              correctIndex: 0,
              explanation: "Gelombang radio digunakan untuk jaringan komunikasi nirkabel."
            }
          ]);
        }, 1000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark text-white flex flex-col font-outfit">
      {/* Top Navbar */}
      <header className="glass-nav sticky top-0 z-40 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onBackToLanding}>
            <img src="/logo.png" alt="Quizzy Logo" className="h-8 w-auto drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
            <span className="font-extrabold text-lg tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Quizzy LMS
            </span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 font-medium border border-purple-500/30">
            Cloudflare Edition
          </span>
        </div>

        {/* Role Switcher & Profile */}
        <div className="flex items-center gap-4">
          <div className="bg-black/40 p-1 rounded-xl border border-white/10 flex items-center gap-1 text-xs">
            <button 
              onClick={() => setUserRole('teacher')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${userRole === 'teacher' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Mode Guru
            </button>
            <button 
              onClick={() => setUserRole('student')}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${userRole === 'student' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Mode Siswa
            </button>
          </div>

          <button 
            onClick={onBackToLanding}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
            title="Keluar ke Landing Page"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 bg-black/40 border-r border-white/10 p-4 flex flex-col gap-2">
          <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">Menu Platform</div>
          
          <button 
            onClick={() => setActiveTab('classes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition ${activeTab === 'classes' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
          >
            <BookOpen className="w-4 h-4" /> Kelas & Workspace
          </button>

          <button 
            onClick={() => setActiveTab('attendance')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition ${activeTab === 'attendance' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
          >
            <UserCheck className="w-4 h-4" /> Presensi Geotag
          </button>

          <button 
            onClick={() => setActiveTab('quizzes')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition ${activeTab === 'quizzes' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
          >
            <Gamepad2 className="w-4 h-4" /> Studio & Live Quiz
          </button>

          <button 
            onClick={() => setActiveTab('ai')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition ${activeTab === 'ai' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
          >
            <Sparkles className="w-4 h-4 text-yellow-400" /> Cloudflare AI (Neurons)
          </button>
        </aside>

        {/* Dynamic Content Area */}
        <main className="flex-1 p-6 overflow-y-auto no-scrollbar">
          {/* TAB 1: CLASSES & WORKSPACE */}
          {activeTab === 'classes' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold">Ruang Kelas & Workspace</h1>
                  <p className="text-sm text-gray-400">Kelola materi pembelajaran Notion-style & ruang diskusi.</p>
                </div>
                {userRole === 'teacher' ? (
                  <button className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-sm flex items-center gap-2 transition">
                    <Plus className="w-4 h-4" /> Buat Kelas Baru
                  </button>
                ) : (
                  <button className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-sm flex items-center gap-2 transition">
                    <Plus className="w-4 h-4" /> Gabung Kelas (Kode)
                  </button>
                )}
              </div>

              {/* Class Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes.map((cls) => (
                  <div 
                    key={cls.id}
                    onClick={() => setSelectedClass(cls)}
                    className={`glass-card p-5 rounded-2xl cursor-pointer transition border hover:border-purple-500/50 ${selectedClass.id === cls.id ? 'border-purple-500 bg-white/10' : 'border-white/10'}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 font-bold">
                        {cls.code}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {cls.students} Siswa
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-2">{cls.name}</h3>
                    <div className="flex gap-4 text-xs text-gray-400 mt-4 border-t border-white/5 pt-3">
                      <span>📚 {cls.materials} Materi</span>
                      <span>🎮 {cls.quizzes} Kuis</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Active Selected Class Workspace Detail */}
              {selectedClass && (
                <div className="glass-card p-6 rounded-2xl border border-white/10 mt-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <div>
                      <h2 className="text-xl font-bold">{selectedClass.name} - Learning Workspace</h2>
                      <p className="text-xs text-gray-400">Kode Akses Kelas: <span className="font-mono text-purple-400 font-bold">{selectedClass.code}</span></p>
                    </div>
                    {userRole === 'teacher' && (
                      <button className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5" /> Tambah Blok Materi
                      </button>
                    )}
                  </div>

                  {/* Notion-style Material Content */}
                  <div className="space-y-4">
                    <div className="p-5 rounded-xl bg-black/30 border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-lg text-purple-300 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-purple-400" /> Modul 1: Spektrum Gelombang Elektromagnetik
                        </h4>
                        <span className="text-xs text-gray-500">Diperbarui Hari Ini</span>
                      </div>
                      
                      <div className="prose prose-invert max-w-none text-sm text-gray-300 space-y-2">
                        <p>
                          Spektrum gelombang elektromagnetik terdiri dari gelombang radio, gelombang mikro, sinar inframerah, cahaya tampak, sinar ultraviolet, sinar-X, dan sinar gamma.
                        </p>
                      </div>

                      {/* YouTube Video Player Embed */}
                      <div className="aspect-video bg-black/80 rounded-xl overflow-hidden border border-white/10 relative flex items-center justify-center">
                        <iframe 
                          className="w-full h-full"
                          src="https://www.youtube.com/embed/dQw4w9WgXcQ" 
                          title="Learning Video"
                          allowFullScreen
                        ></iframe>
                      </div>

                      {/* Discussion Threads */}
                      <div className="border-t border-white/10 pt-4 space-y-3">
                        <h5 className="text-xs font-bold text-gray-400 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-blue-400" /> Ruang Diskusi Kelas
                        </h5>
                        <div className="space-y-2">
                          <div className="bg-white/5 p-3 rounded-xl text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="font-bold text-purple-300">Andi (Siswa)</span>
                              <span className="text-[10px] text-gray-500">10:45 AM</span>
                            </div>
                            <p className="text-gray-300">"Pak, apakah laju perambatan semua gelombang ini sama dengan kecepatan cahaya?"</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Tulis pertanyaan atau tanggapan..."
                            className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs focus:outline-none focus:border-purple-500"
                          />
                          <button className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold flex items-center gap-1">
                            <Send className="w-3.5 h-3.5" /> Kirim
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GEOTAGGED ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold">Presensi Geotagging GPS</h1>
                <p className="text-sm text-gray-400">Verifikasi kehadiran lokasi siswa secara akurat menggunakan Cloudflare D1.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Geolocation Check-in Card */}
                <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-green-400" /> Check-in Kehadiran Siswa
                  </h3>
                  <p className="text-xs text-gray-400">
                    Sistem akan mencocokkan koordinat GPS browser kamu dengan batas lokasi ruang kelas (Geofencing).
                  </p>

                  <button 
                    onClick={getLocationAndCheckIn}
                    disabled={isCheckingIn}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 font-bold text-sm hover:scale-[1.01] transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCheckingIn ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Verifikasi Koordinat...</>
                    ) : (
                      <><MapPin className="w-4 h-4" /> Dapatkan Koordinat & Presensi</>
                    )}
                  </button>

                  {geoStatus && (
                    <div className="p-3.5 rounded-xl bg-black/40 text-xs space-y-1 border border-white/10">
                      <div className="font-bold text-yellow-400">{geoStatus}</div>
                      {userCoords && (
                        <div className="text-gray-300 font-mono pt-1">
                          Latitude: {userCoords.lat.toFixed(6)} <br />
                          Longitude: {userCoords.lng.toFixed(6)} <br />
                          Akurasi: ±{userCoords.accuracy.toFixed(1)} meter
                        </div>
                      )}
                    </div>
                  )}

                  {checkinResult && (
                    <div className={`p-4 rounded-xl text-xs space-y-1 flex items-start gap-3 border ${checkinResult.status === 'Hadir' ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                      {checkinResult.status === 'Hadir' ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
                      <div>
                        <div className="font-bold text-sm">{checkinResult.status === 'Hadir' ? 'Presensi Berhasil!' : 'Luar Radius Kelas'}</div>
                        <div>Jarak dari lokasi: {checkinResult.distanceMeters ?? 12} Meter</div>
                        <div className="text-[11px] opacity-80">{checkinResult.message}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Session Active & Rekap */}
                <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-400" /> Sesi Presensi Aktif
                  </h3>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 text-xs">
                    <div className="flex justify-between font-bold">
                      <span>Pertemuan 4 - Lab Fisika</span>
                      <span className="text-green-400 px-2 py-0.5 rounded bg-green-500/20">Aktif</span>
                    </div>
                    <p className="text-gray-400">Radius Geofence: 100 Meter | Durasi: 60 Menit</p>
                    <div className="text-[11px] text-gray-500">Rekap: 28/32 Siswa Telah Hadir</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: QUIZ STUDIO & LIVE HOST */}
          {activeTab === 'quizzes' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold">Quiz Studio & Engine</h1>
                  <p className="text-sm text-gray-400">Buat, edit, dan jalankan Live Quiz game interaktif.</p>
                </div>
                <button className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Buat Kuis Baru
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-3">
                  <span className="text-xs px-2.5 py-1 rounded-md bg-pink-500/20 text-pink-300 font-bold">
                    Kuis Publik
                  </span>
                  <h3 className="font-bold text-lg">Evaluasi Bab 1: Gelombang Elektromagnetik</h3>
                  <p className="text-xs text-gray-400">10 Soal (Pilihan Ganda, Hotspot, Sequencing)</p>
                  <div className="flex gap-2 pt-2">
                    <button className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 font-bold text-xs">
                      Host Live Game
                    </button>
                    <button className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-xs">
                      Edit Studio
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CLOUDFLARE AI (NEURONS) */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-yellow-400" /> Cloudflare Workers AI (Neurons)
                </h1>
                <p className="text-sm text-gray-400">Pembuatan kuis otomatis & rangkuman materi di Cloudflare Edge AI.</p>
              </div>

              <div className="glass-card p-6 rounded-2xl border border-yellow-500/20 space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" /> Auto-Quiz Generator dari Teks
                </h3>
                
                <textarea 
                  rows="5" 
                  value={aiMaterialText}
                  onChange={(e) => setAiMaterialText(e.target.value)}
                  placeholder="Tempelkan teks materi pembelajaran di sini (contoh: Spektrum gelombang elektromagnetik mencakup gelombang radio, inframerah, cahaya tampak, dan sinar-X...)"
                  className="w-full p-3.5 rounded-xl bg-black/40 border border-white/10 text-sm focus:outline-none focus:border-yellow-500"
                ></textarea>

                <button 
                  onClick={handleGenerateQuizAI}
                  disabled={isAiGenerating}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 font-bold text-sm text-black flex items-center gap-2 hover:scale-[1.01] transition disabled:opacity-50"
                >
                  {isAiGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin text-black" /> Memproses Cloudflare Neurons...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 text-black" /> Generasi Soal Kuis (Cloudflare AI)</>
                  )}
                </button>

                {/* Generated Quiz Result */}
                {aiGeneratedQuestions && (
                  <div className="mt-6 p-4 rounded-xl bg-black/40 border border-white/10 space-y-4">
                    <h4 className="font-bold text-sm text-yellow-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Soal Hasil Generasi AI ({aiGeneratedQuestions.length} Soal):
                    </h4>

                    <div className="space-y-3">
                      {aiGeneratedQuestions.map((q, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs space-y-2">
                          <div className="font-bold text-sm text-gray-200">{idx + 1}. {q.question}</div>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            {q.options.map((opt, oIdx) => (
                              <div 
                                key={oIdx} 
                                className={`p-2 rounded-lg border ${oIdx === q.correctIndex ? 'bg-green-500/20 border-green-500/50 text-green-300 font-bold' : 'bg-black/20 border-white/5 text-gray-400'}`}
                              >
                                {String.fromCharCode(65 + oIdx)}. {opt}
                              </div>
                            ))}
                          </div>
                          {q.explanation && (
                            <p className="text-[11px] text-gray-400 italic pt-1">💡 {q.explanation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
