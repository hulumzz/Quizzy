# AI Agent Handoff — Nalaro Class / Quizzy

## Pembaruan release 2 Oktober 2026

Main sudah mengintegrasikan PR #5/#6/#7 dengan otorisasi pengguna pada `readthis.md`; instruksi lama di bawah tentang menunggu merge tidak berlaku untuk release ini. Remote `pages` sudah menunjuk `khoirulzz/nalaroclass`, dan kedua repository disinkronkan. Frontend Pages memakai Worker produksi, Firebase Auth/Firestore, Cloudinary, serta Durable Object WebSocket + D1 hasil Live.

Worker `247b0f1c-4018-428c-bf5b-ba3f294c67a6`, D1 hingga `0012`, dan Pages aplikasi `f8b81d3a-7790-48a4-8d85-682aa597b577` / source `d91d115` sudah terdeploy. Validasi lokal dan API/browser Chrome desktop/mobile viewport lulus, termasuk unggahan file nyata dan Live 1 host + 4 pemain, recovery, deadline tanpa host, persistence/CSV/Insights.

Status **RELEASE CANDIDATE**: perangkat fisik/jaringan nyata dan kamera/GPS opsional belum diuji; kapasitas di atas 4 pemain belum diukur. Mulai dari [status aktif](nalaro-project-status.md) dan [laporan release/rollback](production-release-2026-10.md). Bagian lama di bawah dipertahankan sebagai histori, bukan bukti deployment terkini.

CI pada repo Pages lulus; CI repo asal `hulumzz/Quizzy` belum dapat mulai karena account lock terkait billing GitHub. Tidak ada perubahan paket berbayar.

## Handoff awal 1 Oktober (histori)

Tanggal: 1 Oktober 2026

Dokumen ini adalah handoff terbaru setelah migrasi backend Cloudflare, hardening kuis, Nalaro Learning Insights, server-side role enforcement, persistensi hasil Nalaro Live, dan WebSocket realtime.

> Baca dokumen ini bersama `docs/nalaro-project-status.md` dan `docs/learning-insights.md` sebelum mengubah arsitektur. Jangan memakai dokumen AWS lama sebagai source of truth tanpa mencocokkan source Worker terbaru.

## 1. Branch / PR stack

Repository: `hulumzz/Quizzy`

Pekerjaan terbaru dipisah agar mudah direview:

1. PR #5 — branch `fix/quiz-hardening-ux`
   - hardening correctness kuis;
   - UX self-paced dan Nalaro Live;
   - host recovery, timer, animasi, privacy payload hotspot/arrange.
2. PR #6 — branch `feat/learning-insights`
   - Nalaro Learning Insights v1.
3. PR #7 — branch `feat/live-security-realtime` (stacked di atas PR #6)
   - dibuat di atas `feat/learning-insights`;
   - membawa bagian Live yang relevan dari PR #5 agar tidak meregresikan UX;
   - menambahkan trusted role enforcement, WebSocket, persistence/report Live, dan Live → Learning Insights.

User akan melakukan merge sendiri. Jangan auto-merge tanpa instruksi.

## 2. Arsitektur yang dianggap benar

Frontend:
- React + Vite;
- Firebase Auth;
- Firestore hanya untuk profil pengguna dan Face Profile MVP;
- Cloudinary upload langsung dengan signature server.

Backend utama:
- Cloudflare Worker di `workers/`;
- D1 binding `DB` sebagai source of truth LMS;
- Durable Object `LIVE_QUIZ` untuk state sesi Live aktif;
- Nalaro Live memakai WebSocket Hibernation untuk state delivery;
- REST tetap dipakai untuk mutation host dan submit answer;
- scoring tetap server-authoritative di Durable Object.

Legacy:
- `backend/` AWS Lambda/DynamoDB/SQS/SAM masih ada tetapi bukan target arsitektur baru;
- jangan menghidupkan kembali AWS atau membuat resource berbayar tanpa instruksi eksplisit.

## 3. Trusted role enforcement

Masalah lama:
frontend memiliki `RequireRole`, tetapi server terutama mengandalkan ownership/membership dan belum memiliki trusted global teacher/student role.

Implementasi baru:
- profil Firestore `users/{uid}` memiliki field `role`;
- Firestore rules mengizinkan role dipilih saat profil dibuat, lalu role dan uid tidak dapat diganti browser;
- Worker memverifikasi Firebase ID token;
- Worker membaca profil Firestore milik UID yang sama melalui REST menggunakan bearer token tersebut;
- hasil role dicache di D1 dengan:
  - `users.role_verified = 1`;
  - `users.role_verified_at`;
- cache berlaku maksimum 24 jam, kemudian Firestore direvalidasi;
- legacy D1 role dengan `role_verified=0` tidak dipercaya.

File utama:
- `workers/src/services/account-role.js`
- `workers/src/middleware/auth.js`
- `workers/migrations/0010_verified_account_roles.sql`
- `firestore.rules`

Helper:
- `getAccountRole(c)`
- `assertAccountRole(c, ...allowed)`
- `optionalAuth`

Boundary utama:
- create/manage kelas → teacher;
- join kelas → student;
- create/update/delete materi → teacher;
- progress/bookmark → student;
- create/edit/export kuis → teacher;
- attempt kuis → student;
- create/grade tugas → teacher;
- submit tugas/upload jawaban → student;
- create/status presensi → teacher;
- check-in → student;
- Bank Kuis dan AI Assist → teacher;
- class analytics → teacher;
- personal analytics → student;
- host Live → teacher.

Jangan mengembalikan authorization authority ke `userProfile.role` frontend.

## 4. Nalaro Live realtime

### Active room

State sesi aktif tetap berada di DO SQLite:
- room;
- participants;
- answers;
- join rate;
- socket tickets.

File:
- `workers/src/durable/LiveQuizRoom.js`
- `workers/src/routes/live-quizzes.js`
- `src/services/live-quiz.service.js`
- `src/pages/LiveQuizHost.jsx`
- `src/pages/LiveQuizPlayer.jsx`

### WebSocket flow

Public/player:
1. browser membuka `GET /live-quizzes/:code/socket` sebagai WebSocket;
2. DO menerima dengan `ctx.acceptWebSocket`;
3. initial public state dikirim;
4. participant mengirim `auth-participant` dengan participantId + participantToken;
5. perubahan join/answer/phase dibroadcast dari DO;
6. ketika finished, participant yang terautentikasi di socket menerima final result.

Host:
1. host meminta one-time ticket lewat authenticated REST:
   - class: `POST /classes/:classId/live-sessions/:id/socket-ticket`
   - general: `POST /general-quizzes/live-sessions/:id/socket-ticket`
2. tiket berlaku sekitar 60 detik dan sekali pakai;
3. host connect ke public socket endpoint;
4. host mengirim `auth-host` + ticket;
5. DO meng-upgrade attachment menjadi role host dan mulai mengirim hostState.

Frontend reconnect:
- host meminta ticket baru pada reconnect;
- player reconnect memakai participant token yang sama;
- initial REST GET tetap dipakai untuk bootstrap/recovery;
- polling state 1–2 detik bukan lagi transport utama.

Mutation tetap REST:
- advance / finish;
- submit answer;
- retry persistence.

Jangan memindahkan scoring ke browser.

## 5. Live answer privacy

Public question payload tidak boleh membocorkan answer key.

`safeQuestion` harus menjaga:
- hotspot: tidak mengirim geometry area benar atau tolerance;
- arrange: initial item order tidak identik dengan correctOrder;
- correctAnswer hanya muncul pada reveal.

Regression test ada di:
- `workers/test/live-room.test.js`

## 6. Persistent Nalaro Live results

Migration:
- `workers/migrations/0011_live_quiz_results.sql`

D1 tables:
- `live_quiz_sessions`
- `live_quiz_results`
- `live_quiz_answer_results`

Yang disimpan:
- metadata sesi;
- safe question metadata;
- participant name;
- optional verified student_id;
- score;
- correct count;
- rank;
- per-question correct + earned points.

Raw answer JSON tidak disalin ke D1 reporting tables.

Repository:
- `workers/src/repositories/live-result.repository.js`

Persist flow:
1. host menyelesaikan sesi;
2. DO set phase finished;
3. snapshot akhir di-UPSERT ke D1;
4. `persistenceStatus = persisted|failed|unavailable`;
5. jika gagal, host dapat retry;
6. alarm DO juga mencoba lagi sebelum room expired.

Endpoint laporan kelas:
- `GET /classes/:classId/live-results`
- `GET /classes/:classId/live-results/:sessionId`
- `GET /classes/:classId/live-results/:sessionId/export`

Endpoint kuis umum:
- `GET /general-quizzes/live-results`
- `GET /general-quizzes/live-results/:sessionId`
- `GET /general-quizzes/live-results/:sessionId/export`

UI:
- `src/pages/ClassQuizzes.jsx`: history, detail, per-question accuracy, ranking, CSV;
- `src/pages/teacher/TeacherGeneralQuizzes.jsx`: history, ranking, CSV;
- `src/pages/LiveQuizHost.jsx`: persistence status + retry.

## 7. Identity mapping Live

Nalaro Live tetap dapat dimainkan tanpa login.

Public participant:
- result disimpan untuk laporan;
- `student_id = NULL`;
- jangan menebak UID berdasarkan nama.

Authenticated student:
1. join memakai optional Firebase Authorization;
2. Worker memverifikasi role student;
3. Worker memastikan siswa memang member class;
4. UID dikirim internal ke DO sebagai studentId;
5. persistent result mendapat `student_id`;
6. jika UID yang sama reconnect di lobby, participant existing dipakai lagi, bukan membuat analytic identity ganda.

Join response baru mengirim keduanya untuk kompatibilitas:
- `id`
- `participantId`

Player juga menormalisasi sessionStorage lama yang hanya memiliki `id`.

## 8. Nalaro Learning Insights

Dokumen metodologi:
- `docs/learning-insights.md`

Engine:
- `workers/src/repositories/learning-analytics.repository.js`

UI:
- `src/pages/ClassAnalytics.jsx`

Strong evidence mastery:
- self-paced quiz average: weight 1.00;
- graded task average: weight 1.15;
- authenticated Nalaro Live average: weight 0.90.

Live score dinormalisasi:
`participant score / session total points * 100`.

Live result hanya masuk Learning Insights jika:
- `student_id` valid;
- participant join memakai akun student verified;
- UID tersebut member class.

Public Live player tidak pernah masuk profil student analytics.

Dimensi tetap:
- mastery;
- consistency;
- engagement;
- trend;
- revision response;
- confidence/keyakinan data.

Learning Session tetap unit topic/pertemuan.

## 9. D1 migration order

Remote production yang terakhir tercatat baru sampai `0008`.

Perubahan baru:
- `0009_learning_analytics_indexes.sql`
- `0010_verified_account_roles.sql`
- `0011_live_quiz_results.sql`

Jalankan berurutan setelah source sudah digabung dan sebelum Worker baru dipakai penuh.

Perintah referensi dari folder `workers`:

    npm.cmd exec -- wrangler d1 migrations list nalaro --remote --config wrangler.json
    npm.cmd run migrate:remote
    npm.cmd exec -- wrangler deploy --dry-run --keep-vars --config wrangler.json
    npm.cmd exec -- wrangler deploy --keep-vars --config wrangler.json

Jangan menjalankan migration/deploy hanya karena membaca handoff. Butuh instruksi user atau workflow rilis yang memang sedang dijalankan.

## 10. Tests / validation source

Ditambah:
- `workers/test/learning-analytics.test.js`
- `workers/test/account-role.test.js`
- `workers/test/live-results.test.js`

Diupdate:
- `workers/test/live-room.test.js`
- `workers/test/ai-worker.test.js`
- `workers/scripts/smoke-auth.mjs`

Coverage penting:
- role Firestore → D1 verified cache;
- legacy role tidak dipercaya sebelum verification;
- privacy hotspot/arrange;
- participant identity contract;
- authenticated reconnect tidak duplicate participant;
- Live result persistence idempotent;
- report owner-only;
- Live authenticated result → Learning Insights;
- anonymous Live result tidak masuk Learning Insights.

Smoke test baru:
- membuat Firebase teacher + student;
- membuat profil Firestore role yang valid;
- menjalankan class/quiz/task/Live;
- authenticated Live join;
- memeriksa persistent report;
- memeriksa Live masuk Learning Insights;
- menjalankan AI Assist;
- membersihkan D1, Firestore profile, dan Firebase account uji.

### Status validasi

Jangan klaim branch ini lulus CI/production hanya dari keberadaan test.

Pada pekerjaan 1 Okt:
- source dan kontrak direview;
- test source ditulis;
- GitHub Actions PR #7 yang diamati (run #10 dan #11) sama-sama gagal sebelum memperoleh runner: job `validate` selesai failure dengan `steps=null`; pola yang sama terjadi pada PR sebelumnya;
- snapshot branch belum berhasil didownload ke runtime lokal untuk menjalankan npm test;
- migration remote dan deployment belum dilakukan;
- browser/multi-device WebSocket test belum dilakukan.

## 11. Merge strategy

Karena pekerjaan bertumpuk:

1. review/merge PR #5 untuk seluruh quiz hardening;
2. review/merge PR #6 untuk Learning Insights;
3. kemudian review PR #7 / branch `feat/live-security-realtime`. PR #7 saat dibuat memakai base `feat/learning-insights`; setelah PR #6 masuk ke main, retarget PR #7 ke `main` sebelum merge.

Branch ketiga sudah membawa versi Live Host/Player/DO/style yang kompatibel dengan hardening PR #5, tetapi **tidak menggantikan semua perubahan self-paced PR #5**.

Jika terjadi conflict:
- pertahankan UX/hardening terbaru PR #5;
- pertahankan halaman/route Learning Insights PR #6;
- pertahankan role enforcement, WebSocket, persistence Live, dan Live analytics dari branch ketiga;
- jangan memilih versi main lama hanya karena conflict lebih mudah.

## 12. Deploy / cutover order

Setelah merge source:
1. jalankan full validation lokal/CI;
2. apply D1 migrations 0009–0011;
3. deploy Worker;
4. smoke authenticated API;
5. deploy/sinkronkan frontend Pages;
6. test teacher + student browser;
7. test Nalaro Live minimal 2–5 perangkat;
8. test socket disconnect/reconnect;
9. finish Live dan cek report D1;
10. cek authenticated result muncul di Learning Insights;
11. cek anonymous result tidak masuk student analytics.

Jangan mematikan AWS lama sampai cutover Cloudflare terbaru benar-benar terverifikasi.

## 13. Gate yang masih terbuka

Masih wajib diuji sebelum menyebut production-ready:
- WebSocket upgrade di Worker production;
- DO hibernation/reconnect perangkat nyata;
- host refresh dan participant reconnect;
- concurrency/capacity kelas target;
- role verification pada akun lama yang belum memiliki profil valid;
- D1 migrations remote;
- laporan/CSV browser;
- Live → Learning Insights;
- Cloudinary upload file nyata;
- Face Attendance pada kamera nyata.

## 14. Prinsip yang jangan dirombak

- server authoritative;
- frontend role guard hanya UX, bukan security;
- jangan pakai nama participant untuk identity mapping;
- jangan masukkan engagement ke mastery;
- jangan buat ranking kemampuan siswa di Learning Insights;
- jangan persist raw biometric image;
- jangan simpan secret di frontend/Git;
- free-first / Cloudflare-first;
- jangan menambah AWS berbayar tanpa izin.
