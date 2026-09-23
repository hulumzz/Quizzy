import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
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
  BookOpen,
  MessageSquare,
  UserCheck,
  Zap,
  Shield,
  Users,
  ArrowRight,
} from 'lucide-react';
import '../styles/landing.css';

const FadeUp = ({ children, delay = 0, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

const pillars = [
  { icon: BookOpen, color: 'indigo', title: 'Ruang Materi', desc: 'Teks, gambar, lampiran, dan video dalam satu halaman materi yang terstruktur.' },
  { icon: MessageSquare, color: 'sky', title: 'Diskusi Kelas', desc: 'Diskusi melekat langsung di setiap materi — siswa bisa bertanya kapan saja.' },
  { icon: Gamepad2, color: 'violet', title: 'Kuis Interaktif', desc: 'Sesi evaluasi bersama atau mandiri dengan umpan balik langsung.' },
  { icon: UserCheck, color: 'emerald', title: 'Presensi', desc: 'Catat kehadiran per sesi kelas dengan riwayat yang mudah diakses.' },
];

const featureCards = [
  { icon: Wand2, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', title: 'Nalaro Assist', desc: 'Bantu guru menyiapkan rangkuman materi dan daftar soal kuis.' },
  { icon: Gamepad2, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', title: 'Kuis Live & Mandiri', desc: 'Ikuti sesi bersama via PIN atau kerjakan evaluasi di waktu sendiri.' },
  { icon: Timer, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', title: 'Kontrol Sesi', desc: 'Guru kendalikan timer, kunci jawaban, dan tampilkan hasil kapan saja.' },
  { icon: QrCode, color: '#10b981', bg: 'rgba(16,185,129,0.12)', title: 'Kode Kelas & PIN', desc: 'Bergabung ke kelas atau sesi kuis hanya dengan satu kode pendek.' },
];

const questionTypes = [
  { icon: ListOrdered, color: '#60a5fa', title: 'Pilihan Ganda', desc: 'Format klasik, cepat, dan familiar.' },
  { icon: Crosshair, color: '#f472b6', title: 'Hotspot Gambar', desc: 'Ketuk titik koordinat jawaban di gambar.' },
  { icon: ArrowUpDown, color: '#fbbf24', title: 'Susun Urutan', desc: 'Urutkan item sesuai logika soal.' },
  { icon: ImageIcon, color: '#34d399', title: 'Pilihan Gambar', desc: 'Pilih jawaban dalam bentuk visual.' },
];

const colorMap = {
  indigo:  { border: 'rgba(99,102,241,0.35)',  icon: 'rgba(99,102,241,0.15)',  text: '#818cf8' },
  sky:     { border: 'rgba(56,189,248,0.35)',  icon: 'rgba(56,189,248,0.15)',  text: '#7dd3fc' },
  violet:  { border: 'rgba(139,92,246,0.35)',  icon: 'rgba(139,92,246,0.15)',  text: '#a78bfa' },
  emerald: { border: 'rgba(52,211,153,0.35)',  icon: 'rgba(52,211,153,0.15)',  text: '#6ee7b7' },
};

export default function Landing({ onEnterApp }) {
  const heroRef = useRef(null);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 80]);

  return (
    <div className="nlr-landing">
      {/* ambient blobs */}
      <div className="nlr-blob nlr-blob-a" />
      <div className="nlr-blob nlr-blob-b" />
      <div className="nlr-blob nlr-blob-c" />
      <div className="nlr-grid-bg" />

      {/* ── NAV ── */}
      <nav className="nlr-nav">
        <div className="nlr-nav-inner">
          <a href="#hero" className="nlr-logo" aria-label="Nalaro">
            <div className="nlr-logo-mark">N</div>
            <span className="nlr-logo-text">Nalaro</span>
          </a>
          <div className="nlr-nav-links">
            <a href="#platform">Platform</a>
            <a href="#fitur">Fitur</a>
            <a href="#soal">Tipe Soal</a>
          </div>
          <button onClick={onEnterApp} className="nlr-btn-primary nlr-btn-sm">
            Masuk <ArrowRight className="nlr-icon-xs" />
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header id="hero" className="nlr-hero" ref={heroRef}>
        <motion.div
          style={{ y: heroY }}
          className="nlr-hero-content"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="nlr-hero-badge">
            <Zap className="nlr-icon-xs" />
            Platform pembelajaran kelas aktif
          </div>
          <h1 className="nlr-hero-title">
            Belajar,{' '}
            <span className="nlr-gradient-text">Bermain,</span>
            <br />
            dan Tumbuh.
          </h1>
          <p className="nlr-hero-sub">
            Nalaro menyatukan materi, diskusi, kuis interaktif, dan presensi dalam satu ruang kelas digital. Ringan dipakai, mudah diatur.
          </p>
          <div className="nlr-hero-actions">
            <button onClick={onEnterApp} className="nlr-btn-primary nlr-btn-lg">
              Mulai Sekarang <ChevronRight className="nlr-icon-sm" />
            </button>
            <a href="#platform" className="nlr-btn-ghost nlr-btn-lg">
              Lihat Fitur
            </a>
          </div>
          <div className="nlr-hero-stats">
            {[
              { val: '4', label: 'Fitur Utama' },
              { val: '4+', label: 'Tipe Soal' },
              { val: '1', label: 'Platform' },
            ].map((s) => (
              <div key={s.label} className="nlr-stat">
                <span className="nlr-stat-val">{s.val}</span>
                <span className="nlr-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* floating visual mockup */}
        <motion.div
          className="nlr-hero-visual"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="nlr-mockup">
            <div className="nlr-mockup-bar"><span /><span /><span /></div>
            <div className="nlr-mockup-body">
              <div className="nlr-mock-sidebar">
                {['Dashboard', 'Kelas', 'Kuis', 'Presensi'].map((item, i) => (
                  <div key={item} className={`nlr-mock-nav-item${i === 0 ? ' active' : ''}`}>
                    <span className="nlr-mock-dot" />{item}
                  </div>
                ))}
              </div>
              <div className="nlr-mock-main">
                <div className="nlr-mock-header">Selamat datang di Nalaro 👋</div>
                <div className="nlr-mock-cards">
                  {['Kuis Live', 'Materi Baru', 'Presensi'].map((c) => (
                    <div key={c} className="nlr-mock-card">{c}</div>
                  ))}
                </div>
                <div className="nlr-mock-quiz-preview">
                  <div className="nlr-mock-q">Pertanyaan 1 dari 10</div>
                  <div className="nlr-mock-qtext">Apa ibu kota Indonesia?</div>
                  <div className="nlr-mock-opts">
                    {['Jakarta', 'Bandung', 'Surabaya', 'Medan'].map((o, i) => (
                      <div key={o} className={`nlr-mock-opt${i === 0 ? ' correct' : ''}`}>{o}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="nlr-float-badge nlr-float-left">
            <div className="nlr-float-icon">🎮</div>
            <div>
              <div className="nlr-float-title">Kuis Live</div>
              <div className="nlr-float-sub">32 siswa bergabung</div>
            </div>
          </div>
          <div className="nlr-float-badge nlr-float-right">
            <div className="nlr-float-icon">📊</div>
            <div>
              <div className="nlr-float-title">Hasil Langsung</div>
              <div className="nlr-float-sub">Skor real-time</div>
            </div>
          </div>
        </motion.div>
      </header>

      {/* ── PLATFORM PILLARS ── */}
      <section id="platform" className="nlr-section">
        <div className="nlr-container">
          <FadeUp className="nlr-section-head">
            <div className="nlr-section-label"><Shield className="nlr-icon-xs" /> Platform</div>
            <h2 className="nlr-section-title">
              Satu platform, <span className="nlr-gradient-text">empat ruang</span>
            </h2>
            <p className="nlr-section-sub">
              Nalaro dibangun di atas empat pilar yang saling terhubung, bukan alat terpisah yang perlu berpindah-pindah.
            </p>
          </FadeUp>
          <div className="nlr-pillars-grid">
            {pillars.map((p, i) => {
              const Icon = p.icon;
              const c = colorMap[p.color];
              return (
                <FadeUp key={p.title} delay={i * 0.08}>
                  <div className="nlr-pillar-card" style={{ '--border-color': c.border }}>
                    <div className="nlr-pillar-num">{String(i + 1).padStart(2, '0')}</div>
                    <div className="nlr-pillar-icon" style={{ background: c.icon, color: c.text }}>
                      <Icon size={22} />
                    </div>
                    <h3 className="nlr-pillar-title">{p.title}</h3>
                    <p className="nlr-pillar-desc">{p.desc}</p>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="fitur" className="nlr-section nlr-section-alt">
        <div className="nlr-container">
          <FadeUp className="nlr-section-head">
            <div className="nlr-section-label"><Users className="nlr-icon-xs" /> Kemampuan</div>
            <h2 className="nlr-section-title">
              Dibuat untuk <span className="nlr-gradient-text">guru dan siswa</span>
            </h2>
            <p className="nlr-section-sub">
              Setiap fitur dirancang agar guru bisa mengajar lebih fokus dan siswa bisa belajar lebih aktif.
            </p>
          </FadeUp>
          <div className="nlr-features-grid">
            {featureCards.map((f, i) => {
              const Icon = f.icon;
              return (
                <FadeUp key={f.title} delay={i * 0.07}>
                  <div className="nlr-feature-card">
                    <div className="nlr-feature-icon" style={{ background: f.bg, color: f.color }}>
                      <Icon size={24} />
                    </div>
                    <h3 className="nlr-feature-title">{f.title}</h3>
                    <p className="nlr-feature-desc">{f.desc}</p>
                    <div className="nlr-feature-arrow"><ChevronRight size={16} /></div>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── QUESTION TYPES ── */}
      <section id="soal" className="nlr-section">
        <div className="nlr-container">
          <FadeUp className="nlr-section-head">
            <div className="nlr-section-label"><Zap className="nlr-icon-xs" /> Format Soal</div>
            <h2 className="nlr-section-title">
              Variasi soal yang <span className="nlr-gradient-text">lebih dari pilihan ganda</span>
            </h2>
            <p className="nlr-section-sub">
              Nalaro mendukung berbagai format evaluasi agar pengalaman belajar tidak terasa monoton.
            </p>
          </FadeUp>
          <div className="nlr-types-grid">
            {questionTypes.map((t, i) => {
              const Icon = t.icon;
              return (
                <FadeUp key={t.title} delay={i * 0.07}>
                  <div className="nlr-type-card" style={{ '--accent': t.color }}>
                    <Icon size={32} style={{ color: t.color }} className="nlr-type-icon" />
                    <h3 className="nlr-type-title">{t.title}</h3>
                    <p className="nlr-type-desc">{t.desc}</p>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section className="nlr-cta-band">
        <div className="nlr-container">
          <FadeUp>
            <div className="nlr-cta-inner">
              <div className="nlr-cta-blob" />
              <h2 className="nlr-cta-title">Siap mulai kelas pertama?</h2>
              <p className="nlr-cta-sub">Daftar gratis dan buat kelas dalam hitungan menit.</p>
              <button onClick={onEnterApp} className="nlr-btn-primary nlr-btn-lg nlr-cta-btn">
                Buka Nalaro <ArrowRight className="nlr-icon-sm" />
              </button>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="nlr-footer">
        <div className="nlr-container nlr-footer-inner">
          <div className="nlr-logo">
            <div className="nlr-logo-mark sm">N</div>
            <span className="nlr-logo-text">Nalaro</span>
          </div>
          <p className="nlr-footer-tagline">Belajar, Bermain, dan Tumbuh.</p>
          <p className="nlr-footer-copy">© 2026 Nalaro. Ruang kelas digital untuk semua.</p>
        </div>
      </footer>
    </div>
  );
}
