# UPDATE / AI AGENT ENTRYPOINT — Nalaro Class

## Pembaruan release 2 Oktober 2026

Main sudah mengintegrasikan PR #5/#6/#7 dengan otorisasi pengguna pada `readthis.md`; instruksi lama di bawah tentang menunggu merge tidak berlaku untuk release ini. Remote `pages` sudah menunjuk `khoirulzz/nalaroclass`, dan kedua repository disinkronkan. Frontend Pages memakai Worker produksi, Firebase Auth/Firestore, Cloudinary, serta Durable Object WebSocket + D1 hasil Live.

Worker `247b0f1c-4018-428c-bf5b-ba3f294c67a6`, D1 hingga `0012`, dan Pages aplikasi `f8b81d3a-7790-48a4-8d85-682aa597b577` / source `d91d115` sudah terdeploy. Validasi lokal dan API/browser Chrome desktop/mobile viewport lulus, termasuk unggahan file nyata dan Live 1 host + 4 pemain, recovery, deadline tanpa host, persistence/CSV/Insights.

Status **RELEASE CANDIDATE**: perangkat fisik/jaringan nyata dan kamera/GPS opsional belum diuji; kapasitas di atas 4 pemain belum diukur. Mulai dari [status aktif](docs/nalaro-project-status.md) dan [laporan release/rollback](docs/production-release-2026-10.md). Bagian lama di bawah dipertahankan sebagai histori, bukan bukti deployment terkini.

CI pada repo Pages lulus; CI repo asal `hulumzz/Quizzy` belum dapat mulai karena account lock terkait billing GitHub. Tidak ada perubahan paket berbayar.

## Snapshot handoff 1 Oktober (histori)


Terakhir diperbarui: 1 Oktober 2026

Baca file ini terlebih dahulu sebelum melanjutkan pekerjaan pada repository ini.

## Posisi pekerjaan terbaru

Pekerjaan aktif saat ini berada pada stacked PR:

1. **PR #5 — Quiz hardening & UX**
   - branch: `fix/quiz-hardening-ux`
2. **PR #6 — Nalaro Learning Insights**
   - branch: `feat/learning-insights`
3. **PR #7 — Live security + realtime + persistent results**
   - branch: `feat/live-security-realtime`
   - base saat ini: `feat/learning-insights`

User akan melakukan merge sendiri. Jangan auto-merge tanpa instruksi.

Urutan yang disarankan:

1. merge PR #5;
2. merge PR #6;
3. retarget PR #7 ke `main`;
4. pertahankan versi Live realtime PR #7 saat menyelesaikan overlap dengan PR #5;
5. baru merge PR #7 setelah validation.

## Tiga pekerjaan terakhir yang sudah diimplementasikan

### 1. Server-side role enforcement

Frontend route guard bukan lagi satu-satunya pembatas.

Worker sekarang:
- memverifikasi Firebase ID token;
- membaca role dari profil Firestore milik UID yang sama;
- mempercayai role hanya setelah verifikasi;
- mencache role verified di D1 maksimal 24 jam;
- menolak legacy D1 role yang belum verified;
- menerapkan teacher/student boundary pada route sensitif.

Migration:
- `workers/migrations/0010_verified_account_roles.sql`

File utama:
- `workers/src/services/account-role.js`
- `workers/src/middleware/auth.js`

### 2. Nalaro Live WebSocket realtime

Transport state utama Live dipindah dari polling REST menjadi Durable Object WebSocket.

Prinsip:
- scoring tetap server-authoritative;
- submit answer tetap REST;
- advance/finish host tetap REST;
- WebSocket hanya mengirim state realtime;
- host memakai one-time socket ticket;
- player reconnect memakai participant token;
- initial REST fetch tetap dipakai untuk bootstrap/recovery.

File utama:
- `workers/src/durable/LiveQuizRoom.js`
- `workers/src/routes/live-quizzes.js`
- `src/services/live-quiz.service.js`
- `src/pages/LiveQuizHost.jsx`
- `src/pages/LiveQuizPlayer.jsx`

### 3. Persistent Live result + reporting

Room Durable Object tetap sementara, tetapi hasil akhir kini disalin idempotent ke D1.

Migration:
- `workers/migrations/0011_live_quiz_results.sql`

Tabel:
- `live_quiz_sessions`
- `live_quiz_results`
- `live_quiz_answer_results`

Guru kini mendapat:
- riwayat Nalaro Live kelas;
- ranking final;
- akurasi per soal;
- CSV export;
- riwayat/report untuk kuis umum;
- retry persist jika penyimpanan final gagal.

File utama:
- `workers/src/repositories/live-result.repository.js`
- `src/pages/ClassQuizzes.jsx`
- `src/pages/teacher/TeacherGeneralQuizzes.jsx`

## Live → Learning Insights

Jika peserta Live:
- login sebagai student;
- role verified;
- merupakan member kelas;

maka result Live dapat dipetakan ke `student_id` dan menjadi strong evidence Learning Insights.

Jika peserta masuk tanpa login:
- result tetap tersimpan di report;
- `student_id=NULL`;
- result **tidak** ditebak sebagai siswa hanya berdasarkan nama.

Mastery weights saat ini:
- self-paced quiz: 1.00;
- graded task: 1.15;
- verified Nalaro Live: 0.90.

File:
- `workers/src/repositories/learning-analytics.repository.js`
- `docs/learning-insights.md`

## Migration order

Produksi remote terakhir yang tercatat baru sampai `0008`.

Sebelum Worker terbaru dipakai penuh, migration berikut harus diterapkan berurutan:

- `0009_learning_analytics_indexes.sql`
- `0010_verified_account_roles.sql`
- `0011_live_quiz_results.sql`

Jangan menjalankan remote migration atau deploy tanpa instruksi user.

## Validation status

Sudah:
- source/diff review;
- regression test source ditambahkan;
- Worker/test JS yang berubah sudah melalui syntax parse tanpa syntax error;
- Cloudflare Pages branch preview berhasil deploy untuk PR #7.

Belum:
- full `npm run validate` berhasil di GitHub Actions;
- Actions job terbaru gagal sebelum step berjalan (`steps=[]`, log tidak terbentuk);
- D1 remote migration 0009–0011;
- Worker terbaru production deploy;
- authenticated production smoke;
- multi-device WebSocket E2E;
- load/capacity test Live.

Jangan menyebut pekerjaan ini production-ready sebelum gate tersebut selesai.

## Test files terbaru

- `workers/test/account-role.test.js`
- `workers/test/live-results.test.js`
- `workers/test/live-room.test.js`
- `workers/test/learning-analytics.test.js`
- `workers/test/ai-worker.test.js`
- `workers/scripts/smoke-auth.mjs`

## Source of truth lanjutan

Baca detail lengkap:

- `docs/ai-agent-handoff-2026-10-01.md`
- `docs/nalaro-project-status.md`
- `docs/learning-insights.md`
- `docs/cloudflare-backend-migration-status.md`

## Prinsip yang jangan dirombak

- server authoritative;
- frontend role guard hanya UX, bukan security;
- jangan mapping participant ke siswa berdasarkan nama;
- engagement/presensi tidak boleh menaikkan mastery;
- jangan buat leaderboard kemampuan siswa pada Learning Insights;
- jangan persist raw biometric image;
- jangan simpan secret di frontend/Git;
- Cloudflare/free-first;
- jangan menambah AWS/resource berbayar tanpa izin user.
