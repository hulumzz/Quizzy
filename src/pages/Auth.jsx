import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, UserCog, GraduationCap, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/useAuth';

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
      // Guests are always students joining via PIN
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
    <div className="min-h-screen bg-bg-dark flex items-center justify-center relative overflow-hidden px-4 font-outfit">
      {/* Background */}
      <div className="bg-orb orb-1" />
      <div className="bg-orb orb-2" />
      <div className="bg-orb orb-3" />
      <div className="fixed inset-0 grid-bg pointer-events-none z-0" />

      <AnimatePresence mode="wait">
        {step === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md z-10"
          >
            {/* Logo */}
            <div className="text-center mb-8">
              <img src="/logo.png" alt="Quizzy" className="h-16 mx-auto mb-3 drop-shadow-[0_0_16px_rgba(168,85,247,0.6)]" />
              <h1 className="text-3xl font-black tracking-tight">Quizzy</h1>
              <p className="text-gray-400 text-sm mt-1">Ruang belajar yang terhubung dan menyenangkan</p>
            </div>

            {/* Card */}
            <div className="glass-card p-8 rounded-3xl border border-white/10 space-y-4">
              <h2 className="text-xl font-bold text-center mb-2">Masuk ke Platform</h2>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Google Login */}
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white text-gray-900 font-bold hover:bg-gray-100 transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {isLoading ? 'Menghubungkan...' : 'Masuk dengan Google'}
              </button>

              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-gray-500">atau</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Guest Login */}
              <button
                onClick={handleGuestLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition text-sm disabled:opacity-60"
              >
                <Gamepad2 className="w-5 h-5 text-purple-400" />
                Gabung kuis sebagai tamu
              </button>

              <p className="text-[11px] text-gray-500 text-center pt-1">
                Akun tamu digunakan untuk bergabung ke sesi kuis melalui PIN. <br />Gunakan Google untuk mengakses ruang belajar lengkap.
              </p>
            </div>
          </motion.div>
        )}

        {step === 'role' && (
          <motion.div
            key="role"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-lg z-10"
          >
            {/* Welcome Header */}
            <div className="text-center mb-8">
              <img
                src={pendingUser?.photoURL || '/logo.png'}
                alt="Avatar"
                className="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-purple-500 shadow-lg object-cover"
                onError={(e) => { e.target.src = '/logo.png'; }}
              />
              <h2 className="text-2xl font-black">
                Halo, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">{pendingUser?.displayName?.split(' ')[0]}!</span>
              </h2>
              <p className="text-gray-400 text-sm mt-1">Pilih peranmu untuk melanjutkan ke platform</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Guru Card */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedRole('teacher')}
                className={`relative p-6 rounded-3xl border-2 transition text-left space-y-3 overflow-hidden ${
                  selectedRole === 'teacher'
                    ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                {selectedRole === 'teacher' && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                  <UserCog className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <div className="font-bold text-lg">Guru</div>
                  <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    Buat kelas, materi, kuis, & kelola presensi
                  </div>
                </div>
              </motion.button>

              {/* Siswa Card */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedRole('student')}
                className={`relative p-6 rounded-3xl border-2 transition text-left space-y-3 overflow-hidden ${
                  selectedRole === 'student'
                    ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                {selectedRole === 'student' && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <div className="font-bold text-lg">Siswa</div>
                  <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    Belajar, diskusi, presensi & ikuti kuis
                  </div>
                </div>
              </motion.button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm text-center mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleRoleConfirm}
              disabled={!selectedRole || isLoading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] transition"
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Menyimpan...</>
              ) : (
                <>Lanjut ke Dashboard <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
