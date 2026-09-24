import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Gamepad2, GraduationCap, Loader2, MessageSquare, School } from 'lucide-react';
import { Link } from 'react-router-dom';
import Brand from '../components/Brand';
import { useAuth } from '../context/useAuth';
import '../styles/landing.css';

const roleCopy = {
  teacher: { label: 'Guru', description: 'Buat dan kelola kelas', icon: School },
  student: { label: 'Siswa', description: 'Belajar dan ikut kuis', icon: GraduationCap },
};
const profileSeed = (user, role) => ({ uid: user.uid, name: user.displayName || '', nickname: '', email: user.email || '', role, subject: 'Umum', gender: '', avatar: user.photoURL || null, isAnonymous: false, profileCompleted: false, createdAt: new Date().toISOString() });
function authErrorMessage(error, mode) {
  if (error.message?.includes('terdaftar sebagai')) return error.message;
  if (error.code === 'auth/email-already-in-use') return 'Email ini sudah terdaftar. Pilih Masuk untuk melanjutkan.';
  if (error.code === 'auth/invalid-email') return 'Format email belum tepat.';
  if (error.code === 'auth/weak-password') return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
  if (error.code === 'auth/too-many-requests') return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  if (error.code === 'auth/network-request-failed') return 'Koneksi terputus. Periksa internet lalu coba lagi.';
  return mode === 'register' ? 'Pendaftaran belum berhasil. Coba lagi.' : 'Email atau kata sandi belum tepat.';
}

export default function Auth({ onAuthComplete }) {
  const { signInWithGoogle, signInAsGuest, signInWithEmailAndPassword, createAccountWithEmail, signOut, saveUserProfile, readUserProfile } = useAuth();
  const [role, setRole] = useState('teacher');
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = async (firebaseUser, requestedRole, isNew = false) => {
    const existing = await readUserProfile(firebaseUser.uid);
    if (existing?.role && existing.role !== requestedRole) {
      await signOut();
      throw new Error(`Akun ini sudah terdaftar sebagai ${existing.role === 'teacher' ? 'guru' : 'siswa'}. Gunakan pilihan masuk ${existing.role === 'teacher' ? 'Guru' : 'Siswa'}.`);
    }
    const profile = existing || profileSeed(firebaseUser, requestedRole);
    if (!existing || isNew) await saveUserProfile(firebaseUser.uid, profile);
    onAuthComplete(profile.role);
  };
  const google = async () => {
    setBusy(true); setError('');
    try { const result = await signInWithGoogle(); await finish(result.user, role); }
    catch (caught) { setError(caught.message?.includes('terdaftar sebagai') ? caught.message : 'Login Google belum berhasil. Pastikan popup tidak diblokir.'); }
    finally { setBusy(false); }
  };
  const emailAuth = async (event) => {
    event.preventDefault(); setError('');
    if (password.length < 6) return setError('Kata sandi minimal 6 karakter.');
    if (mode === 'register' && password !== confirmPassword) return setError('Konfirmasi kata sandi belum sama.');
    setBusy(true);
    try {
      const result = mode === 'register' ? await createAccountWithEmail(email.trim(), password) : await signInWithEmailAndPassword(email.trim(), password);
      await finish(result.user, role, mode === 'register');
    } catch (caught) { setError(authErrorMessage(caught, mode)); }
    finally { setBusy(false); }
  };
  const guest = async () => {
    setBusy(true); setError('');
    try {
      const result = await signInAsGuest();
      await saveUserProfile(result.user.uid, { uid: result.user.uid, name: 'Siswa Tamu', nickname: 'Tamu', email: '', role: 'student', subject: 'Umum', gender: '', avatar: null, isAnonymous: true, profileCompleted: true });
      onAuthComplete('student');
    } catch { setError('Akun tamu belum dapat dibuat. Coba lagi.'); }
    finally { setBusy(false); }
  };

  return (
    <main className="nlr-auth">
      <aside className="nlr-auth__aside">
        <Link to="/" aria-label="Kembali ke Nalaro Class"><Brand /></Link>
        <div className="nlr-auth__story"><h1>Kelas yang hidup<br />dimulai <em>di sini.</em></h1><p>Ruang belajar yang menyatukan hal-hal penting, supaya guru bisa fokus mengajar dan siswa lebih leluasa mencoba.</p><ul><li><BookOpen size={19} /> Materi tertata dan mudah dibuka</li><li><MessageSquare size={19} /> Percakapan tetap dekat dengan pelajaran</li><li><Gamepad2 size={19} /> Kuis membuat belajar terasa lebih seru</li></ul></div>
        <small>© {new Date().getFullYear()} Nalaro Class</small>
      </aside>
      <div className="nlr-auth__main">
        <section className="nlr-auth__card" aria-labelledby="nlr-auth-title">
          <Link className="nlr-auth__back" to="/"><ArrowLeft size={16} /> Kembali ke beranda</Link>
          <h2 id="nlr-auth-title">{mode === 'login' ? 'Selamat datang kembali.' : 'Mulai belajar bersama.'}</h2>
          <p className="nlr-auth__lead">{mode === 'login' ? 'Masuk ke ruang belajarmu di Nalaro Class.' : 'Buat akun untuk membuka ruang belajarmu.'}</p>
          <div className="nlr-auth__mode" role="tablist" aria-label="Masuk atau daftar">
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>Masuk</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setError(''); }}>Daftar</button>
          </div>
          <p className="nlr-auth__role-title">Saya menggunakan Nalaro sebagai</p>
          <div className="nlr-auth__roles" role="group" aria-label="Pilih peran akun">
            {Object.entries(roleCopy).map(([value, copy]) => { const Icon = copy.icon; return <button key={value} type="button" aria-pressed={role === value} onClick={() => { setRole(value); setError(''); }}><Icon size={20} /><span><strong>{copy.label}</strong><small>{copy.description}</small></span></button>; })}
          </div>
          {error ? <div className="nlr-auth__error" role="alert">{error}</div> : null}
          <button type="button" className="nlr-auth__google" disabled={busy} onClick={google}>{busy ? <Loader2 className="qz-spin" size={18} /> : <span className="nlr-auth__google-mark" aria-hidden="true">G</span>} Lanjutkan dengan Google</button>
          <div className="nlr-auth__divider">atau dengan email</div>
          <form className="nlr-auth__form" onSubmit={emailAuth}>
            <label>Email<input type="email" autoComplete="email" placeholder="nama@email.com" value={email} required onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Kata sandi<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Minimal 6 karakter" minLength={6} value={password} required onChange={(event) => setPassword(event.target.value)} /></label>
            {mode === 'register' ? <label>Ulangi kata sandi<input type="password" autoComplete="new-password" placeholder="Ketik ulang kata sandi" minLength={6} value={confirmPassword} required onChange={(event) => setConfirmPassword(event.target.value)} /></label> : null}
            <button className="nlr-auth__submit" disabled={busy} type="submit">{busy ? <><Loader2 className="qz-spin" size={18} /> Memproses...</> : <>{mode === 'login' ? `Masuk sebagai ${roleCopy[role].label}` : `Daftar sebagai ${roleCopy[role].label}`} <ArrowRight size={18} /></>}</button>
          </form>
          {role === 'student' ? <><div className="nlr-auth__divider">atau</div><button type="button" className="nlr-auth__guest" disabled={busy} onClick={guest}><Gamepad2 size={17} /> Gabung kuis sebagai tamu</button></> : null}
          <p className="nlr-auth__fineprint">Pilih peran yang sesuai. Peran akun yang sudah terdaftar tidak berubah saat masuk kembali.</p>
        </section>
      </div>
    </main>
  );
}
