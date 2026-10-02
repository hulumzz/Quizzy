UPDATE.md — Nalaro Class / Quizzy

Terakhir diperbarui: 3 Oktober 2026

Repository utama: hulumzz/Quizzy
Repository deployment Pages: khoirulzz/nalaroclass
Baseline HEAD yang diaudit: ba42d8f71f3c88acea569b93949872d5ec1d28b9

Patch Face Attendance dan histori nama, 3 Oktober 2026: checkpoint A–E selesai pada working tree lokal. Audit lanjutan memperbaiki fixture tes presensi agar memakai validator API, menambah regression test boundary Human yaw/pitch, snapshot nama setelah membership berubah/dihapus, fallback data lama, migrasi berisi data historis, duplikasi, GPS wajib, serta serializer list/detail/rekap. Badge rekap disesuaikan untuk layar kecil. Migrasi D1 lokal sudah sampai 0014. Lint/build/test/full validate lulus (59 tes Worker); belum commit, push, deploy, atau verifikasi browser/perangkat/produksi untuk patch ini. Detail dan gate berikutnya ada di docs/nalaro-project-status.md.

Baca file ini terlebih dahulu sebelum mengubah kode. File ini hanya memuat kondisi aktif, bug aktif, prioritas berikutnya, dan aturan kerja. Histori release lama tetap berada di docs/ dan tidak perlu dimuat ke konteks AI kecuali relevan.

1. Status saat ini

Nalaro Class sudah live sebagai Release Candidate.

Arsitektur produksi saat ini:

Frontend: React + Vite di Cloudflare Pages.

API LMS: Cloudflare Worker + Hono.

Database LMS: Cloudflare D1.

Nalaro Live: Durable Object SQLite + WebSocket Hibernation.

Firebase: Authentication + profil/peran + Face Profile.

Cloudinary: media/file.

Groq: AI Assist melalui Worker.

backend/ AWS adalah legacy dan bukan jalur frontend produksi.

Repo hulumzz/Quizzy dan khoirulzz/nalaroclass sudah sinkron pada commit yang diaudit.

Migrasi D1 produksi sudah sampai 0012_live_result_completion.sql.

Validasi/release sebelumnya sudah mencakup:

lint/build/test lokal;

API produksi;

browser desktop/mobile viewport;

kelas, materi, diskusi, kuis, tugas, presensi online;

Bank Kuis;

Learning Insights;

Nalaro Live 1 host + 4 browser context;

reconnect, deadline server, hasil D1, CSV, dan Insights.

Yang belum menjadi bukti release final:

Live pada 3–5 perangkat fisik berbeda/jaringan nyata;

kamera/GPS pada perangkat fisik;

load test Live di atas 4 pemain;

kalibrasi Face Recognition pada variasi perangkat/pencahayaan.

2. Kondisi fitur utama

Quiz

Sudah:

self-paced satu soal per layar;

navigator/progress;

autosave per tab;

restore setelah refresh;

Arrange stabil;

review Arrange/Hotspot type-specific;

result guru memakai snapshot nama siswa, dengan fallback membership untuk attempt lama;

editor add/duplicate/delete/reorder/preview;

pilihan ganda 2–6 opsi unik;

soal/kunci dikunci setelah sudah ada attempt;

hasil siswa tersimpan satu kali.

Masih perlu perbaikan kecil:

urutan shuffleQuestions belum dipersistenkan dalam draft sehingga dapat berubah setelah reload;

soal Arrange yang baru diinisialisasi langsung dianggap “terjawab” walaupun siswa belum menyentuhnya;

Snapshot quiz_attempts.student_name sudah diimplementasikan dan diuji lokal; migrasi remote dan deploy patch belum dilakukan.

Task

Sudah:

timezone datetime-local benar;

Learning Session selector;

submission/revision;

snapshot jawaban teks dan lampiran lama;

grading/feedback.

Technical debt kecil:

grading memakai satu state busy, sehingga aksi satu siswa dapat mengunci kontrol siswa lain.

Nalaro Live

Sudah:

Durable Object;

WebSocket;

server-authoritative scoring;

server deadline/alarm;

reconnect;

host socket ticket;

participant token;

duplicate/rejoin protection;

persistent D1 result;

CSV;

Learning Insights integration.

Belum:

uji 3–5 HP fisik;

pengukuran kapasitas kelas nyata.

Learning Insights

Sudah menjadi fitur aktif dan production-connected.

Mastery hanya memakai:

self-paced quiz;

graded task;

authenticated Nalaro Live.

Presensi/progres materi/diskusi tidak menaikkan mastery.

Belum ada kebutuhan redesign saat ini. Lakukan load test lebih dulu sebelum membuat cache/arsitektur baru.

3. Face Attendance — perbaikan selesai dan tervalidasi lokal

3.1 Rotation unit Human.js salah diperlakukan sebagai degree

File utama:

src/features/face/face-engine.js

src/features/face/face-challenge.js

src/features/face/face-engine.test.js

Bug baseline: face.rotation.angle.yaw/pitch langsung digunakan terhadap threshold seperti:

12

15

16

Padahal nilai rotation Human.js perlu dinormalisasi ke degree sebelum dipakai oleh threshold internal Nalaro.

Akibatnya challenge kiri/kanan dapat gagal walaupun pengguna sudah menoleh. Patch kini mengonversi yaw/pitch di readFace(); regression test memakai output Human dalam radian dan menguji challenge serta guidance dalam degree. Threshold tetap sama; perangkat nyata masih perlu diuji.

Target perbaikan:

const radiansToDegrees = (value) =>
  Number.isFinite(value) ? value * 180 / Math.PI : 0;

Normalisasi dilakukan di boundary readFace() sehingga seluruh domain internal Face Nalaro memakai degree.

Unit test harus memakai input radian/konversi nyata, bukan hanya angka -13/13 seolah berasal langsung dari model.

3.2 Presensi wajah belum tercatat sebagai metode verifikasi backend

Flow baseline sebelum patch:

Face match di browser
→ onVerified()
→ checkInAttendance() biasa
→ D1

Backend patch lokal kini membedakan:

presensi biasa;

presensi wajah.

UI guru pada patch lokal dapat membuat sesi yang:

standar;

wajah opsional;

wajah wajib.

Kontrak yang sudah diimplementasikan dan diuji lokal:

attendance_sessions.verification_mode
  standard
  face_optional
  face_required

attendance_checkins.verification_method
  standard
  face

Lokasi tetap orthogonal:

online + standard
online + face
on_site + standard
on_site + face

Untuk MVP saat ini, face matching tetap berjalan full browser sesuai keputusan produk. Jangan memindahkan recognition ke AWS/Rekognition/CompreFace.

Detail implementasi ada di:

ai-agent-face-attendance-and-history-fixes.md

4. Histori nama siswa pada hasil kuis

Masalah baseline yang sudah diperbaiki lokal:

quiz_attempts sebelumnya hanya menyimpan student_id.

Teacher result sebelumnya menyelesaikan nama dari class_members ketika halaman dibuka. Jika membership berubah/dihapus, attempt lama dapat tampil sebagai:

Siswa tidak diketahui

Target:

quiz_attempts.student_name

Nama disnapshot saat submit dari data server-side class_members, bukan dari request browser.

Data lama tetap kompatibel:

backfill nama jika membership masih ada;

jika snapshot kosong, fallback ke nama membership terkini;

jika keduanya tidak ada, baru gunakan Siswa tidak diketahui.

5. Checklist patch dan prioritas berikutnya

STEP 1–3 selesai di kode dan validasi lokal. Berikutnya deploy/migrasi remote hanya atas instruksi eksplisit pengguna, lalu STEP 4 sebagai gate perangkat. STEP 5 tetap di luar patch ini.

STEP 1 — Fix Face rotation (selesai lokal)

normalisasi radian → degree;

perbaiki regression test;

jangan ubah threshold sebelum tes device.

STEP 2 — Attendance verification contract (selesai lokal)

Tambahkan migration baru setelah 0012:

0013_attendance_verification.sql

Implementasikan:

verificationMode pada session;

verificationMethod pada check-in;

validasi Worker;

UI guru memilih metode;

UI siswa mengikuti metode;

teacher recap menampilkan metode;

GPS tetap diproses bila locationMode=on_site.

STEP 3 — Permanent student name snapshot (selesai lokal)

Tambahkan:

0014_quiz_attempt_student_name.sql

Implementasikan snapshot nama saat submit dan fallback untuk data lama.

STEP 4 — Device gate

Uji minimal:

Android Chrome;

desktop Chrome;

kamera allow/deny;

cahaya normal/redup;

daftar wajah;

match wajah;

salah wajah;

face optional;

face required;

GPS on-site;

Live 1 host + 3–5 perangkat nyata;

putus/sambung Wi-Fi.

STEP 5 — Cleanup kecil

Setelah P1 selesai:

persist questionOrder pada draft self-paced;

pisahkan status Arrange touched dari nilai initial order;

scoped busy state grading;

benchmark Learning Insights;

pertimbangkan CSP;

rapikan dependency/model delivery Face bila diperlukan.

6. Aturan Face MVP yang jangan diubah

Recognition tetap full browser untuk fase sekarang.

Tidak memakai AWS Rekognition.

Tidak memakai CompreFace server.

Tidak menyimpan foto/video mentah.

Face Profile tetap hanya dapat diakses UID pemilik.

Embedding tetap dianggap data biometrik sensitif.

Jangan kirim roster embedding kelas ke browser.

Matching tetap 1:1 terhadap profil user login.

Backend tetap authoritative untuk:

auth;

role;

membership;

status attendance;

duplicate;

lokasi/radius.

verificationMethod=face pada MVP adalah trust layer client sesuai threat model saat ini.

Struktur harus tetap mudah dimigrasikan ke server verification nanti.

7. Validation setelah perubahan

Minimal:

npm run lint
npm run build
npm run test:frontend
npm run test:workers
npm run validate
git diff --check

Untuk migration lokal:

npm --prefix workers run migrate:local
npm --prefix workers test

Jangan deploy Worker, migration remote, Pages, atau menghapus AWS tanpa instruksi eksplisit user.

8. Source of truth

Gunakan:

update.md — konteks aktif;

ai-agent-face-attendance-and-history-fixes.md — brief implementasi patch;

docs/nalaro-project-status.md — status/release history;

docs/production-release-2026-10.md — bukti release dan rollback;

docs/face-attendance-mvp.md — batas keamanan Face MVP;

docs/learning-insights.md — metodologi analitik.

Jangan menjadikan snapshot handoff lama sebagai status aktif bila bertentangan dengan file ini atau source terbaru.

9. Definisi selesai untuk patch berikutnya

Patch dianggap selesai bila:

challenge Face menggunakan unit degree yang benar;

test mencegah regression radian/degree;

sesi attendance memiliki verificationMode;

check-in menyimpan verificationMethod;

face_required tidak menerima check-in standard;

face_optional menerima standard maupun face;

on-site tetap memvalidasi GPS/radius;

teacher recap menampilkan metode verifikasi;

quiz attempt baru menyimpan snapshot nama siswa;

attempt lama tetap dapat dibaca;

lint/build/test lulus;

tidak ada raw biometric image atau secret baru di repository.
