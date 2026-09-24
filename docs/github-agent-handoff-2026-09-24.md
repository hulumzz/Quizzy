# Handoff Pengembangan Quizzy - 24 September 2026

Dokumen ini adalah titik mulai untuk agent GitHub yang meneruskan Quizzy setelah commit `5ac567f` pada branch `main`. Baca juga `blueprint (1).md`, `implementation-plan.md`, dan `docs/phase-10-and-learning-roadmap.md`. Instruksi pemilik yang lebih baru tetap mengalahkan dokumen ini.

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

### Prioritas 1 - Learning Sessions

Belum ada pengelompokan pertemuan dalam satu kelas. Implementasikan entity `LearningSession` sebagai wadah materi, tugas, kuis, dan referensi presensi per tanggal/pertemuan.

Kriteria minimum:

- guru membuat, mengubah, mengarsipkan, dan mengurutkan pertemuan;
- siswa hanya melihat pertemuan yang diterbitkan;
- materi dan tugas dapat dihubungkan ke pertemuan tanpa memutus data lama;
- `sessionId` pada entity lama bersifat opsional; konten lama tetap tampil aman sebagai `Tanpa pertemuan` atau arsip;
- UI kelas menampilkan alur pertemuan yang jelas di desktop dan mobile.

Jangan menjalankan migrasi massal DynamoDB hanya untuk feature ini.

### Prioritas 2 - Tugas, pengumpulan, penilaian, dan revisi

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

### Prioritas 3 - Materi dokumen dan pengalaman belajar

- PPT/PPTX belum dikonversi ke PDF/thumbnail atau dipreview.
- Cache client-side materi/video belum dirancang.
- Preview progresif dokumen Office belum ada.

Jangan menjalankan LibreOffice di Cloudflare Worker. Rancang converter asynchronous terisolasi hanya setelah pemilik menyetujui provider, biaya, batas ukuran, retensi, dan delete policy. Sebelum itu tampilkan link unduh yang jujur.

Untuk cache gunakan metadata/ETag serta Cache Storage atau IndexedDB yang dibatasi ukuran dan dapat dibersihkan pengguna. Jangan menyimpan token, submission sensitif, atau file pribadi tanpa kebijakan retensi.

### Prioritas 4 - AI dan kualitas konteks

- AI belum ada pada alur tugas karena modul tugas belum ada.
- Konteks materi masih perlu memanfaatkan judul kelas dan ringkasan materi aktif dengan batas token ketat.
- Belum ada telemetry penggunaan atau guardrail per guru/kelas selain rate limit Worker.
- 401 AI produksi harus diuji dari akun Firebase nyata setelah `VITE_AI_URL` dan origin deployment dikonfirmasi.

Gunakan konteks terpilih dan dipangkas, bukan seluruh isi kelas. Semua output AI harus tetap draf yang dapat diedit guru.

### Prioritas 5 - Bank Kuis dan kuis umum lanjutan

- Pencarian teks, sorting, rating, laporan penggunaan, dan moderation queue belum ada.
- Kuis umum belum memiliki self-paced public link; yang tersedia adalah live session publik melalui host dan kode join.
- Export kuis umum belum ada; export class quiz ada di backend tetapi UI impor JSON sengaja disembunyikan dari guru biasa.

Jangan mengubah model Bank Kuis dari snapshot + copy ke collaborative edit tanpa desain permission/versioning baru. Untuk pencarian awal, hindari DynamoDB scan; gunakan index khusus atau filter terbatas dengan batas yang jelas.

### Prioritas 6 - Production hardening dan bukti operasional

Kode lokal belum sama dengan production. Sebelum menyatakan beta siap:

1. Deploy backend SAM terbaru agar endpoint `/general-quizzes`, live kuis umum, dan signature upload kuis umum aktif.
2. Deploy frontend Pages terbaru dengan `VITE_API_URL` dan `VITE_AI_URL` yang benar.
3. Pastikan AI Worker memiliki `FIREBASE_PROJECT_ID` dan `GROQ_API_KEY`, CORS hanya menerima origin resmi, serta deployment memakai `--keep-vars`.
4. Jalankan E2E browser nyata: onboarding, Cloudinary upload, YouTube, self-paced quiz, hotspot touch, arrange touch, Bank Kuis, live QR/kode, dan AI.
5. Tetapkan kapasitas DynamoDB/SQS untuk target peserta live, tambahkan alarm queue age/depth dan DLQ, lalu load test.
6. Dokumentasikan limit peserta dan fallback ketika queue, AI, atau Cloudinary gagal.

## Endpoint dan file penting

| Area | Lokasi utama |
| --- | --- |
| Router Lambda | `backend/src/functions/classes/index.js` |
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
npm.cmd run lint
npm.cmd --prefix backend test
npm.cmd --prefix workers test
npm.cmd run build
git diff --check
```

Untuk perubahan backend AWS, tambah validasi SAM sesuai template aktif. Untuk Worker, gunakan CLI lokal dan dry-run sebelum deploy; jangan membocorkan secret.

## Catatan workspace lokal

`Daftar Mapel.txt` dan `wrangler.jsonc` dapat ada sebagai file lokal tidak terlacak. Jangan menghapus, mengubah, atau memasukkannya ke commit kecuali pemilik meminta secara eksplisit. Taxonomy aplikasi sudah berada pada `backend/src/domain/quiz-taxonomy.js`.
