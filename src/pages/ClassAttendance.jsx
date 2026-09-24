import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ClassWorkspaceNav from '../components/classroom/ClassWorkspaceNav';
import { AttendanceIcon, MembersIcon } from '../components/icons';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Skeleton } from '../components/ui';
import { useAttendance } from '../features/attendance/hooks/useAttendance';
import { getCurrentLocation, geolocationErrorMessage } from '../lib/geolocation';
import { attendanceErrorMessage, checkInAttendance, createAttendanceSession, getAttendanceSession, setAttendanceStatus } from '../services/attendance.service';
import { getClass } from '../services/class.service';
import { listLearningSessions } from '../services/learning-session.service';

const initialForm = { title: '', latitude: '', longitude: '', radiusMeters: '100', sessionId: '' };

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusMeta(status) {
  if (status === 'active') return { label: 'Aktif', tone: 'success' };
  if (status === 'ended') return { label: 'Selesai', tone: 'neutral' };
  return { label: 'Draf', tone: 'warning' };
}

export default function ClassAttendance({ role }) {
  const { classId } = useParams();
  const { attendance, status, error, configured, reload } = useAttendance(classId);
  const [className, setClassName] = useState('Ruang kelas');
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!configured) return undefined;
    const controller = new AbortController();
    Promise.all([getClass(classId, { signal: controller.signal }), role === 'teacher' ? listLearningSessions(classId, { signal: controller.signal }) : Promise.resolve([])])
      .then(([item, sessionItems]) => { setClassName(item.name); setSessions(sessionItems.filter((session) => session.status !== 'archived')); })
      .catch(() => {});
    return () => controller.abort();
  }, [classId, configured, role]);

  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const useTeacherLocation = async () => {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const location = await getCurrentLocation();
      setForm((current) => ({ ...current, latitude: String(location.latitude), longitude: String(location.longitude) }));
      setNotice(location.accuracyMeters ? `Lokasi terisi. Akurasi perangkat sekitar ±${location.accuracyMeters} m.` : 'Lokasi berhasil diisi dari perangkat ini.');
    } catch (caught) {
      setActionError(geolocationErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const createSession = async (event) => {
    event.preventDefault();
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await createAttendanceSession(classId, {
        title: form.title,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radiusMeters: Number(form.radiusMeters),
        sessionId: form.sessionId || null,
      });
      setForm(initialForm);
      setNotice('Sesi tersimpan sebagai draf. Mulai sesi saat siswa sudah siap melakukan presensi.');
      await reload();
    } catch (caught) {
      setActionError(attendanceErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (attendanceId, nextStatus) => {
    setBusyId(attendanceId);
    setActionError('');
    setNotice('');
    try {
      await setAttendanceStatus(classId, attendanceId, nextStatus);
      setNotice(nextStatus === 'active' ? 'Sesi presensi sudah dibuka untuk siswa.' : 'Sesi presensi sudah diakhiri.');
      await reload();
      if (detail?.id === attendanceId) setDetail(await getAttendanceSession(classId, attendanceId));
    } catch (caught) {
      setActionError(attendanceErrorMessage(caught));
    } finally {
      setBusyId('');
    }
  };

  const openRecap = async (attendanceId) => {
    setDetailLoading(true);
    setActionError('');
    try {
      setDetail(await getAttendanceSession(classId, attendanceId));
    } catch (caught) {
      setActionError(attendanceErrorMessage(caught));
    } finally {
      setDetailLoading(false);
    }
  };

  const checkIn = async (attendanceId) => {
    setBusyId(attendanceId);
    setActionError('');
    setNotice('');
    try {
      const location = await getCurrentLocation();
      const checkInResult = await checkInAttendance(classId, attendanceId, location);
      setNotice(`Presensi berhasil dicatat${Number.isFinite(checkInResult.distanceMeters) ? ` pada jarak sekitar ${checkInResult.distanceMeters} m dari titik kelas` : ''}.`);
      await reload();
    } catch (caught) {
      const isGeolocationError = caught?.name === 'GeolocationError' || caught?.code === 'GEOLOCATION_UNAVAILABLE';
      setActionError(isGeolocationError ? geolocationErrorMessage(caught) : attendanceErrorMessage(caught));
    } finally {
      setBusyId('');
    }
  };

  const title = role === 'teacher' ? 'Presensi kelas' : 'Presensi dan riwayat';
  return <div className="qz-dashboard qz-enter">
    <PageHeader eyebrow={`${role === 'teacher' ? 'Ruang guru' : 'Ruang siswa'} · ${className}`} title={title} description={role === 'teacher' ? 'Buat titik presensi, tentukan radius, buka sesi saat pertemuan dimulai, lalu lihat rekap siswa.' : 'Lakukan check-in saat sesi aktif dan lihat kembali riwayat presensi kelas.'} />
    <ClassWorkspaceNav role={role} classId={classId} />
    {!configured ? <div className="qz-status-strip">Layanan presensi belum tersedia di lingkungan ini.</div> : null}
    {actionError ? <div className="qz-inline-state qz-inline-state--error" role="alert">{actionError}</div> : null}
    {notice ? <div className="qz-inline-state" role="status">{notice}</div> : null}

    {role === 'teacher' ? <Card className="qz-attendance-create"><form className="qz-attendance-form" onSubmit={createSession}>
      <div className="qz-attendance-form__heading"><span><AttendanceIcon size={22} /></span><div><h2>Buat sesi presensi</h2><p>Koordinat dan radius ini menjadi acuan server saat siswa check-in.</p></div></div>
      <Input label="Nama sesi" value={form.title} onChange={setField('title')} maxLength={100} placeholder="Contoh: Pertemuan 3 · Sistem Pencernaan" />
      <label className="qz-field"><span>Pertemuan pembelajaran (opsional)</span><select value={form.sessionId} onChange={setField('sessionId')}><option value="">Tanpa pertemuan</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.meetingDate} · {session.title}{session.status === 'draft' ? ' (Draf)' : ''}</option>)}</select></label>
      <div className="qz-attendance-location-fields"><Input label="Latitude" type="number" step="any" value={form.latitude} onChange={setField('latitude')} placeholder="-6.98" /><Input label="Longitude" type="number" step="any" value={form.longitude} onChange={setField('longitude')} placeholder="109.64" /><Input label="Radius (meter)" type="number" min="10" max="1000" step="10" value={form.radiusMeters} onChange={setField('radiusMeters')} /></div>
      <div className="qz-attendance-form__actions"><Button type="button" variant="secondary" disabled={busy} onClick={useTeacherLocation}>{busy ? 'Membaca lokasi…' : 'Gunakan lokasi saya'}</Button><Button type="submit" disabled={!configured || busy || form.title.trim().length < 3 || form.latitude === '' || form.longitude === ''}>{busy ? 'Menyimpan…' : 'Simpan sebagai draf'}</Button></div>
    </form></Card> : null}

    {status === 'loading' ? <div className="qz-attendance-list" role="status" aria-label="Memuat presensi"><Skeleton height={160} /><Skeleton height={160} /></div> : null}
    {status === 'error' ? <div className="qz-inline-state qz-inline-state--error" role="alert">{attendanceErrorMessage(error)} <Button variant="ghost" size="sm" onClick={reload}>Coba lagi</Button></div> : null}
    {status !== 'loading' && status !== 'error' && attendance.length ? <div className="qz-attendance-list">{attendance.map((session) => {
      const meta = statusMeta(session.status);
      const alreadyPresent = Boolean(session.checkIn);
      return <Card key={session.id} className={`qz-attendance-session qz-attendance-session--${session.status}`}>
        <div className="qz-attendance-session__top"><div><Badge tone={meta.tone}>{meta.label}</Badge><h2>{session.title}</h2></div><AttendanceIcon size={24} /></div>
        <div className="qz-attendance-session__meta"><span>Radius <strong>{session.radiusMeters} m</strong></span><span>Mulai <strong>{formatDateTime(session.startedAt)}</strong></span><span>Selesai <strong>{formatDateTime(session.endedAt)}</strong></span></div>
        {role === 'teacher' ? <div className="qz-attendance-session__actions">{session.status === 'draft' ? <Button disabled={busyId === session.id} onClick={() => changeStatus(session.id, 'active')}>{busyId === session.id ? 'Memproses…' : 'Mulai sesi'}</Button> : null}{session.status === 'active' ? <Button variant="danger" disabled={busyId === session.id} onClick={() => changeStatus(session.id, 'ended')}>{busyId === session.id ? 'Memproses…' : 'Akhiri sesi'}</Button> : null}<Button variant="secondary" disabled={detailLoading} onClick={() => openRecap(session.id)}>Lihat rekap</Button></div> : <div className="qz-attendance-student-state">{alreadyPresent ? <><Badge tone="success">Hadir</Badge><span>Dicatat {formatDateTime(session.checkIn.checkedInAt)} · jarak {session.checkIn.distanceMeters} m</span></> : session.status === 'active' ? <Button disabled={busyId === session.id} onClick={() => checkIn(session.id)}>{busyId === session.id ? 'Memeriksa lokasi…' : 'Presensi sekarang'}</Button> : <><Badge tone="warning">Belum tercatat</Badge><span>Tidak ada check-in tersimpan untuk sesi ini.</span></>}</div>}
      </Card>;
    })}</div> : null}

    {status === 'success' && !attendance.length ? <Card><EmptyState icon={AttendanceIcon} title={role === 'teacher' ? 'Belum ada sesi presensi' : 'Belum ada riwayat presensi'} description={role === 'teacher' ? 'Buat sesi pertama, ambil titik lokasi, lalu buka sesi saat pertemuan dimulai.' : 'Sesi aktif dan riwayat presensi yang dibagikan guru akan muncul di sini.'} /></Card> : null}

    {role === 'teacher' && (detail || detailLoading) ? <section className="qz-attendance-recap" aria-live="polite">{detailLoading ? <Skeleton height={220} /> : <Card><div className="qz-attendance-recap__header"><div><span>Rekap sesi</span><h2>{detail.title}</h2></div><div><strong>{detail.summary?.presentCount || 0}</strong><span>hadir dari {detail.summary?.totalMembers || 0} siswa</span></div></div>{detail.recap?.length ? <ul className="qz-attendance-recap__list">{detail.recap.map((member) => <li key={member.uid}><span className="qz-member-avatar" aria-hidden="true">{member.name.charAt(0).toUpperCase()}</span><div><strong>{member.name}</strong><span>{member.checkIn ? `${formatDateTime(member.checkIn.checkedInAt)} · ${member.checkIn.distanceMeters} m dari titik` : 'Belum ada check-in tercatat'}</span></div><Badge tone={member.status === 'present' ? 'success' : 'warning'}>{member.status === 'present' ? 'Hadir' : 'Belum tercatat'}</Badge></li>)}</ul> : <EmptyState icon={MembersIcon} title="Belum ada anggota" description="Rekap akan terisi setelah siswa bergabung dan melakukan presensi." />}</Card>}</section> : null}
  </div>;
}
