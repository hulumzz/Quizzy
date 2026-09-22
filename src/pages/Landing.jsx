import React from 'react';
import { motion } from 'framer-motion';
import { 
  Gamepad2, 
  Wand2, 
  Timer, 
  QrCode, 
  ListOrdered, 
  Crosshair, 
  ArrowUpDown, 
  Image as ImageIcon,
  ChevronRight,
  Sparkles,
  UserCheck,
  BookOpen,
  MessageSquare
} from 'lucide-react';

export default function Landing({ onEnterApp }) {
  return (
    <div className="relative min-h-screen selection:bg-purple-500 selection:text-white bg-bg-dark text-white overflow-hidden">
      {/* Background Orbs & Grid */}
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>
      <div className="bg-orb orb-3"></div>
      <div className="fixed inset-0 grid-bg z-[-1] pointer-events-none"></div>

      {/* Navigation */}
      <nav className="fixed w-full z-50 glass-nav top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 group cursor-pointer">
            <img 
              src="/logo.png" 
              alt="Quizzy Logo" 
              className="h-10 w-auto group-hover:scale-110 transition duration-300 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]" 
            />
            <span className="text-xl font-bold tracking-wide group-hover:text-purple-400 transition">Quizzy</span>
          </div>

          <div className="hidden md:flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <a href="#features" className="px-5 py-2 rounded-full text-sm font-medium hover:bg-white/10 hover:text-white text-gray-300 transition">Fitur</a>
            <a href="#lms" className="px-5 py-2 rounded-full text-sm font-medium hover:bg-white/10 hover:text-white text-gray-300 transition">Workspace</a>
            <a href="#types" className="px-5 py-2 rounded-full text-sm font-medium hover:bg-white/10 hover:text-white text-gray-300 transition">Tipe Soal</a>
          </div>

          <div className="flex gap-4 items-center">
            <button 
              onClick={onEnterApp}
              className="px-6 py-2.5 rounded-full bg-white text-black text-sm font-bold shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:scale-105 transition flex items-center gap-2"
            >
              <Gamepad2 className="w-4 h-4 text-purple-600" /> Masuk App
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header id="hero" className="relative min-h-screen flex items-center justify-center pt-28 pb-16 overflow-hidden">
        <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="hero-content text-center lg:text-left"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Ruang belajar modern untuk kelas
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-[1.1] mb-6">
              Pembelajaran <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-glow">
                Lebih Hidup
              </span>
            </h1>
            
            <p className="text-gray-300 text-base sm:text-lg mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Quizzy dirancang untuk menyatukan <b>materi</b>, <b>diskusi kelas</b>, <b>presensi</b>, dan <b>kuis interaktif</b> dalam satu pengalaman belajar yang ringan.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button
                onClick={onEnterApp}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 font-bold text-lg hover:scale-105 transition shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2"
              >
                Mulai Pembelajaran <ChevronRight className="w-5 h-5" />
              </button>
              <a 
                href="#features" 
                className="px-8 py-4 rounded-xl border border-white/20 hover:bg-white/10 font-bold text-lg transition text-center"
              >
                Jelajahi Fitur
              </a>
            </div>
          </motion.div>

          {/* Hero Image Showcase */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hero-image"
          >
            <div className="relative z-10 transform hover:scale-[1.02] transition duration-700">
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/30 to-blue-600/30 rounded-[3rem] blur-xl transform rotate-6 scale-95 opacity-70 animate-pulse"></div>
              <img 
                src="/hero.png" 
                alt="Quizzy Platform Preview" 
                className="relative rounded-[2rem] shadow-2xl border border-white/10 w-full object-cover" 
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              
              <div className="absolute -bottom-6 -left-2 glass-card p-4 rounded-2xl w-60 animate-float border-l-4 border-purple-500 hidden md:block">
                <div className="flex justify-between text-xs mb-1 font-bold text-purple-300">
                  <span>Ruang belajar terpadu</span>
                </div>
                <div className="text-xs text-gray-300">Materi, Diskusi & Live Quiz terintegrasi</div>
              </div>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Feature Pillar Section */}
      <section id="lms" className="py-20 relative border-t border-white/5 bg-black/20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              4 Pilar <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Quizzy</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Platform lengkap untuk menciptakan ruang kelas digital yang aktif dan kolaboratif.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card p-6 rounded-2xl border border-purple-500/20 hover:border-purple-500/50 transition">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">1. Ruang Materi</h3>
              <p className="text-sm text-gray-400">Materi terstruktur yang mendukung teks, gambar, lampiran, dan video.</p>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-blue-500/20 hover:border-blue-500/50 transition">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">2. Ruang Diskusi</h3>
              <p className="text-sm text-gray-400">Ruang diskusi terbenam di setiap materi agar siswa aktif bertanya & menjawab.</p>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-pink-500/20 hover:border-pink-500/50 transition">
              <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400 mb-4">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">3. Kuis Interaktif</h3>
              <p className="text-sm text-gray-400">Evaluasi yang dirancang lebih hidup dengan sesi kuis dan umpan balik.</p>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-green-500/20 hover:border-green-500/50 transition">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400 mb-4">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">4. Presensi</h3>
              <p className="text-sm text-gray-400">Sesi kehadiran kelas dengan riwayat dan validasi lokasi sederhana.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Features Grid */}
      <section id="features" className="py-24 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Ruang Belajar yang <span className="text-blue-400">Terhubung</span></h2>
            <p className="text-gray-400">Kemampuan inti yang sedang dibangun menjadi satu pengalaman kelas digital.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card p-6 rounded-2xl hover:-translate-y-2 transition duration-300 group">
              <div className="w-14 h-14 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-400 text-2xl mb-4 group-hover:rotate-12 transition">
                <Wand2 />
              </div>
              <h3 className="text-xl font-bold mb-2">Quizzy Assist</h3>
              <p className="text-sm text-gray-400">Asisten yang dirancang untuk membantu meringkas materi dan menyiapkan pertanyaan.</p>
            </div>

            <div className="glass-card p-6 rounded-2xl hover:-translate-y-2 transition duration-300 group">
              <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 text-2xl mb-4 group-hover:rotate-12 transition">
                <Gamepad2 />
              </div>
              <h3 className="text-xl font-bold mb-2">Kuis live & mandiri</h3>
              <p className="text-sm text-gray-400">Ikuti sesi bersama melalui PIN atau kerjakan evaluasi sesuai waktu belajar.</p>
            </div>

            <div className="glass-card p-6 rounded-2xl hover:-translate-y-2 transition duration-300 group">
              <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 text-2xl mb-4 group-hover:rotate-12 transition">
                <Timer />
              </div>
              <h3 className="text-xl font-bold mb-2">Kontrol sesi</h3>
              <p className="text-sm text-gray-400">Guru akan mengendalikan timer, penguncian jawaban, dan momen hasil kuis.</p>
            </div>

            <div className="glass-card p-6 rounded-2xl hover:-translate-y-2 transition duration-300 group">
              <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400 text-2xl mb-4 group-hover:rotate-12 transition">
                <QrCode />
              </div>
              <h3 className="text-xl font-bold mb-2">Kode kelas & PIN</h3>
              <p className="text-sm text-gray-400">Alur bergabung dirancang ringkas melalui kode kelas atau PIN kuis.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Question Types */}
      <section id="types" className="py-20 relative bg-black/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Arah Kuis <span className="text-purple-400">Quizzy</span></h2>
            <p className="text-gray-400">Format berikut menjadi arah pengembangan pengalaman evaluasi Quizzy.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-6 rounded-2xl hover:bg-white/5 transition hover:-translate-y-2 border-t-4 border-blue-500">
              <ListOrdered className="w-8 h-8 text-blue-400 mb-3" />
              <h3 className="font-bold text-lg">Pilihan Ganda</h3>
              <p className="text-xs text-gray-400 mt-1">Format klasik yang cepat & jelas.</p>
            </div>
            <div className="glass-card p-6 rounded-2xl hover:bg-white/5 transition hover:-translate-y-2 border-t-4 border-pink-500">
              <Crosshair className="w-8 h-8 text-pink-400 mb-3" />
              <h3 className="font-bold text-lg">Hotspot Image</h3>
              <p className="text-xs text-gray-400 mt-1">Ketuk titik koordinat jawaban pada gambar.</p>
            </div>
            <div className="glass-card p-6 rounded-2xl hover:bg-white/5 transition hover:-translate-y-2 border-t-4 border-yellow-500">
              <ArrowUpDown className="w-8 h-8 text-yellow-400 mb-3" />
              <h3 className="font-bold text-lg">Menyusun (Sequencing)</h3>
              <p className="text-xs text-gray-400 mt-1">Urutkan jawaban berdasarkan konteks.</p>
            </div>
            <div className="glass-card p-6 rounded-2xl hover:bg-white/5 transition hover:-translate-y-2 border-t-4 border-green-500">
              <ImageIcon className="w-8 h-8 text-green-400 mb-3" />
              <h3 className="font-bold text-lg">Pilihan Gambar</h3>
              <p className="text-xs text-gray-400 mt-1">Pilih gambar jawaban secara visual.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 text-center text-gray-500 text-sm">
        <p>© 2026 Quizzy. Ruang belajar modern untuk guru dan siswa.</p>
      </footer>
    </div>
  );
}
