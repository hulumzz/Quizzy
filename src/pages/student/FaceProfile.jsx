import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { Button, Card, Dialog, PageHeader, buttonClassName } from '../../components/ui';
import FaceScanner from '../../features/face/FaceScanner';
import useGuidedFaceScan from '../../features/face/useGuidedFaceScan';
import { ENROLLMENT_STEPS } from '../../features/face/guided-face-scan';
import { deleteFaceProfile, faceProfileErrorMessage, getFaceProfile, saveFaceProfile } from '../../services/face.service';
import { useAuth } from '../../context/useAuth';

export default function FaceProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const scanner = useGuidedFaceScan();

  useEffect(() => {
    let active = true;
    if (!user?.uid) { setLoading(false); return undefined; }
    getFaceProfile(user.uid).then((next) => { if (active) setProfile(next); }).catch((caught) => { if (active) setError(faceProfileErrorMessage(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.uid]);

  const closeCamera = () => { scanner.cancel(); setCameraOpen(false); };
  const record = () => {
    if (!consent || !user?.uid) return;
    setError(''); setNotice(''); setCameraOpen(true);
    void scanner.start({ steps: ENROLLMENT_STEPS, onComplete: async (enrolled) => {
      try {
        const saved = await saveFaceProfile(user.uid, { ...enrolled, consent: true });
        setProfile(saved); closeCamera(); setNotice('Profil wajah tersimpan. Kamu sudah bisa menggunakannya untuk presensi.');
      } catch (caught) { throw new Error(faceProfileErrorMessage(caught)); }
    } });
  };
  const remove = async () => {
    setDeleting(true); setError('');
    try { await deleteFaceProfile(user?.uid); setProfile(null); setConsent(false); setDeleteOpen(false); setNotice('Profil wajah telah dihapus dari akun ini.'); }
    catch (caught) { setError(faceProfileErrorMessage(caught)); }
    finally { setDeleting(false); }
  };

  return <div className="qz-dashboard qz-enter">
    <PageHeader eyebrow="Akun saya" title="Profil wajah" description="Daftar sekali, lalu gunakan wajahmu untuk presensi kelas." actions={<Link className={buttonClassName({ variant: 'secondary' })} to="/profile">Kembali ke profil</Link>} />
    {error ? <div className="qz-inline-state qz-inline-state--error" role="alert">{error}</div> : null}
    {notice ? <div className="qz-inline-state" role="status">{notice}</div> : null}
    <Card className="qz-face-profile">
      <div className="qz-face-profile__heading"><span className="qz-card-icon"><ShieldCheck size={24} aria-hidden="true" /></span><div><h2>{loading ? 'Memeriksa profil…' : profile ? 'Profil wajah aktif' : 'Siapkan presensi wajah'}</h2><p>{profile ? 'Wajahmu sudah terdaftar. Kamu dapat merekam ulang atau menghapusnya kapan saja.' : 'Setujui penggunaan wajah, lalu tekan Rekam wajah. Ikuti panduan sampai selesai, tanpa perlu mengambil sampel satu per satu.'}</p>{profile ? <small>Didaftarkan {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(profile.enrolledAt))}</small> : null}</div></div>
      <div className="qz-face-preview-steps" aria-label="Cara merekam wajah"><span>1. Hadap depan</span><span>2. Putar kanan & kiri</span><span>3. Tersimpan otomatis</span></div>
      <label className="qz-face-consent"><input type="checkbox" checked={consent} disabled={deleting || scanner.busy} onChange={(event) => setConsent(event.target.checked)} /><span>Saya menyetujui penyimpanan data numerik wajah untuk presensi akun saya. Foto dan video tidak disimpan, dan data wajah dapat saya hapus kapan saja.</span></label>
      <div className="qz-face-profile__actions"><Button disabled={loading || deleting || scanner.busy || !consent} onClick={record}>{profile ? <RefreshCw size={18} aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}{profile ? 'Rekam ulang wajah' : 'Rekam wajah'}</Button>{profile ? <Button variant="danger" disabled={deleting || scanner.busy} onClick={() => setDeleteOpen(true)}><Trash2 size={17} aria-hidden="true" /> Hapus profil</Button> : null}</div>
    </Card>
    <Card className="qz-face-privacy"><h2>Wajahmu, pilihanmu</h2><p>Pemindaian dilakukan di perangkatmu. Akun menyimpan data numerik untuk mencocokkan wajah saat presensi. Jika sekolah atau wali membutuhkan persetujuan khusus, selesaikan terlebih dahulu.</p><p>Presensi biasa tersedia sesuai pengaturan guru. Pemindaian ini memakai panduan gerak sederhana dan belum merupakan perlindungan anti-pemalsuan tingkat tinggi.</p></Card>
    <Dialog className="qz-dialog--face" open={cameraOpen} onClose={() => scanner.scan.stage !== 'saving' && closeCamera()} title="Rekam wajah" description="Ikuti arah dari sisi kamu. Setiap langkah terbaca otomatis saat posisi stabil." footer={<><Button variant="secondary" disabled={scanner.scan.stage === 'saving'} onClick={closeCamera}>Batal</Button>{scanner.scan.stage === 'error' ? <Button onClick={record}><RefreshCw size={17} aria-hidden="true" /> Coba lagi</Button> : null}</>}>
      <FaceScanner videoRef={scanner.videoRef} scan={scanner.scan} steps={ENROLLMENT_STEPS} label="Pratinjau kamera untuk pendaftaran wajah" />
      {scanner.error ? <p className="qz-inline-state qz-inline-state--error" role="alert">{scanner.error}</p> : null}
    </Dialog>
    <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title="Hapus profil wajah?" description="Data numerik wajah akan dihapus. Daftarkan kembali jika ingin memakai presensi wajah." footer={<><Button variant="secondary" disabled={deleting} onClick={() => setDeleteOpen(false)}>Batal</Button><Button variant="danger" disabled={deleting} onClick={remove}>{deleting ? 'Menghapus…' : 'Hapus profil'}</Button></>}>Penghapusan tidak mengubah riwayat presensi yang sudah tercatat.</Dialog>
  </div>;
}
