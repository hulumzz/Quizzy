import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, BookOpenCheck, BrainCircuit, ChevronRight, Gauge, Sparkles, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import ClassWorkspaceNav from '../components/classroom/ClassWorkspaceNav';
import { Badge, Button, Card, Dialog, EmptyState, PageHeader, Skeleton } from '../components/ui';
import { getClassLearningAnalytics, getMyLearningAnalytics, getStudentLearningAnalytics, learningAnalyticsErrorMessage } from '../services/learning-analytics.service';

const statusTone = { mastering: 'success', developing: 'neutral', support: 'warning', insufficient: 'neutral' };
const insightIcon = (tone) => tone === 'positive' ? TrendingUp : tone === 'attention' ? TrendingDown : Sparkles;

function scoreText(value) {
  return Number.isFinite(value) ? String(Math.round(value)) : '—';
}

function trendText(trend) {
  if (!trend || trend.direction === 'insufficient' || !Number.isFinite(trend.delta)) return 'Belum cukup data';
  const prefix = trend.delta > 0 ? '+' : '';
  return `${trend.label} · ${prefix}${trend.delta}`;
}

function MetricCard({ icon: Icon, label, value, caption, accent = 'default' }) {
  return <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18 }}><Card className={`qz-insight-metric qz-insight-metric--${accent}`}><span className="qz-insight-metric__icon"><Icon size={20} /></span><div><span>{label}</span><strong>{value}</strong><small>{caption}</small></div></Card></motion.div>;
}

function Meter({ value, label }) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return <div className="qz-insight-meter"><div><span>{label}</span><strong>{Number.isFinite(value) ? `${Math.round(value)}%` : 'Belum ada data'}</strong></div><div className="qz-insight-meter__track"><i style={{ width: `${safe}%` }} /></div></div>;
}

function InsightList({ items = [] }) {
  return <div className="qz-insight-list">{items.map((item, index) => {
    const Icon = insightIcon(item.tone);
    return <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className={`qz-insight-callout qz-insight-callout--${item.tone}`} key={`${item.title}-${index}`}><span><Icon size={18} /></span><div><strong>{item.title}</strong><p>{item.body}</p></div></motion.article>;
  })}</div>;
}

function StatusSummary({ statuses }) {
  const items = [
    ['mastering', 'Menguasai', statuses.mastering],
    ['developing', 'Berkembang', statuses.developing],
    ['support', 'Perlu dukungan', statuses.support],
    ['insufficient', 'Belum cukup data', statuses.insufficient],
  ];
  return <div className="qz-insight-status-grid">{items.map(([key, label, count]) => <Card key={key} className={`qz-insight-status qz-insight-status--${key}`}><strong>{count}</strong><span>{label}</span></Card>)}</div>;
}

function SessionCards({ items = [], student = false }) {
  if (!items.length) return <Card className="qz-insight-empty"><p>Belum ada evidence yang terhubung ke Learning Session.</p></Card>;
  return <div className="qz-insight-session-grid">{items.map((item) => <Card className="qz-insight-session" key={item.sessionId}><div className="qz-insight-session__head"><div><span className="qz-eyebrow">PERTEMUAN</span><h3>{item.title}</h3></div><strong>{Number.isFinite(item.mastery) ? Math.round(item.mastery) : '—'}</strong></div><Meter value={item.mastery} label="Pemahaman" /><div className="qz-insight-session__meta"><span>{student ? `${item.evidenceCount} evidence` : `Coverage ${Math.round(item.coverage || 0)}%`}</span>{Number.isFinite(item.engagement) ? <span>Keterlibatan {Math.round(item.engagement)}%</span> : null}</div></Card>)}</div>;
}

function EvidenceBreakdown({ profile }) {
  const rates = profile.rates || {};
  return <div className="qz-insight-evidence-grid">
    <Meter value={rates.quizAverage} label="Rata-rata kuis" />
    <Meter value={rates.taskAverage} label="Rata-rata tugas" />
    <Meter value={rates.attendance} label="Kehadiran" />
    <Meter value={rates.taskCompletion} label="Penyelesaian tugas" />
    <Meter value={rates.onTimeSubmission} label="Ketepatan waktu" />
    <Meter value={rates.materialProgress} label="Progres materi" />
    <Meter value={rates.discussionParticipation} label="Partisipasi diskusi" />
  </div>;
}

function StudentProfile({ profile }) {
  return <div className="qz-insight-student-detail">
    <div className="qz-insight-profile-head"><div className="qz-insight-profile-avatar">{profile.name?.charAt(0)?.toUpperCase() || 'S'}</div><div><h2>{profile.name}</h2><div className="qz-insight-profile-badges"><Badge tone={statusTone[profile.status?.key] || 'neutral'}>{profile.status?.label || 'Belum cukup data'}</Badge><Badge tone="neutral">Keyakinan data {profile.confidence?.label || 'rendah'} · {Math.round(profile.confidence?.value || 0)}%</Badge></div></div></div>
    <div className="qz-insight-metrics qz-insight-metrics--detail">
      <MetricCard icon={BrainCircuit} label="Pemahaman" value={scoreText(profile.mastery)} caption="Kuis + tugas bernilai" accent="primary" />
      <MetricCard icon={Gauge} label="Konsistensi" value={scoreText(profile.consistency)} caption="Presensi + tugas + ketepatan waktu" />
      <MetricCard icon={Activity} label="Keterlibatan" value={scoreText(profile.engagement)} caption="Materi + diskusi + aktivitas kelas" />
      <MetricCard icon={profile.trend?.direction === 'declining' ? TrendingDown : TrendingUp} label="Tren" value={Number.isFinite(profile.trend?.delta) ? `${profile.trend.delta > 0 ? '+' : ''}${profile.trend.delta}` : '—'} caption={profile.trend?.label || 'Belum cukup data'} accent={profile.trend?.direction === 'declining' ? 'warning' : 'default'} />
    </div>
    <section className="qz-insight-section"><div className="qz-insight-section__head"><div><span className="qz-eyebrow">MENGAPA?</span><h3>Evidence yang membentuk analisis</h3></div><span>{profile.evidenceCount} evidence terbaca</span></div><EvidenceBreakdown profile={profile} />{profile.revisionResponse?.measuredCount ? <div className="qz-insight-revision"><TrendingUp size={18} /><div><strong>{profile.revisionResponse.label}</strong><span>{profile.revisionResponse.averageGain > 0 ? '+' : ''}{profile.revisionResponse.averageGain} poin rata-rata · {profile.revisionResponse.improvedCount}/{profile.revisionResponse.measuredCount} revisi meningkat</span></div></div> : null}</section>
    {profile.insights?.length ? <section className="qz-insight-section"><div className="qz-insight-section__head"><div><span className="qz-eyebrow">NALARO INSIGHT</span><h3>Yang perlu diperhatikan</h3></div></div><InsightList items={profile.insights} /></section> : null}
    {profile.sessionAnalytics?.length ? <section className="qz-insight-section"><div className="qz-insight-section__head"><div><span className="qz-eyebrow">PER TOPIK</span><h3>Analitik berdasarkan pertemuan</h3></div></div><SessionCards items={profile.sessionAnalytics} student /></section> : null}
    {profile.recentEvidence?.length ? <section className="qz-insight-section"><div className="qz-insight-section__head"><div><span className="qz-eyebrow">EVIDENCE TERBARU</span><h3>Jejak penilaian</h3></div></div><div className="qz-insight-evidence-list">{profile.recentEvidence.map((item) => <div key={`${item.source}-${item.sourceId}-${item.occurredAt}`}><span>{item.sourceLabel}</span><div><strong>{item.label}</strong>{item.sessionTitle ? <small>{item.sessionTitle}</small> : null}</div><b>{Math.round(item.score)}</b></div>)}</div></section> : null}
  </div>;
}

function Loading() {
  return <div className="qz-dashboard"><Skeleton width="45%" height={38} /><Skeleton height={108} /><div className="qz-insight-metrics"><Skeleton height={150} /><Skeleton height={150} /><Skeleton height={150} /><Skeleton height={150} /></div><Skeleton height={300} /></div>;
}

export default function ClassAnalytics({ role }) {
  const { classId } = useParams();
  const [state, setState] = useState({ status: 'loading', analytics: null, error: null });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState({ loading: false, profile: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', analytics: null, error: null });
    const load = role === 'teacher' ? getClassLearningAnalytics(classId, { signal: controller.signal }) : getMyLearningAnalytics(classId, { signal: controller.signal });
    load.then((analytics) => setState({ status: 'success', analytics, error: null })).catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', analytics: null, error }); });
    return () => controller.abort();
  }, [classId, role]);

  useEffect(() => {
    if (!selectedStudent || role !== 'teacher') return undefined;
    const controller = new AbortController();
    setStudentDetail({ loading: true, profile: null, error: '' });
    getStudentLearningAnalytics(classId, selectedStudent.studentId, { signal: controller.signal })
      .then((analytics) => setStudentDetail({ loading: false, profile: analytics.profile, error: '' }))
      .catch((error) => { if (error.name !== 'AbortError') setStudentDetail({ loading: false, profile: null, error: learningAnalyticsErrorMessage(error) }); });
    return () => controller.abort();
  }, [classId, role, selectedStudent]);

  const sortedStudents = useMemo(() => {
    if (role !== 'teacher') return [];
    const weight = { support: 0, developing: 1, insufficient: 2, mastering: 3 };
    return [...(state.analytics?.students || [])].sort((a, b) => (weight[a.status.key] ?? 4) - (weight[b.status.key] ?? 4) || a.name.localeCompare(b.name, 'id-ID'));
  }, [role, state.analytics]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') return <div className="qz-dashboard"><Card><EmptyState icon={BarChart3} title="Learning Insights belum dapat dibuka" description={learningAnalyticsErrorMessage(state.error)} /></Card></div>;

  const analytics = state.analytics;
  if (role === 'student') {
    const profile = analytics.profile;
    return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Nalaro Learning Insights" title="Analitik belajarmu" description="Ringkasan ini membaca evidence dari aktivitas kelas. Ini bukan label kemampuan permanen dan akan berubah ketika data belajar bertambah." /><ClassWorkspaceNav role={role} classId={classId} /><Card className="qz-insight-method"><BrainCircuit size={22} /><div><strong>Analitik yang bisa dijelaskan</strong><p>Pemahaman berasal dari kuis dan tugas bernilai. Presensi, materi, diskusi, serta penyelesaian tugas membantu membaca konsistensi dan keterlibatan—bukan menaikkan nilai pemahaman secara palsu.</p></div></Card><StudentProfile profile={profile} /></div>;
  }

  const summary = analytics.summary;
  const unmappedTotal = Object.values(analytics.unmapped || {}).reduce((sum, value) => sum + value, 0);
  return <div className="qz-dashboard qz-enter"><PageHeader eyebrow="Nalaro Learning Insights" title={analytics.class.name} description="Baca pemahaman, perkembangan, konsistensi, dan keterlibatan siswa dari seluruh evidence pembelajaran kelas." /><ClassWorkspaceNav role={role} classId={classId} />
    <Card className="qz-insight-method"><BrainCircuit size={22} /><div><strong>Learning analytics, bukan ranking siswa</strong><p>Nalaro menggabungkan kuis, tugas, revisi, presensi, progres materi, dan diskusi. Confidence menunjukkan seberapa kuat bukti yang tersedia; siswa tidak diurutkan menjadi terbaik atau terburuk.</p></div><Badge tone="neutral">Metode v1</Badge></Card>
    <div className="qz-insight-metrics">
      <MetricCard icon={BrainCircuit} label="Pemahaman kelas" value={summary.masteryAvailable ? scoreText(summary.mastery) : '—'} caption={`${summary.masteryAvailable}/${analytics.class.studentsCount} siswa memiliki evidence penilaian`} accent="primary" />
      <MetricCard icon={Gauge} label="Konsistensi" value={summary.consistencyAvailable ? scoreText(summary.consistency) : '—'} caption={summary.consistencyAvailable ? 'Kehadiran, tugas, ketepatan waktu' : 'Belum cukup aktivitas terukur'} />
      <MetricCard icon={Activity} label="Keterlibatan" value={summary.engagementAvailable ? scoreText(summary.engagement) : '—'} caption={summary.engagementAvailable ? 'Materi, diskusi, tugas, presensi' : 'Belum cukup aktivitas terukur'} />
      <MetricCard icon={summary.trendDelta < -5 ? TrendingDown : TrendingUp} label="Tren kelas" value={Number.isFinite(summary.trendDelta) ? `${summary.trendDelta > 0 ? '+' : ''}${summary.trendDelta}` : '—'} caption={Number.isFinite(summary.trendDelta) ? 'Perubahan evidence terbaru' : 'Belum cukup data'} accent={summary.trendDelta < -5 ? 'warning' : 'default'} />
      <MetricCard icon={BookOpenCheck} label="Evidence" value={summary.evidenceCount} caption={`Keyakinan data ${summary.confidence.label} · ${Math.round(summary.confidence.value)}%`} />
    </div>
    <section className="qz-insight-section"><div className="qz-insight-section__head"><div><span className="qz-eyebrow">KONDISI KELAS</span><h2>Distribusi perkembangan</h2></div><span>{analytics.class.studentsCount} siswa</span></div><StatusSummary statuses={analytics.statuses} /></section>
    {analytics.insights?.length ? <section className="qz-insight-section"><div className="qz-insight-section__head"><div><span className="qz-eyebrow">NALARO INSIGHT</span><h2>Sinyal penting untuk guru</h2></div></div><InsightList items={analytics.insights} /></section> : null}
    <section className="qz-insight-section"><div className="qz-insight-section__head"><div><span className="qz-eyebrow">TOPIK / PERTEMUAN</span><h2>Di mana kelas menyerap materi dengan baik?</h2></div><span>{analytics.sessionAnalytics.length} pertemuan terbaca</span></div><SessionCards items={analytics.sessionAnalytics} /></section>
    {unmappedTotal ? <Card className="qz-insight-unmapped"><BookOpenCheck size={20} /><div><strong>{unmappedTotal} aktivitas belum terhubung ke pertemuan</strong><p>Materi {analytics.unmapped.materials}, kuis {analytics.unmapped.quizzes}, tugas {analytics.unmapped.tasks}, presensi {analytics.unmapped.attendance}. Aktivitas ini tetap masuk analitik kelas, tetapi belum bisa memperkaya analitik per topik.</p></div></Card> : null}
    <section className="qz-insight-section"><div className="qz-insight-section__head"><div><span className="qz-eyebrow">SISWA</span><h2>Profil belajar yang perlu dibaca</h2></div><span>Klik siswa untuk melihat alasan analisis</span></div>{sortedStudents.length ? <div className="qz-insight-students">{sortedStudents.map((student) => <motion.button whileHover={{ x: 3 }} type="button" key={student.studentId} onClick={() => setSelectedStudent(student)}><span className="qz-insight-student-avatar">{student.name.charAt(0).toUpperCase()}</span><div><strong>{student.name}</strong><span><Badge tone={statusTone[student.status.key] || 'neutral'}>{student.status.label}</Badge> · Confidence {student.confidence.label}</span></div><div className="qz-insight-student-scores"><span>Pemahaman <b>{scoreText(student.mastery)}</b></span><span>Tren <b>{trendText(student.trend)}</b></span></div><ChevronRight size={18} /></motion.button>)}</div> : <Card><EmptyState icon={Users} title="Belum ada siswa" description="Analitik siswa muncul setelah anggota bergabung dan mulai beraktivitas." /></Card>}</section>
    <Dialog className="qz-insight-dialog" open={Boolean(selectedStudent)} onClose={() => { setSelectedStudent(null); setStudentDetail({ loading: false, profile: null, error: '' }); }} title={selectedStudent ? `Analitik · ${selectedStudent.name}` : 'Analitik siswa'} description="Detail evidence hanya terlihat oleh guru kelas dan siswa yang bersangkutan.">{studentDetail.loading ? <div className="qz-insight-dialog-loading"><Skeleton height={120} /><Skeleton height={220} /></div> : studentDetail.error ? <div className="qz-inline-state qz-inline-state--error">{studentDetail.error}</div> : studentDetail.profile ? <StudentProfile profile={studentDetail.profile} /> : null}</Dialog>
  </div>;
}
