import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button, Dialog } from '../../components/ui';
import { createFaceChallenge } from './face-challenge';
import { faceErrorMessage, startFaceCamera, stopFaceCamera, warmFaceEngine } from './face-engine';
import { verifyFace } from './face-verification';

export default function FaceCheckInDialog({ open, onClose, profile, onVerified, busy = false }) {
  const videoRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [challenge, setChallenge] = useState(() => createFaceChallenge());
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => { if (!open) { stopFaceCamera(videoRef.current); setCameraReady(false); setChecking(false); setError(''); setStatus(''); setChallenge(createFaceChallenge()); } }, [open]);
  useEffect(() => () => stopFaceCamera(videoRef.current), []);
  const start = async () => { setChecking(true); setError(''); setStatus('Mengaktifkan kamera...'); try { await startFaceCamera(videoRef.current); setStatus('Menyiapkan pemindai wajah...'); await warmFaceEngine(); setCameraReady(true); setStatus('Kamera siap. Hadapkan wajah lurus, lalu ikuti arah putar kepala.'); } catch (caught) { setError(faceErrorMessage(caught)); } finally { setChecking(false); } };
  const verify = async () => { setChecking(true); setError(''); setStatus('Membaca wajah dan gerakan kepala...'); try { const result = await verifyFace(videoRef.current, profile, challenge); if (!result.challengeComplete) { setError(`Tantangan belum terbaca. ${challenge.instruction}`); return; } if (!result.matched) { setError('Wajah belum cocok dengan profil. Atur pencahayaan dan coba lagi, atau gunakan presensi biasa.'); return; } setStatus(`Wajah cocok (${Math.round(result.similarity * 100)}%). Mencatat presensi...`); await onVerified(); } catch (caught) { setError(faceErrorMessage(caught)); } finally { setChecking(false); } };
  return <Dialog open={open} onClose={() => !busy && !checking && onClose()} title="Presensi wajah" description="Pencocokan berlangsung di browser. Kamera dan foto tidak dikirim untuk presensi." footer={<><Button variant="secondary" disabled={busy || checking} onClick={onClose}>Gunakan presensi biasa</Button><Button disabled={busy || checking || !cameraReady} onClick={verify}>{busy || checking ? 'Memeriksa...' : <><CheckCircle2 size={17} /> Periksa & hadir</>}</Button></>}><div className="qz-face-scan" data-stage={checking ? 'capturing' : 'guiding'}><div className="qz-face-camera">{open ? <video ref={videoRef} muted playsInline aria-label="Pratinjau kamera untuk presensi wajah" /> : null}<div className="qz-face-scan__shade" aria-hidden="true" /><div className="qz-face-scan__oval" aria-hidden="true"><i /></div><span className="qz-face-scan__line" aria-hidden="true" /></div></div>{!cameraReady ? <Button disabled={checking} onClick={start}>{checking ? 'Menyiapkan kamera...' : <><Camera size={17} /> Aktifkan kamera</>}</Button> : <div className="qz-face-challenge"><strong>Gerakan yang diminta</strong><p>{challenge.instruction}</p><Button size="sm" variant="ghost" disabled={checking} onClick={() => setChallenge(createFaceChallenge())}><RotateCcw size={15} /> Ganti arah</Button></div>}{status ? <p className="qz-inline-state" role="status">{status}</p> : null}{error ? <p className="qz-inline-state qz-inline-state--error" role="alert">{error}</p> : null}<p className="qz-face-disclaimer">Ini adalah verifikasi perangkat MVP dengan tantangan gerak sederhana, bukan liveness/anti-spoofing berstandar tinggi.</p></Dialog>;
}
