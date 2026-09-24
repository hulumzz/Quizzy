# Handoff Pengembangan Quizzy - 24 September 2026

Dokumen ini adalah **source of truth handoff terbaru** untuk melanjutkan Quizzy dari agent lain atau environment lokal. Instruksi pemilik yang lebih baru tetap mengalahkan dokumen ini.

Dokumen pendamping yang relevan:

- `blueprint (1).md`
- `docs/phase-10-and-learning-roadmap.md`
- `docs/architecture-status.md`

Catatan: referensi lama ke `implementation-plan.md` dihapus karena file tersebut tidak ada pada tree repository saat handoff ini diperbarui.

## Handoff ke Agent Lokal

### Branch yang harus dipakai

Branch kerja paling lengkap saat ini:

```text
feat/learning-sessions
```

Branch tersebut sudah membawa seluruh ancestry perubahan dari dua fase sebelumnya:

```text
main
└─ fix/p0-correctness-security        PR #2
   └─ chore/p1-production-hardening   PR #3
      └─ feat/learning-sessions       PR #4
```

Status GitHub saat handoff ini diperbarui:

- `main`: baseline sebelum tiga fase di atas;
- PR #2 `fix/p0-correctness-security`: open, draft;
- PR #3 `chore/p1-production-hardening`: open, draft, base PR #2;
- PR #4 `feat/learning-sessions`: open, draft, base PR #3.

Jika tujuan agent lokal adalah **melanjutkan development dari kondisi paling baru**, jangan mulai lagi dari `main`. Checkout langsung branch `feat/learning-sessions`.

Contoh:

```powershell
git fetch origin
git checkout feat/learning-sessions
git pull origin feat/learning-sessions
```

Jika branch belum ada di lokal:

```powershell
git fetch origin feat/learning-sessions
git checkout -b feat/learning-sessions origin/feat/learning-sessions
```

Sebelum mengubah kode, cek:

```powershell
git status
git log --oneline --decorate -20
git diff origin/chore/p1-production-hardening...HEAD
```

Jangan reset, squash, rebase, atau menghapus commit stacked PR tanpa instruksi pemilik.

### Ringkasan pekerjaan tiga fase terakhir

#### Fase P0 - correctness dan security

Branch: `fix/p0-correctness-security`.

Sudah dikerjakan:

- Firebase verification pada AI Worker dipindahkan ke Google/Firebase JWKS yang valid;
- claim penting Firebase diverifikasi dan rotasi `kid` ditangani dengan refresh JWKS;
- outage signing-key dibedakan dari invalid token;
- live answer SQS membawa deadline soal asli;
- jawaban yang sudah diterima sebelum deadline tidak hilang hanya karena host berpindah phase/soal;
- transient DynamoDB transaction cancellation tetap retryable oleh SQS;
- duplicate answer hanya dianggap duplicate jika record answer canonical memang sudah ada;
- leaderboard dan personal result terus refresh setelah `finished` agar queue drain tidak membekukan snapshot terlalu awal;
- regression tests untuk auth Worker dan race live quiz ditambahkan.

#### Fase P1 - production hardening

Branch: `chore/p1-production-hardening`.

Sudah dikerjakan:

- list peserta live mengikuti pagination DynamoDB dan tidak berhenti di 100 peserta;
- live-answer processor mencatat batch summary `records/processed/discarded/retry`;
- DynamoDB read/write capacity dan SQS processor concurrency menjadi parameter SAM;
- default resource tetap development/free-first: 1 RCU, 1 WCU, concurrency 5;
- log processor dibatasi retention 7 hari;
- queue URL dan DLQ URL tersedia sebagai CloudFormation outputs;
- root validation mencakup Worker tests;
- `validate:infra` dan `validate:all` tersedia;
- backend syntax-check diperluas ke modul backend aktif.

CloudWatch alarm queue/DLQ belum ditambahkan karena dapat menambah biaya dan masih memerlukan persetujuan pemilik.

#### Fase Learning Sessions

Branch: `feat/learning-sessions`.

Sudah dikerjakan:

- entity `LEARNING_SESSION` per kelas;
- create/get/list/update/reorder API;
- status `draft/published/archived`;
- siswa hanya menerima pertemuan published;
- maksimal 100 pertemuan per kelas agar reorder tetap atomik;
- reorder menolak payload parsial/stale;
- `sessionId` opsional pada materi, kuis kelas, dan presensi;
- assignment resource diverifikasi server-side;
- archived session tidak menerima assignment baru;
- resource yang sudah tertaut ke archived session tetap dapat diedit;
- konten lama tanpa `sessionId` tetap valid dan tampil sebagai `Tanpa pertemuan`;
- route teacher/student `/classes/:classId/sessions`;
- tab Pertemuan pada workspace kelas;
- create/edit/publish/draft/archive/restore/reorder UI;
- quick action membuat Materi/Kuis dengan `?sessionId=`;
- MaterialEditor, QuizEditor, dan form Presensi memiliki pilihan pertemuan;
- layout Pertemuan responsif desktop/mobile;
- regression tests validation, repository, routing, linking, legacy, archived-link, dan stale reorder ditambahkan.

### Status validasi

Perubahan di atas sudah melalui source/diff review, tetapi sesi agent sebelumnya **tidak mengklaim full local validation lulus** karena environment tool tidak berhasil mengambil snapshot/dependency repository untuk menjalankan keseluruhan suite.

Agent lokal harus menjalankan validasi ini sebelum merge atau deployment:

```powershell
npm install
npm.cmd --prefix backend install
npm.cmd --prefix workers install

npm.cmd run validate
npm.cmd run validate:infra
git diff --check
```

Jika dependency sudah terpasang dan lockfile konsisten, jangan melakukan upgrade package hanya untuk menjalankan validation.

Jika ada kegagalan:

1. perbaiki hanya error yang benar-benar berasal dari branch ini;
2. tambah regression test untuk bug yang ditemukan;
3. jangan menghapus test hanya agar pipeline hijau;
4. jangan deploy sebelum `validate`, `validate:infra`, dan `git diff --check` bersih.

### Urutan merge

Jika tiga PR akan dimasukkan ke `main`, urutannya harus:

1. PR #2 - `fix/p0-correctness-security`;
2. PR #3 - `chore/p1-production-hardening`;
3. PR #4 - `feat/learning-sessions`.

Setelah PR sebelumnya merged, update/rebase base branch hanya jika benar-benar diperlukan oleh GitHub dan lakukan dengan hati-hati agar diff stacked PR tetap bersih.

### Pekerjaan berikutnya

Prioritas fitur berikutnya adalah:

```text
Tasks
→ Submission
→ Grading
→ Revision
```

Jangan mulai modul tersebut sebelum validation Learning Sessions selesai.

Domain minimum yang sudah disepakati:

```text
Task: id, classId, sessionId?, ownerId, title, instructions, dueAt,
      responseMode, allowedMimeTypes, maxFiles, maxAttempts, rubric?, status

TaskSubmission: id, taskId, studentId, attemptNumber, textAnswer, attachments,
                status, submittedAt, score?, feedback?, gradedAt?

SubmissionRevision: id, submissionId, authorId, message, attachments?, createdAt
```

Constraint penting:

- task boleh tidak memiliki `sessionId` untuk backward/flexible flow;
- membership dan ownership harus diverifikasi backend;
- upload submission harus direct browser → Cloudinary;
- backend signature submission harus mengikat `taskId` dan Firebase identity siswa;
- jangan mempercayai `studentId`, `classId`, atau ownership yang dikirim browser tanpa canonical server check;
- `assessment_feedback` hanya membuat draf feedback/rubrik, bukan auto-grade;
- jangan menambah storage/service berbayar baru tanpa persetujuan pemilik.

## Aturan kerja wajib

1. Mulai dari `main` terbaru, baca diff sejak `5ac567f`, lalu audit file yang akan diubah.
2. Jangan menambah layanan berbayar tanpa persetujuan pemilik.
3. Upload biner tetap browser ke Cloudinary menggunakan signature backend. Jangan memasukkan file ke Lambda atau membuat bucket S3 aplikasi.
4. Jangan menyimpan API key, Firebase credential, atau Cloudinary secret pada frontend, commit, log, atau pesan error pengguna.
5. Tambahkan test backend yang relevan dan jalankan lint, backend test, Worker test, frontend build, serta `git diff --check` sebelum commit.
6. Jangan mengklaim deployment atau uji browser nyata jika hanya ada bukti build/test lokal.
7. Jangan deploy atau mengubah Dashboard secret tanpa instruksi eksplisit. Saat deploy Worker yang memakai variable Dashboard, gunakan `--keep-vars`.

## Status yang sudah ada di kode

### Identitas dan profil

- Satu kartu autentikasi dengan pilihan masuk guru atau siswa.
- Google dan email/password didukung; akun baru menjalani onboarding profil wajib.
- Profil dapat diedit dari menu pengguna, sementara peran tidak dapat diubah dari halaman profil.
- Route guard memisahkan ruang guru dan siswa.

### LMS inti kelas

- Kelas, membership, materi blok, diskusi materi, presensi lokasi, progress, dan bookmark siswa tersedia.
- Learning Sessions / Pertemuan Pembelajaran tersedia sebagai pengelompokan per tanggal dengan status draft/published/archived dan urutan eksplisit.
- Guru dapat membuat, mengubah, menerbitkan, mengarsipkan, memulihkan, dan mengurutkan pertemuan. Siswa hanya menerima pertemuan published.
- Materi, kuis kelas, dan presensi memiliki `sessionId` opsional yang divalidasi server-side terhadap kelas dan pertemuan aktif. Konten lama tanpa `sessionId` tetap tampil sebagai `Tanpa pertemuan`; tidak ada migrasi massal DynamoDB.
- Materi mendukung teks, image, file, link, serta validasi dan embed YouTube.
- Browser mengunggah image/dokumen langsung ke Cloudinary melalui signature yang memeriksa Firebase identity dan ownership kelas.

### Kuis

- Kuis kelas dengan self-paced scoring server.
- Kuis live kelas dengan kode enam karakter, QR, peserta tanpa login, token peserta, polling ringkas, SQS answer buffering, scoring server, dan leaderboard.
- Tipe soal: pilihan ganda, benar/salah, jawaban singkat, susun urutan, serta klik area gambar dengan area benar dan toleransi server-side.
- Gambar dapat diunggah untuk soal biasa maupun hotspot; rasio gambar asli dipertahankan.
- Kuis umum ada di `/teacher/general-quizzes`: CRUD, upload image, publish ke Bank Kuis, dan live session tanpa relasi kelas.
- Bank Kuis memakai catalog snapshot + copy. Kuis sumber tidak dapat diedit guru lain; salinan tujuan menjadi draf kelas tujuan.
- Filter Bank Kuis memakai pemilih visual, bukan native select browser.

### AI

- Worker memiliki `material_draft`, `quiz_draft`, dan `assessment_feedback`.
- `qwen/qwen3.8-27b` dipakai untuk drafting dan `openai/gpt-oss-120b` untuk feedback penilaian.
- Request dibatasi: konteks maksimal 6.000 karakter dan instruksi maksimal 700 karakter untuk menjaga TPM.
- Editor materi dan editor kuis menggunakan draft AI yang tetap perlu ditinjau guru.

## Kekurangan yang masih harus dikerjakan

### Learning Sessions - tersedia di kode

Kontrak yang sudah tersedia:

- entity `LEARNING_SESSION` disimpan di partition kelas dengan `SESSION#<id>`;
- field utama: `id`, `classId`, `ownerId`, `title`, `description`, `meetingDate`, `status`, `sortOrder`, timestamp publikasi/arsip;
- endpoint kelas mendukung list, create, get, update, dan reorder;
- maksimum 100 pertemuan per kelas agar seluruh urutan tetap dapat diperbarui dalam satu transaksi DynamoDB;
- siswa hanya melihat status `published`;
- pertemuan `archived` tidak dapat menerima assignment konten baru;
- materi, kuis kelas, dan presensi dapat ditautkan secara opsional; data lama tetap valid tanpa perubahan;
- halaman `/teacher/classes/:classId/sessions` dan `/student/classes/:classId/sessions` menjadi alur pertemuan terpadu;
- editor materi/kuis dan form presensi memiliki pemilih pertemuan;
- UI responsif menampilkan resource per pertemuan serta blok `Tanpa pertemuan`.

Masih perlu E2E browser nyata dan deployment backend/frontend sebelum menyatakan fitur aktif di production.

### Prioritas 1 - Tugas, pengumpulan, penilaian, dan revisi

Modul ini belum ada. Bangun setelah model Learning Sessions stabil.

Minimum domain:

```text
Task: id, classId, sessionId?, ownerId, title, instructions, dueAt,
      responseMode, allowedMimeTypes, maxFiles, maxAttempts, rubric?, status
TaskSubmission: id, taskId, studentId, attemptNumber, textAnswer, attachments,
                status, submittedAt, score?, feedback?, gradedAt?
SubmissionRevision: id, submissionId, authorId, message, attachments?, createdAt
```

Kriteria minimum:

- guru membuat tugas jawaban teks, lampiran gambar/PDF/dokumen, atau gabungan;
- siswa menyimpan draf, mengirim, dan mengirim ulang sesuai kebijakan tugas;
- signature upload baru harus mengikat `taskId` dan Firebase identity siswa, bukan mempercayai ID browser;
- guru melihat daftar submission, memberi nilai/feedback, mengembalikan untuk revisi, dan melihat riwayat;
- `assessment_feedback` AI hanya memberi draf feedback/rubrik, bukan nilai otomatis;
- setiap akses diperiksa server-side dari membership kelas.

### Prioritas 2 - Materi dokumen dan pengalaman belajar

- PPT/PPTX belum dikonversi ke PDF/thumbnail atau dipreview.
- Cache client-side materi/video belum dirancang.
- Preview progresif dokumen Office belum ada.

Jangan menjalankan LibreOffice di Cloudflare Worker. Rancang converter asynchronous terisolasi hanya setelah pemilik menyetujui provider, biaya, batas ukuran, retensi, dan delete policy. Sebelum itu tampilkan link unduh yang jujur.

Untuk cache gunakan metadata/ETag serta Cache Storage atau IndexedDB yang dibatasi ukuran dan dapat dibersihkan pengguna. Jangan menyimpan token, submission sensitif, atau file pribadi tanpa kebijakan retensi.

### Prioritas 3 - AI dan kualitas konteks

- AI belum ada pada alur tugas karena modul tugas belum ada.
- Konteks materi masih perlu memanfaatkan judul kelas dan ringkasan materi aktif dengan batas token ketat.
- Belum ada telemetry penggunaan atau guardrail per guru/kelas selain rate limit Worker.
- 401 AI produksi harus diuji dari akun Firebase nyata setelah `VITE_AI_URL` dan origin deployment dikonfirmasi.

Gunakan konteks terpilih dan dipangkas, bukan seluruh isi kelas. Semua output AI harus tetap draf yang dapat diedit guru.

### Prioritas 4 - Bank Kuis dan kuis umum lanjutan

- Pencarian teks, sorting, rating, laporan penggunaan, dan moderation queue belum ada.
- Kuis umum belum memiliki self-paced public link; yang tersedia adalah live session publik melalui host dan kode join.
- Export kuis umum belum ada; export class quiz ada di backend tetapi UI impor JSON sengaja disembunyikan dari guru biasa.

Jangan mengubah model Bank Kuis dari snapshot + copy ke collaborative edit tanpa desain permission/versioning baru. Untuk pencarian awal, hindari DynamoDB scan; gunakan index khusus atau filter terbatas dengan batas yang jelas.

### Prioritas 5 - Production hardening dan bukti operasional

Kode lokal belum sama dengan production. Hardening kode yang sudah tersedia:

- pembacaan peserta live mengikuti pagination DynamoDB sehingga leaderboard tidak berhenti di page pertama 100 peserta;
- kapasitas read/write DynamoDB dan maximum concurrency processor SQS dapat ditentukan lewat parameter SAM tanpa mengubah default development;
- log group processor jawaban live dibatasi retensi 7 hari;
- queue utama dan DLQ diekspos sebagai CloudFormation output untuk inspeksi operasional;
- root validation mencakup Worker tests, dan backend syntax check mencakup seluruh modul backend yang aktif.

Default tetap free-first/development: DynamoDB 1 RCU/1 WCU dan processor concurrency 5. Jangan menaikkan nilai deployment tanpa target peserta dan load test. Template belum membuat CloudWatch alarm berbayar secara otomatis.

Sebelum menyatakan beta siap:

1. Deploy backend SAM terbaru agar endpoint `/general-quizzes`, live kuis umum, dan signature upload kuis umum aktif.
2. Deploy frontend Pages terbaru dengan `VITE_API_URL` dan `VITE_AI_URL` yang benar.
3. Pastikan AI Worker memiliki `FIREBASE_PROJECT_ID` dan `GROQ_API_KEY`, CORS hanya menerima origin resmi, serta deployment memakai `--keep-vars`.
4. Jalankan E2E browser nyata: onboarding, Cloudinary upload, YouTube, self-paced quiz, hotspot touch, arrange touch, Bank Kuis, live QR/kode, dan AI.
5. Tentukan target peserta live, jalankan load test, lalu set parameter kapasitas DynamoDB dan concurrency processor dari hasil pengujian.
6. Setelah pemilik menyetujui biaya observability, tambahkan alarm queue age/depth dan DLQ.
7. Dokumentasikan limit peserta dan fallback ketika queue, AI, atau Cloudinary gagal.

## Endpoint dan file penting

| Area | Lokasi utama |
| --- | --- |
| Router Lambda | `backend/src/functions/classes/index.js` |
| Learning Sessions | `backend/src/repositories/learning-session-repository.js` / `src/pages/ClassSessions.jsx` |
| Kuis kelas | `backend/src/repositories/quiz-repository.js` |
| Kuis umum | `backend/src/repositories/general-quiz-repository.js` |
| Live session | `backend/src/repositories/live-quiz-repository.js` |
| Bank Kuis | `backend/src/repositories/quiz-bank-repository.js` |
| Signature Cloudinary | `backend/src/services/cloudinary-upload-signer.js` |
| Validasi kuis | `backend/src/validation/quiz.js` |
| Halaman kuis umum | `src/pages/teacher/TeacherGeneralQuizzes.jsx` |
| Editor kuis | `src/pages/teacher/QuizEditor.jsx` |
| Bank Kuis UI | `src/pages/teacher/QuizBank.jsx` |
| Worker AI | `workers/src/index.js` |

## Perintah validasi

Jalankan dari root repository Windows/PowerShell:

```powershell
npm.cmd run validate
git diff --check
```

Untuk perubahan backend AWS, jalankan juga:

```powershell
npm.cmd run validate:infra
```

`npm.cmd run validate:all` menjalankan lint, frontend build, backend tests, Worker tests, backend syntax checks, SAM lint, dan SAM build. Untuk Worker deployment, gunakan CLI lokal dan dry-run sebelum deploy; jangan membocorkan secret.

## Catatan workspace lokal

`Daftar Mapel.txt` dan `wrangler.jsonc` dapat ada sebagai file lokal tidak terlacak. Jangan menghapus, mengubah, atau memasukkannya ke commit kecuali pemilik meminta secara eksplisit. Taxonomy aplikasi sudah berada pada `backend/src/domain/quiz-taxonomy.js`.
