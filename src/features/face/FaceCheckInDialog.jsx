import { useEffect, useState } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { Button, Dialog } from '../../components/ui';
import { createFaceChallenge } from './face-challenge';
import { verificationSteps } from './guided-face-scan';
import FaceScanner from './FaceScanner';
import useGuidedFaceScan from './useGuidedFaceScan';

export default function FaceCheckInDialog({ open, onClose, profile, onVerified, busy = false, required = false }) {
  const [challenge, setChallenge] = useState(() => createFaceChallenge());
  const scanner = useGuidedFaceScan();
  const { cancel } = scanner;
  const [started, setStarted] = useState(false);
  const steps = verificationSteps(challenge);
  useEffect(() => {
    if (!open) { cancel(); setStarted(false); setChallenge(createFaceChallenge()); }
  }, [open, cancel]);
  const close = () => { scanner.cancel(); onClose(); };
  const start = () => {
    setStarted(true);
    void scanner.start({ steps, profile, finishStage: 'verifying', onComplete: async () => {
      const saved = await onVerified();
      if (saved === false) throw new Error('Presensi belum tercatat. Periksa pesan di halaman kelas lalu coba lagi.');
    } });
  };
  const submitting = busy || scanner.scan.stage === 'verifying';
  return <Dialog className="qz-dialog--face" open={open} onClose={() => !submitting && close()} title="Presensi wajah" description="Tekan mulai, lalu ikuti panduan. Presensi dicatat otomatis setelah wajah terverifikasi." footer={<><Button variant="secondary" disabled={submitting} onClick={close}>{required ? 'Batal' : 'Kembali ke presensi'}</Button>{!started || scanner.scan.stage === 'error' ? <Button disabled={submitting || !profile} onClick={start}>{started ? <RefreshCw size={17} aria-hidden="true" /> : <Camera size={17} aria-hidden="true" />}{started ? 'Coba lagi' : 'Mulai pemindaian'}</Button> : null}</>}>
    {started ? <FaceScanner videoRef={scanner.videoRef} scan={scanner.scan} steps={steps} label="Pratinjau kamera untuk presensi wajah" /> : <div className="qz-face-start"><span className="qz-card-icon"><Camera size={26} aria-hidden="true" /></span><h3>Siapkan wajah di depan kamera</h3><p>Hadap depan, putar kepala sesuai arah di layar, lalu kembali ke depan. Tidak perlu menekan tombol di setiap langkah.</p><small>Pastikan hanya satu wajah terlihat dan pencahayaan cukup.</small></div>}
    {scanner.error && started ? <p className="qz-inline-state qz-inline-state--error" role="alert">{scanner.error}</p> : null}
    <p className="qz-face-disclaimer">Foto dan video tidak dikirim. Verifikasi ini menggunakan tantangan gerak sederhana.</p>
  </Dialog>;
}
