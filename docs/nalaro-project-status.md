# Status dan riwayat pengerjaan Nalaro Class

Terakhir diperiksa: 1 Oktober 2026. Dokumen ini adalah catatan kerja yang harus diperbarui setelah setiap tugas selesai. Status mengacu pada kode di repository `hulumzz/Quizzy` dan bukti pengujian yang disebutkan; keberadaan kode tidak otomatis berarti fitur sudah lolos uji produksi.

## Aturan pembaruan oleh AI

1. Baca **Posisi saat ini** dan **Pekerjaan tersisa** sebelum mengubah kode.
2. Setelah tugas selesai, perbarui status fitur, lingkungan, dan daftar pekerjaan yang terdampak. Tambahkan entri bertanggal di **Riwayat perubahan**: apa yang berubah, berkas penting, validasi yang benar-benar dijalankan, serta status commit, push, dan deploy.
3. Bedakan `ada di kode`, `lulus tes lokal`, `teruji pada API produksi`, dan `teruji di browser/perangkat`. Jangan menaikkan status hanya karena build atau tes unit lulus.
4. Catat keputusan produk dan temuan baru. Jangan tulis nilai secret, token, atau data pengguna. Jika dokumen lama berbeda, periksa kode dan lingkungan terbaru; dokumen lama tetap berguna sebagai riwayat.

## Tujuan dan keputusan produk

- Nalaro Class adalah LMS guru dan siswa untuk kelas, materi, diskusi, presensi, pertemuan, tugas, kuis mandiri, Bank Kuis, dan Nalaro Live.
- Target arsitektur: React/Vite di Cloudflare Pages; API LMS dan gateway AI di Worker; data LMS di D1; sesi live aktif di Durable Object SQLite; Firebase Authentication tetap; Cloudinary untuk media.
- Profil wajah MVP tetap di Firestore dengan aturan akses pemilik. Kamera, embedding, dan pencocokan 1:1 berlangsung di browser; API presensi masih memeriksa auth, keanggotaan, sesi, duplikasi, dan lokasi.
- Pengguna mengizinkan data LMS lama di DynamoDB ditinggalkan. D1 yang kosong setelah cutover bukan bukti kegagalan migrasi.
- Push pekerjaan ini ditujukan ke `hulumzz/Quizzy` branch `main`. Proyek Pages `nalaroclass` terhubung ke repository GitHub lain yang akan disesuaikan pengguna. Push ke repository ini **tidak otomatis memperbarui Pages tersebut**.

## Posisi saat ini

**Tahap: API inti sudah diimplementasikan pada Worker/D1; verifikasi cutover browser dan sejumlah fitur lanjutan belum selesai.** Jangan menyebut seluruh migrasi dan fitur `100%`.

- Worker `nalaro-api` melayani route LMS, upload signature, AI, Learning Insights, dan Nalaro Live. Pada branch integrasi `feat/live-security-realtime`, role teacher/student diverifikasi server dari profil Firestore immutable lalu dicache 24 jam di D1; Live memakai WebSocket Durable Object dan hasil akhirnya dipersistenkan ke D1. Produksi remote masih pada migrasi `0001`–`0008`; `0009`–`0011` belum diterapkan remote.
- Pages `https://nalaroclass.pages.dev` dan Worker `https://nalaro-api.uniquefactuhl.workers.dev` tersedia. Pada 30 September 2026, halaman depan memberi HTTP 200 dan preflight dari origin Pages ke `/classes?scope=joined` memberi HTTP 204 dengan header CORS yang benar. Ini belum membuktikan alur login atau tampilan kelas.
- Uji API terautentikasi sebelumnya lulus untuk kelas, kuis/hasil, tugas/penilaian, Bank Kuis, kuis umum, signature unggahan, beberapa fase Nalaro Live, dan AI. Akun serta data uji dibersihkan; D1 kemudian memiliki 0 kelas. Rincian ada di [status migrasi Cloudflare](cloudflare-backend-migration-status.md).
- Frontend lokal dan `.env.example` menunjuk Worker lewat `VITE_API_URL`/`VITE_AI_URL`. Variabel build Pages dan kesamaan source dengan repository GitHub lain yang terhubung ke Pages belum diverifikasi dari browser produksi.
- Kode AWS Lambda, DynamoDB, SQS, dan SAM masih ada di `backend/`. Infrastruktur lama belum dinonaktifkan.

## Riwayat pengerjaan

| Periode | Hasil yang dapat ditelusuri |
| --- | --- |
| 23–24 Sep 2026 | Fondasi React/Firebase, alur guru/siswa, kelas, materi, diskusi, presensi, kuis, AI, Cloudinary, serta handoff pengembangan. Backend awal memakai AWS; lihat histori Git dan [handoff 24 Sep](github-agent-handoff-2026-09-24.md). |
| 25–26 Sep 2026 | Pertemuan pembelajaran, tugas/pengumpulan/penilaian/revisi, kuis umum dan Bank Kuis, editor dan AI Assist, onboarding, dialog, loader, dan kompatibilitas model AI. Commit terakhir sebelum migrasi lokal adalah `856f447` (26 Sep). |
| 29 Sep 2026 | Runtime kuis satu soal per langkah, hasil guru, Nalaro Live, dan presensi wajah MVP. Lihat [batasan presensi wajah](face-attendance-mvp.md). |
| 29–30 Sep 2026 | Worker diperluas dari AI menjadi API LMS modular; D1 `0001`–`0008` dan Durable Object live dibuat. Service frontend diarahkan ke Worker, route inti diuji, Worker dideploy, dan origin Pages baru ditambahkan ke CORS. Proyek Pages `nalaroclass` dibuat pengguna. |
| 30 Sep 2026 | Audit ulang memastikan route inti ada, CORS baru merespons benar, dan gap fitur/validasi di bawah masih terbuka. Dokumen status hidup ini dibuat. |

## Inventaris fitur

`Ada di kode` berarti implementasi terlihat di source, bukan semua alurnya telah diuji di Pages.

| Area | Status saat ini | Acuan utama |
| --- | --- | --- |
| Login, profil, peran guru/siswa | Firebase Auth dipertahankan. Branch integrasi menambah enforcement server-side: role dibaca dari profil Firestore milik UID yang sama, dicache terbatas di D1, dan mutation route sensitif memeriksa teacher/student | `workers/src/services/account-role.js`, `workers/src/middleware/auth.js`, `firestore.rules` |
| Kelas dan anggota | Buat, gabung, daftar, detail, dan daftar anggota ada; pengaturan anggota lanjutan belum ada | `workers/src/routes/classes.js`, `src/app/routes.jsx` |
| Materi, progres, bookmark, diskusi | Ada di frontend dan Worker; upload memakai signature Cloudinary | `workers/src/routes/materials.js`, `workers/src/routes/discussions.js` |
| Pertemuan pembelajaran | Ada, termasuk pengaitan materi/kuis/presensi/tugas | `workers/src/routes/learning-sessions.js` |
| Presensi lokasi dan wajah MVP | Presensi server ada; wajah opsional memakai Firestore/browser dan perlu uji perangkat nyata | `workers/src/routes/attendance.js`, `src/services/face.service.js` |
| Kuis kelas dan kuis umum | Editor, publikasi, percobaan, penilaian, hasil, impor/ekspor ada | `workers/src/routes/quizzes.js`, `workers/src/routes/general-quizzes.js` |
| Tugas | Pengumpulan, lampiran, nilai, feedback, revisi, dan riwayat revisi ada | `workers/src/routes/tasks.js` |
| Bank Kuis | Publikasi katalog, salin sebagai draf, penarikan, impor/ekspor ada; moderasi/rating/analytics belum ada | `workers/src/routes/quiz-bank.js` |
| Nalaro Live | Branch integrasi mengganti polling state utama dengan WebSocket Durable Object + reconnect, mempertahankan scoring REST/server-side, mempersistenkan hasil final ke D1, menyediakan laporan/CSV kelas dan kuis umum, serta retry persist | `workers/src/durable/LiveQuizRoom.js`, `workers/src/repositories/live-result.repository.js`, `src/pages/LiveQuizHost.jsx`, `src/pages/LiveQuizPlayer.jsx` |
| AI Assist | Gateway dan draf materi/kuis yang ditinjau guru ada; feedback penilaian di layanan AI belum terhubung sebagai alur UI tugas | `workers/src/routes/ai.js`, `workers/src/services/ai.js`, `src/components/AiAssistModal.jsx` |
| Learning Insights | Ada di branch `feat/learning-insights` dan diperluas di branch integrasi: analitik explainable dari kuis mandiri, Nalaro Live siswa terautentikasi, tugas/revisi, presensi, materi, dan diskusi; Learning Session menjadi unit topik. Belum dideploy/diuji browser produksi | `workers/src/repositories/learning-analytics.repository.js`, `src/pages/ClassAnalytics.jsx`, `docs/learning-insights.md` |

## Pekerjaan tersisa

### Gate cutover dan beta

- [ ] Pastikan repository yang terhubung ke Pages menerima source yang sama dan variabel build Pages menunjuk Worker yang benar; uji dari `nalaroclass.pages.dev` dengan akun guru dan siswa.
- [ ] Uji browser end to end: login, kelas, materi/diskusi, pertemuan, presensi, kuis, tugas, Bank Kuis, dan AI. Uji transfer **file nyata** ke Cloudinary serta izin lokasi dan kamera pada perangkat yang relevan.
- [ ] Uji Nalaro Live pada beberapa perangkat, koneksi putus/sambung, kapasitas peserta target, dan perilaku gagal/pulih. Catat batas peserta berdasarkan pengukuran.
- [ ] Setelah cutover terbukti, putuskan waktu dan prosedur menonaktifkan AWS lama. Kode/infrastruktur AWS belum dibersihkan.
- [ ] Perbarui URL kanonis, metadata berbagi, dan `public/sitemap.xml` yang masih menunjuk `quizzy-f01.pages.dev` setelah domain final diputuskan.

### Fitur dan pengembangan lanjutan

- [ ] Hubungkan agenda/jadwal nyata; widget dashboard masih menyatakan “Agenda belum tersedia”.
- [ ] Tambahkan pengaturan anggota kelas lanjutan bila diperlukan, misalnya mengeluarkan anggota atau mengubah hak akses; route sekarang baru menyediakan daftar anggota.
- [ ] Pengembangan setelah beta: laporan progres guru, notifikasi/jadwal, rubrik tugas, moderasi/pencarian/rating Bank Kuis, dan preview PPT/PPTX hasil konversi. Ini roadmap, bukan syarat untuk menyatakan API inti sudah bermigrasi.

## Bukti validasi dan batasnya

- [Status migrasi Cloudflare](cloudflare-backend-migration-status.md) mencatat `npm.cmd run validate`, 23 tes Worker, dry run Worker, smoke test, serta uji API produksi terautentikasi pada pengerjaan sebelumnya. Bila tes diulang, tulis tanggal dan hasil aktual pada riwayat di bawah.
- `.github/workflows/validate.yml` menjalankan lint, build, serta tes pada push/PR `main`; workflow itu tidak deploy Worker atau AWS. Pages yang terhubung ke GitHub lain memiliki jalur deploy tersendiri.
- HTTP/CORS dan tes otomatis tidak menggantikan uji UI browser, transfer Cloudinary nyata, perangkat kamera/lokasi, atau uji beban live.

## Riwayat perubahan

Tambahkan entri terbaru di paling atas setelah setiap tugas. Sertakan perubahan, berkas penting, tes yang benar-benar dijalankan, status commit/push/deploy, dan hal yang masih terbuka.

### 1 Okt 2026 — Role enforcement + WebSocket Live + hasil Live permanen

- PR #7 / branch integrasi `feat/live-security-realtime` dibangun di atas `feat/learning-insights` (stacked PR #6). Perubahan Live yang relevan dari PR #5 juga dibawa agar UX/realtime tidak meregresikan hardening kuis sebelumnya.
- Role teacher/student kini diperiksa Worker dari profil Firestore milik Firebase UID yang sama. D1 hanya mempercayai role setelah verifikasi dan cache direvalidasi maksimal 24 jam. Route create/manage kelas, materi, kuis, tugas, presensi, Bank Kuis, AI Assist, Learning Insights, dan host Live diberi boundary teacher/student yang eksplisit.
- Nalaro Live memakai WebSocket Durable Object Hibernation untuk delivery state realtime. Host memakai tiket socket satu kali; peserta dapat mengautentikasi socket dengan participant token. REST tetap dipakai untuk mutation/answer sehingga scoring tetap server-authoritative.
- Hasil sesi Live final disimpan idempotent ke D1 melalui migration `0011_live_quiz_results.sql`: metadata sesi, ranking peserta, dan ringkasan benar/poin per soal. Raw answer tidak disalin ke D1 report. Host dapat retry jika persist gagal; alarm DO mencoba menyimpan lagi sebelum room kedaluwarsa.
- Guru dapat membuka riwayat Live permanen, detail akurasi/ranking, dan ekspor CSV dari Kuis kelas; kuis umum juga mendapat riwayat/detail/CSV.
- Join Live tetap publik. Jika request membawa Firebase token siswa yang verified dan siswa memang anggota kelas, result dipetakan ke `student_id`; peserta publik tidak pernah ditebak identitasnya dari nama.
- Learning Insights sekarang memakai Live terautentikasi sebagai strong evidence dengan bobot mastery 0,90. Hasil Live publik tetap hanya laporan dan tidak masuk profil analitik siswa.
- Test source ditambah/diupdate untuk trusted role cache, Live persistence/report, privacy payload hotspot/arrange, participant reconnect, participant ID contract, dan integrasi Live → Learning Insights. Smoke script produksi juga diperbarui untuk membuat/menghapus profil role Firestore uji.
- **Belum dideploy**: migration `0009`, `0010`, `0011`, Worker terbaru, dan frontend terbaru belum diterapkan ke remote. GitHub Actions PR #7 run #10 kembali selesai `failure` sebelum satu pun step dijalankan (`steps=null`); jangan menyebut branch ini lulus CI/production sebelum validasi nyata dilakukan.

### 1 Okt 2026 — Nalaro Learning Insights

- Branch `feat/learning-insights` menambahkan engine analitik kelas/siswa yang membaca data authoritative D1 tanpa cache analitik terpisah.
- Mastery hanya memakai hasil kuis dan tugas bernilai; presensi, progres materi, diskusi, task completion, dan ketepatan waktu membentuk konsistensi/keterlibatan tetapi tidak menaikkan mastery.
- Learning Session menjadi unit analitik per topik. Editor materi, kuis, tugas, dan presensi diberi guidance agar aktivitas dipetakan ke pertemuan.
- Ditambahkan fairness siswa baru, analisis respons revisi, confidence/keyakinan data, status perkembangan non-ranking, insight deterministik, dashboard guru, analitik pribadi siswa, dan detail evidence.
- Migration `0009_learning_analytics_indexes.sql` menambah index baca saja; tidak membuat source of truth baru.
- Test source untuk formula, akses, siswa baru, data engagement-only, tugas belum dinilai, dan revisi sudah ditambahkan, tetapi **belum diklaim lulus** pada sesi ini karena workflow GitHub sebelumnya gagal sebelum runner menjalankan step. Deploy Worker/D1/Pages belum dilakukan.

### 30 Sep 2026 — Dokumen status hidup

- Menyatukan riwayat, fitur, target migrasi, keputusan meninggalkan data DynamoDB, dan gate beta berdasarkan source saat ini.
- Pemeriksaan sesi ini: audit source/route, histori Git, konfigurasi, dan HTTP Pages/CORS. `npm.cmd run validate` lulus: lint, build, tes frontend, 126 tes backend, 23 tes Worker, dan syntax check backend/Worker.
- Source migrasi dan dokumen status masuk commit `4d24d96` dan berhasil di-push ke `main` pada `hulumzz/Quizzy`. Push ini tidak men-deploy ulang Worker atau Pages.
- Deploy aplikasi baru tidak dilakukan dalam tugas dokumentasi ini; repository Pages yang berbeda perlu disinkronkan terpisah.

## Dokumen terkait

- [Status migrasi Cloudflare](cloudflare-backend-migration-status.md): bukti deployment dan smoke test terakhir.
- [Batasan presensi wajah](face-attendance-mvp.md): desain dan risiko MVP.
- [Metodologi Learning Insights](learning-insights.md): sumber evidence, formula, fairness, confidence, dan batas implementasi.
- [Handoff AI agent 1 Okt 2026](ai-agent-handoff-2026-10-01.md): arsitektur terbaru, branch stack, role enforcement, realtime Live, persistence, migrasi, merge/deploy order, dan gate validasi.
- [Arsitektur terdahulu](architecture-status.md), [roadmap fase 10+](phase-10-and-learning-roadmap.md), dan [handoff awal](github-agent-handoff-2026-09-24.md): riwayat/baseline yang sebagian masih menjelaskan arsitektur AWS lama.
