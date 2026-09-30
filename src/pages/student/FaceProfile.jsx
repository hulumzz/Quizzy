import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { Button, Card, Dialog, PageHeader, buttonClassName } from '../../components/ui';
import { enrollFace } from '../../features/face/face-enrollment';
import { faceErrorMessage, inspectEnrollmentFace, startFaceCamera, stopFaceCamera, warmFaceEngine } from '../../features/face/face-engine';
import { deleteFaceProfile, faceProfileErrorMessage, getFaceProfile, saveFaceProfile } from '../../services/face.service';
import { useAuth } from '../../context/useAuth';

export default function FaceProfile() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [scan, setScan] = useState({ stage: 'idle', current: 0, total: 3, guidance: null });
  const scanTimerRef = useRef(null);
  const scanRunRef = useRef(0);
  const inspectionRef = useRef(false);

  useEffect(() => { let active = true; if (!user?.uid) { setLoading(false); return undefined; } getFaceProfile(user.uid).then((next) => { if (active) setProfile(next); }).catch((caught) => { if (active) setError(faceProfileErrorMessage(caught)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [user?.uid]);
  const stopScanner = () => {
    scanRunRef.current += 1;
    window.clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    inspectionRef.current = false;
  };
  useEffect(() => () => { stopScanner(); stopFaceCamera(videoRef.current); }, []);

  const inspectCamera = async () => {
    if (inspectionRef.current || !videoRef.current?.srcObject) return;
    inspectionRef.current = true;
    try {
      const guidance = await inspectEnrollmentFace(videoRef.current);
      setScan((current) => current.stage === 'guiding' ? { ...current, guidance } : current);
    } catch (caught) {
      const message = caught?.code === 'MULTIPLE_FACES' ? 'Pastikan hanya satu wajah berada di dalam bingkai.' : 'Posisikan wajah di dalam bingkai untuk memulai pemindaian.';
      setScan((current) => current.stage === 'guiding' ? { ...current, guidance: { ready: false, tone: 'warning', instruction: message, detail: 'Kamera akan memeriksa ulang secara otomatis.' } } : current);
    } finally { inspectionRef.current = false; }
  };

  const openCamera = async () => {
    stopScanner(); setBusy(true); setError(''); setNotice(''); setCameraOpen(true); setScan({ stage: 'camera', current: 0, total: 3, guidance: null });
    const run = scanRunRef.current + 1;
    scanRunRef.current = run;
    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      await startFaceCamera(videoRef.current);
      setBusy(false);
      setScan({ stage: 'loading', current: 0, total: 3, guidance: null });
      await warmFaceEngine();
      if (scanRunRef.current !== run) return;
      setScan({ stage: 'guiding', current: 0, total: 3, guidance: { ready: false, tone: 'neutral', instruction: 'Tempatkan wajah di dalam bingkai.', detail: 'Kami memeriksa posisi dan pencahayaan.' } });
      void inspectCamera();
      scanTimerRef.current = window.setInterval(() => { void inspectCamera(); }, 850);
    } catch (caught) { setError(faceErrorMessage(caught)); setCameraOpen(false); stopScanner(); } finally { setBusy(false); }
  };
  const closeCamera = () => { stopScanner(); stopFaceCamera(videoRef.current); setCameraOpen(false); setScan({ stage: 'idle', current: 0, total: 3, guidance: null }); };
  const enroll = async () => {
    stopScanner(); setBusy(true); setError(''); setNotice(''); setScan((current) => ({ ...current, stage: 'capturing', current: 0 }));
    try {
      const enrolled = await enrollFace(videoRef.current, 3, ({ current, total, phase }) => setScan((previous) => ({ ...previous, stage: phase === 'complete' ? 'saving' : 'capturing', current, total })));
      setScan((current) => ({ ...current, stage: 'saving' }));
      const saved = await saveFaceProfile(user?.uid, { ...enrolled, consent: true });
      setProfile(saved); closeCamera(); setNotice('Profil wajah tersimpan. Foto dan rekaman kamera tidak disimpan.');
    } catch (caught) { setError(faceErrorMessage(caught)); setScan((current) => ({ ...current, stage: 'guiding', current: 0, guidance: null })); void inspectCamera(); scanTimerRef.current = window.setInterval(() => { void inspectCamera(); }, 850); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError('');
    try { await deleteFaceProfile(user?.uid); setProfile(null); setDeleteOpen(false); setNotice('Profil wajah telah dihapus dari akun ini.'); } catch (caught) { setError(faceProfileErrorMessage(caught)); } finally { setBusy(false); }
  };

  return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Akun saya" title="Profil wajah" description="Opsional untuk membantu presensi wajah pada perangkat lain yang memakai akun ini." actions={<Link className={buttonClassName({ variant: 'secondary' })} to="/profile">Kembali ke profil</Link>} />
    {error ? <div className="qz-inline-state qz-inline-state--error" role="alert">{error}</div> : null}{notice ? <div className="qz-inline-state" role="status">{notice}</div> : null}
    <Card className="qz-face-card"><div className="qz-face-card__icon"><ShieldCheck size={28} /></div><div><h2>{loading ? 'Memeriksa profil...' : profile ? 'Profil wajah aktif' : 'Daftarkan wajah Anda'}</h2><p>Yang disimpan adalah embedding numerik untuk akun Anda sendiri, bukan foto atau video. Fitur ini membantu alur presensi di browser dan bukan perlindungan anti-pemalsuan tingkat tinggi.</p>{profile ? <small>Didaftarkan {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(profile.enrolledAt))}</small> : null}</div><div className="qz-face-card__actions">{profile ? <><Button disabled={busy} onClick={openCamera}><RefreshCw size={17} /> Daftar ulang</Button><Button variant="danger" disabled={busy} onClick={() => setDeleteOpen(true)}><Trash2 size={17} /> Hapus</Button></> : <Button disabled={loading || busy} onClick={openCamera}><Camera size={17} /> Buka kamera</Button>}</div></Card>
    <Card className="qz-face-card qz-face-card--notice"><h2>Persetujuan dan pilihan lain</h2><p>Gunakan hanya bila Anda berhak menyetujui pemrosesan data biometrik. Jika sekolah atau wali memerlukan persetujuan khusus, selesaikan terlebih dahulu. Presensi biasa tetap tersedia jika kamera, perangkat, atau pencocokan tidak dapat digunakan.</p></Card>
    <Dialog open={cameraOpen} onClose={() => !busy && closeCamera()} title="Daftarkan profil wajah" description="Ikuti panduan pemindaian. Tiga sampel numerik akan dibuat di perangkat ini; foto dan video tidak disimpan." footer={<><Button variant="secondary" disabled={busy} onClick={closeCamera}>Batal</Button><Button disabled={busy || !consent || scan.stage !== 'guiding' || !scan.guidance?.ready} onClick={enroll}>{busy ? 'Memproses...' : <><CheckCircle2 size={17} /> Ambil 3 sampel</>}</Button></>}><div className="qz-face-scan" data-stage={scan.stage} aria-live="polite"><div className="qz-face-camera"><video ref={videoRef} muted playsInline aria-label="Pratinjau kamera untuk pendaftaran wajah" /><div className="qz-face-scan__shade" aria-hidden="true" /><div className="qz-face-scan__oval" aria-hidden="true"><i /></div><span className="qz-face-scan__line" aria-hidden="true" /></div><div className={`qz-face-scan__status qz-face-scan__status--${scan.guidance?.tone || 'neutral'}`}><strong>{scan.stage === 'camera' ? 'Mengaktifkan kamera...' : scan.stage === 'loading' ? 'Menyiapkan pemindai wajah...' : scan.stage === 'capturing' ? `Membaca sampel ${Math.min(scan.current + 1, scan.total)} dari ${scan.total}...` : scan.stage === 'saving' ? 'Menyimpan profil wajah...' : scan.guidance?.instruction || 'Menyiapkan pemindaian...'}</strong><span>{scan.stage === 'loading' ? 'Pemakaian pertama dapat memerlukan beberapa saat untuk memuat model di perangkat ini.' : scan.stage === 'capturing' ? 'Tetap diam dan pertahankan wajah di dalam bingkai.' : scan.stage === 'saving' ? 'Hanya embedding numerik yang dikirim ke akun Anda.' : scan.guidance?.detail || 'Tunggu kamera siap.'}</span>{scan.stage === 'capturing' || scan.stage === 'saving' ? <div className="qz-face-scan__progress" aria-label={`Kemajuan ${scan.current} dari ${scan.total} sampel`}><b style={{ width: `${Math.max(8, (scan.current / scan.total) * 100)}%` }} /></div> : null}</div></div><label className="qz-face-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Saya menyetujui penyimpanan embedding wajah untuk presensi pada akun saya dan memahami bahwa saya dapat menghapusnya kapan saja.</label></Dialog>
    <Dialog open={deleteOpen} onClose={() => !busy && setDeleteOpen(false)} title="Hapus profil wajah?" description="Profil numerik wajah akan dihapus dan presensi wajah perlu didaftarkan ulang." footer={<><Button variant="secondary" disabled={busy} onClick={() => setDeleteOpen(false)}>Batal</Button><Button variant="danger" disabled={busy} onClick={remove}>{busy ? 'Menghapus...' : 'Hapus profil'}</Button></>}>Penghapusan tidak mengubah riwayat presensi yang sudah tercatat.</Dialog>
  </div>;
}
