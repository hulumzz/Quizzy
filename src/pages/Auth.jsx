import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCog, GraduationCap, ArrowRight, Loader2, Gamepad2 } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import '../styles/landing.css';

export default function Auth({ onAuthComplete, initialStep = 'login' }) {
  const { user, signInWithGoogle, signInAsGuest, saveUserProfile } = useAuth();
  const [step, setStep] = useState(initialStep);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState(initialStep === 'role' ? user : null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialStep === 'role' && user) {
      setPendingUser(user);
      setStep('role');
    }
  }, [initialStep, user]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      setPendingUser(result.user);
      setStep('role');
    } catch {
      setError('Login gagal. Pastikan popup tidak diblokir browser.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await signInAsGuest();
      await saveUserProfile(result.user.uid, {
        uid: result.user.uid,
        name: 'Siswa Tamu',
        email: null,
        role: 'student',
        avatar: null,
        isAnonymous: true,
      });
      onAuthComplete('student');
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleConfirm = async () => {
    if (!selectedRole || !pendingUser) return;
    setIsLoading(true);
    try {
      await saveUserProfile(pendingUser.uid, {
        uid: pendingUser.uid,
        name: pendingUser.displayName,
        email: pendingUser.email,
        role: selectedRole,
        avatar: pendingUser.photoURL,
        isAnonymous: false,
      });
      onAuthComplete(selectedRole);
    } catch {
      setError('Gagal menyimpan profil. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="nlr-auth">
      {/* ambient blobs */}
      <div className="nlr-blob nlr-blob-a" />
      <div className="nlr-blob nlr-blob-b" />
      <div className="nlr-blob nlr-blob-c" />
      <div className="nlr-grid-bg" />

      {/* ── LEFT BRAND PANEL ── */}
      <div className="nlr-auth-brand">
        <div className="nlr-auth-brand-top">
          <div className="nlr-logo">
            <div className="nlr-logo-mark">N</div>
            <span className="nlr-logo-text">Nalaro</span>
          </div>

          <div>
            <h1 className="nlr-auth-brand-headline">
              Belajar,{' '}
              <span className="nlr-gradient-text">Bermain,</span>
              <br />
              dan Tumbuh.
            </h1>
            <p className="nlr-auth-brand-sub">
              Platform pembelajaran yang menggabungkan materi, diskusi, kuis interaktif, dan presensi dalam satu ruang kelas digital.
            </p>
          </div>

          <div className="nlr-auth-features">
            {[
              { icon: '📚', title: 'Materi & Diskusi', sub: 'Konten tersusun rapi, diskusi melekat di setiap materi.' },
              { icon: '🎮', title: 'Kuis Interaktif', sub: 'Sesi live bersama atau evaluasi mandiri kapan saja.' },
              { icon: '✅', title: 'Presensi Mudah', sub: 'Catat kehadiran tanpa kerumitan administrasi.' },
            ].map((f) => (
              <div key={f.title} className="nlr-auth-feature">
                <div className="nlr-auth-feature-icon">{f.icon}</div>
                <div>
                  <p className="nlr-auth-feature-title">{f.title}</p>
                  <p className="nlr-auth-feature-sub">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="nlr-auth-brand-footer">© 2026 Nalaro. Ruang kelas digital untuk semua.</p>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="nlr-auth-form-panel">
        <AnimatePresence mode="wait">

          {/* ── LOGIN STEP ── */}
          {step === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="nlr-auth-card"
            >
              <div className="nlr-auth-card-header">
                <div className="nlr-logo" style={{ justifyContent: 'center', marginBottom: 20 }}>
                  <div className="nlr-logo-mark">N</div>
                  <span className="nlr-logo-text">Nalaro</span>
                </div>
                <h2 className="nlr-auth-card-title">Masuk ke Nalaro</h2>
                <p className="nlr-auth-card-sub">Pilih cara masuk yang sesuai denganmu.</p>
              </div>

              <div className="nlr-auth-box">
                {error && <div className="nlr-error">{error}</div>}

                {/* Google */}
                <button
                  id="btn-google-login"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="nlr-google-btn"
                >
                  {isLoading ? (
                    <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {isLoading ? 'Menghubungkan...' : 'Masuk dengan Google'}
                </button>

                <div className="nlr-divider">atau</div>

                {/* Guest */}
                <button
                  id="btn-guest-login"
                  onClick={handleGuestLogin}
                  disabled={isLoading}
                  className="nlr-guest-btn"
                >
                  <Gamepad2 style={{ width: 16, height: 16, color: '#a78bfa', flexShrink: 0 }} />
                  Gabung kuis sebagai tamu
                </button>

                <p className="nlr-hint">
                  Akun tamu hanya untuk bergabung ke sesi kuis via PIN.<br />
                  Gunakan Google untuk akses kelas lengkap.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── ROLE STEP ── */}
          {step === 'role' && (
            <motion.div
              key="role"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="nlr-auth-card"
            >
              <div className="nlr-auth-user-header">
                <img
                  src={pendingUser?.photoURL || '/logo.png'}
                  alt="Avatar"
                  className="nlr-auth-avatar"
                  onError={(e) => { e.target.src = '/logo.png'; }}
                />
                <h2 className="nlr-auth-welcome-name">
                  Halo, <span className="nlr-gradient-text">{pendingUser?.displayName?.split(' ')[0]}!</span>
                </h2>
                <p className="nlr-auth-welcome-sub">Pilih peranmu untuk mulai.</p>
              </div>

              {error && <div className="nlr-error" style={{ marginBottom: 12 }}>{error}</div>}

              <div className="nlr-role-grid" style={{ marginBottom: 12 }}>
                {/* Guru */}
                <motion.button
                  id="btn-role-teacher"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedRole('teacher')}
                  className={`nlr-role-card${selectedRole === 'teacher' ? ' selected-teacher' : ''}`}
                >
                  {selectedRole === 'teacher' && (
                    <div className="nlr-role-check" style={{ background: '#7c3aed' }}>
                      <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div className="nlr-role-card-icon" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                    <UserCog size={20} />
                  </div>
                  <p className="nlr-role-card-title">Guru</p>
                  <p className="nlr-role-card-desc">Buat kelas, materi, kuis, dan kelola presensi.</p>
                </motion.button>

                {/* Siswa */}
                <motion.button
                  id="btn-role-student"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedRole('student')}
                  className={`nlr-role-card${selectedRole === 'student' ? ' selected-student' : ''}`}
                >
                  {selectedRole === 'student' && (
                    <div className="nlr-role-check" style={{ background: '#2563eb' }}>
                      <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div className="nlr-role-card-icon" style={{ background: 'rgba(37,99,235,0.15)', color: '#93c5fd' }}>
                    <GraduationCap size={20} />
                  </div>
                  <p className="nlr-role-card-title">Siswa</p>
                  <p className="nlr-role-card-desc">Belajar, diskusi, presensi, dan ikut kuis.</p>
                </motion.button>
              </div>

              <button
                id="btn-confirm-role"
                onClick={handleRoleConfirm}
                disabled={!selectedRole || isLoading}
                className="nlr-confirm-btn"
              >
                {isLoading ? (
                  <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Menyimpan...</>
                ) : (
                  <>Lanjut ke Dashboard <ArrowRight style={{ width: 16, height: 16 }} /></>
                )}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}


