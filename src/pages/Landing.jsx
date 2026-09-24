import { ArrowRight, BookOpen, Check, ChevronRight, Gamepad2, MessageSquare, UserCheck } from 'lucide-react';
import Brand from '../components/Brand';
import '../styles/landing.css';

const pillars = [
  { number: '01', icon: BookOpen, title: 'Ruang Materi', desc: 'Teks, gambar, lampiran, dan video dalam satu halaman materi yang terstruktur.' },
  { number: '02', icon: MessageSquare, title: 'Diskusi Kelas', desc: 'Diskusi melekat langsung di setiap materi — siswa bisa bertanya kapan saja.' },
  { number: '03', icon: Gamepad2, title: 'Kuis Interaktif', desc: 'Sesi evaluasi bersama atau mandiri dengan umpan balik langsung.' },
  { number: '04', icon: UserCheck, title: 'Presensi', desc: 'Catat kehadiran per sesi kelas dengan riwayat yang mudah diakses.' },
];

const capabilities = [
  { title: 'Nalaro Assist', desc: 'Bantu guru menyiapkan rangkuman materi dan daftar soal kuis.' },
  { title: 'Kuis Live & Mandiri', desc: 'Ikuti sesi bersama via PIN atau kerjakan evaluasi di waktu sendiri.' },
  { title: 'Kontrol Sesi', desc: 'Guru kendalikan timer, kunci jawaban, dan tampilkan hasil kapan saja.' },
  { title: 'Kode Kelas & PIN', desc: 'Bergabung ke kelas atau sesi kuis hanya dengan satu kode pendek.' },
];

const questionTypes = [
  { number: '01', title: 'Pilihan Ganda', desc: 'Format klasik, cepat, dan familiar.' },
  { number: '02', title: 'Hotspot Gambar', desc: 'Ketuk titik koordinat jawaban di gambar.' },
  { number: '03', title: 'Susun Urutan', desc: 'Urutkan item sesuai logika soal.' },
  { number: '04', title: 'Pilihan Gambar', desc: 'Pilih jawaban dalam bentuk visual.' },
];

function ProductPreview() {
  return (
    <div className="nlr-preview" aria-label="Ilustrasi ruang kelas Nalaro Class">
      <div className="nlr-preview__bar"><Brand compact /><span>Ruang guru <ChevronRight size={14} /> Kelas XI IPA</span></div>
      <div className="nlr-preview__body">
        <div className="nlr-preview__intro"><span>Matematika · XI IPA</span><h2>Belajar bersama, selangkah demi selangkah.</h2><p>Semua yang dibutuhkan kelasmu, ada di satu tempat.</p></div>
        <div className="nlr-preview__grid">
          <div className="nlr-preview__lesson"><div className="nlr-preview__eyebrow">MATERI KELAS <span>01 / 04</span></div><div className="nlr-preview__lesson-art"><div className="nlr-preview__shape nlr-preview__shape-a" /><div className="nlr-preview__shape nlr-preview__shape-b" /><div className="nlr-preview__shape nlr-preview__shape-c" /></div><strong>Memahami fungsi kuadrat</strong><p>Mulai dari konsep dasar sampai penerapannya.</p><span className="nlr-preview__link">Buka materi <ArrowRight size={15} /></span></div>
          <div className="nlr-preview__right"><div className="nlr-preview__quiz"><div className="nlr-preview__eyebrow">KUIS KELAS <Gamepad2 size={17} /></div><strong>Siap menguji pemahaman?</strong><p>Belajar jadi lebih seru saat dicoba bersama.</p><span>Mulai kuis <ArrowRight size={15} /></span></div><div className="nlr-preview__small"><MessageSquare size={19} /><div><strong>Diskusi kelas</strong><p>Pertanyaan dan ide punya tempatnya.</p></div></div><div className="nlr-preview__small"><UserCheck size={19} /><div><strong>Presensi</strong><p>Kehadiran tercatat dengan rapi.</p></div></div></div>
        </div>
      </div>
    </div>
  );
}

export default function Landing({ onEnterApp }) {
  return (
    <div className="nlr-landing">
      <header className="nlr-site-header"><div className="nlr-wrap nlr-site-header__inner"><a href="#atas" aria-label="Nalaro Class, ke awal"><Brand /></a><nav aria-label="Navigasi halaman"><a href="#platform">Platform</a><a href="#fitur">Fitur</a><a href="#soal">Tipe soal</a></nav><button type="button" className="nlr-header-login" onClick={onEnterApp}>Masuk <ArrowRight size={17} /></button></div></header>
      <main>
        <section className="nlr-hero nlr-wrap" id="atas"><div className="nlr-hero__copy"><h1>Belajar, bermain,<br /><em>dan tumbuh.</em></h1><p>Nalaro menyatukan materi, diskusi, kuis interaktif, dan presensi dalam satu ruang kelas digital. Ringan dipakai, mudah diatur.</p><div className="nlr-hero__actions"><button type="button" className="nlr-action nlr-action--primary" onClick={onEnterApp}>Mulai sekarang <ArrowRight size={18} /></button><a className="nlr-action nlr-action--text" href="#platform">Lihat cara kerjanya <ArrowRight size={18} /></a></div></div><div className="nlr-hero__preview"><div className="nlr-hero__halo" aria-hidden="true" /><ProductPreview /><div className="nlr-hero__float nlr-hero__float--top"><span><b>Lebih terarah</b><small>Materi sampai evaluasi</small></span></div><div className="nlr-hero__float nlr-hero__float--bottom"><span><b>Lebih aktif</b><small>Belajar sambil mencoba</small></span></div></div></section>
        <div className="nlr-marquee-line"><div className="nlr-wrap"><p>Satu tempat untuk menyiapkan materi, menghidupkan diskusi, dan melihat perkembangan belajar.</p><span>GURU <span aria-hidden="true">&</span> SISWA</span></div></div>
        <section className="nlr-section nlr-wrap" id="platform"><div className="nlr-section__heading"><span className="nlr-section__index">01 / PLATFORM</span><div><h2>Satu platform,<br /><em>empat ruang.</em></h2><p>Nalaro dibangun di atas empat pilar yang saling terhubung, bukan alat terpisah yang perlu berpindah-pindah.</p></div></div><div className="nlr-pillar-list">{pillars.map(({ number, icon: Icon, title, desc }) => <article key={title} className="nlr-pillar"><span className="nlr-pillar__number">{number}</span><span className="nlr-pillar__icon"><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span><div><h3>{title}</h3><p>{desc}</p></div><ArrowRight className="nlr-pillar__arrow" size={20} aria-hidden="true" /></article>)}</div></section>
        <section className="nlr-feature-section" id="fitur"><div className="nlr-wrap nlr-feature-section__inner"><div className="nlr-feature-section__intro"><span className="nlr-section__index">02 / KEMAMPUAN</span><h2>Dibuat untuk guru<br />dan siswa yang <em>ingin terus maju.</em></h2><p>Setiap fitur dirancang agar guru bisa mengajar lebih fokus dan siswa bisa belajar lebih aktif.</p><button type="button" className="nlr-action nlr-action--primary" onClick={onEnterApp}>Buka ruang belajar <ArrowRight size={18} /></button></div><div className="nlr-feature-list">{capabilities.map(({ title, desc }, index) => <article key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{desc}</p></div><Check size={18} aria-hidden="true" /></article>)}</div></div></section>
        <section className="nlr-section nlr-wrap nlr-question-section" id="soal"><div className="nlr-section__heading"><span className="nlr-section__index">03 / FORMAT SOAL</span><div><h2>Variasi soal yang<br /><em>lebih dari pilihan ganda.</em></h2><p>Nalaro mendukung berbagai format evaluasi agar pengalaman belajar tidak terasa monoton.</p></div></div><div className="nlr-question-list">{questionTypes.map(({ number, title, desc }) => <article key={title}><span>{number}</span><h3>{title}</h3><p>{desc}</p></article>)}</div></section>
        <section className="nlr-cta"><div className="nlr-wrap nlr-cta__inner"><div><p>LANGKAH PERTAMA</p><h2>Siap mulai kelas pertama?</h2><span>Daftar gratis dan buat kelas dalam hitungan menit.</span></div><button type="button" onClick={onEnterApp}>Buka Nalaro Class <ArrowRight size={19} /></button></div></section>
      </main>
      <footer className="nlr-footer"><div className="nlr-wrap nlr-footer__inner"><Brand /><p>Belajar, bermain, dan tumbuh.</p><span>© {new Date().getFullYear()} Nalaro Class</span></div></footer>
    </div>
  );
}
