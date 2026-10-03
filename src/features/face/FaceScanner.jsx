import { ArrowLeft, ArrowRight, Check, ScanFace } from 'lucide-react';

export default function FaceScanner({ videoRef, scan, steps, label }) {
  const Icon = scan.step?.id === 'left' ? ArrowLeft : scan.step?.id === 'right' ? ArrowRight : scan.stage === 'complete' ? Check : ScanFace;
  const completed = scan.current || 0;
  const instruction = scan.stage === 'camera' ? 'Mengaktifkan kamera…' : scan.stage === 'loading' ? 'Menyiapkan pemindai wajah…' : scan.stage === 'saving' ? 'Menyimpan profil wajah…' : scan.stage === 'verifying' ? 'Mencatat presensi…' : scan.guidance?.instruction || 'Siap memindai wajah';
  return <div className="qz-face-scan" data-stage={scan.stage}>
    <ol className="qz-face-steps" aria-label="Langkah pemindaian">{steps.map((step, index) => <li key={step.id} className={index < completed ? 'is-complete' : index === completed ? 'is-current' : ''} aria-current={index === completed ? 'step' : undefined}><span>{index < completed ? <Check size={14} aria-hidden="true" /> : index + 1}</span>{step.label}</li>)}</ol>
    <div className="qz-face-camera"><video ref={videoRef} muted playsInline aria-label={label} /><div className="qz-face-scan__shade" aria-hidden="true" /><div className="qz-face-scan__oval" aria-hidden="true"><i /></div>{scan.stage !== 'error' ? <span className="qz-face-scan__line" aria-hidden="true" /> : null}<span className="qz-face-scan__direction" aria-hidden="true"><Icon size={24} /></span></div>
    <div className={`qz-face-scan__status qz-face-scan__status--${scan.guidance?.tone || 'neutral'}`}><strong role="status">{instruction}</strong><span>{scan.stage === 'loading' ? 'Pemakaian pertama perlu waktu untuk memuat pemindai. Setelah siap, rekaman berjalan otomatis.' : scan.stage === 'saving' ? 'Foto dan video tidak disimpan.' : scan.guidance?.detail || 'Ikuti panduan di layar setelah kamera siap.'}</span><div className="qz-face-scan__progress" role="progressbar" aria-label="Kemajuan pemindaian" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(((completed + (scan.hold || 0)) / steps.length) * 100)}><b style={{ width: `${((completed + (scan.hold || 0)) / steps.length) * 100}%` }} /></div></div>
  </div>;
}
