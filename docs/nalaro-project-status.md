# Status dan riwayat pengerjaan Nalaro Class

Terakhir diperiksa: 2 Oktober 2026. Dokumen ini adalah catatan kerja yang harus diperbarui setelah setiap tugas selesai. Status mengacu pada kode di repository `hulumzz/Quizzy` dan bukti pengujian yang disebutkan; keberadaan kode tidak otomatis berarti fitur sudah lolos uji produksi.

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
- Remote `url` menunjuk `hulumzz/Quizzy` dan remote `pages` menunjuk `khoirulzz/nalaroclass`. Pengguna mengizinkan sinkronisasi keduanya; push `pages/main` terbukti memicu deployment Pages produksi.

## Posisi saat ini

**Tahap: RELEASE CANDIDATE yang sudah live dan teruji API/browser produksi.** Gate akhir yang belum terpenuhi adalah uji Live pada perangkat fisik berbeda; kamera/GPS presensi opsional juga belum diuji. Rincian dan rollback ada di [laporan release Oktober](production-release-2026-10.md).

- PR #5/#6/#7 sudah diintegrasikan ke main. Source runtime final `1fa2f20` sudah di-push ke remote `url` dan `pages`; Pages membangun repo `khoirulzz/nalaroclass` branch main. Sepuluh variabel build API/AI/Firebase produksi dibandingkan dengan lokal dan cocok tanpa mencetak nilainya.
- Worker `nalaro-api` versi `247b0f1c-4018-428c-bf5b-ba3f294c67a6` terdeploy dengan keep-vars. D1 remote sudah sampai `0012`, tidak ada pending migration, FK check bersih, backup sebelum migrasi disimpan lokal/ignored.
- Pages https://nalaroclass.pages.dev sudah menayangkan aplikasi final pada deployment `c7128f7a-2d31-4205-a263-bdd3c6bcf4c4`. Commit dokumentasi/alat smoke berikutnya tidak mengubah bundle aplikasi; status deployment terbaru diperiksa setelah push akhir.
- API produksi lulus untuk LMS, role negatif, AI, Live socket 1 host + 4 pemain, rejoin/token rotation, receipt recovery, hasil D1/CSV, dan Learning Insights. Browser Chrome desktop/mobile viewport lulus untuk login, kelas, materi/diskusi, kuis, unggahan file nyata/tugas/nilai, presensi online, Bank Kuis, Insights, dan Live/reconnect/deadline/final result.
- Snapshot Live pending tidak masuk mastery/laporan, identitas publik tidak dicocokkan berdasarkan nama, dan anchor role D1 mencegah pergantian role lewat profil yang dibuat ulang.
- Kamera/GPS/ponsel fisik, browser Safari, serta load test di atas 4 pemain belum terukur. AWS legacy tetap ada; frontend produksi memakai Worker dan tidak ada AWS yang dihapus.

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
| Login, profil, peran guru/siswa | Firebase Auth + role Firestore/D1. Anchor role, race guard, negative API smoke dan login guru/siswa browser produksi lulus | `workers/src/services/account-role.js`, `workers/src/middleware/auth.js`, `firestore.rules` |
| Kelas dan anggota | Buat, gabung, daftar, detail, dan daftar anggota ada; pengaturan anggota lanjutan belum ada | `workers/src/routes/classes.js`, `src/app/routes.jsx` |
| Materi, progres, bookmark, diskusi | Ada di frontend dan Worker; upload memakai signature Cloudinary | `workers/src/routes/materials.js`, `workers/src/routes/discussions.js` |
| Pertemuan pembelajaran | Ada, termasuk pengaitan materi/kuis/presensi/tugas | `workers/src/routes/learning-sessions.js` |
| Presensi lokasi dan wajah MVP | Presensi server ada; wajah opsional memakai Firestore/browser dan perlu uji perangkat nyata | `workers/src/routes/attendance.js`, `src/services/face.service.js` |
| Kuis kelas dan kuis umum | Editor, publikasi, percobaan, penilaian, hasil, impor/ekspor ada | `workers/src/routes/quizzes.js`, `workers/src/routes/general-quizzes.js` |
| Tugas | Pengumpulan, lampiran, nilai, feedback, revisi, dan riwayat revisi ada | `workers/src/routes/tasks.js` |
| Bank Kuis | Publikasi katalog, salin sebagai draf, penarikan, impor/ekspor ada; moderasi/rating/analytics belum ada | `workers/src/routes/quiz-bank.js` |
| Nalaro Live | Terdeploy dan teruji produksi dengan socket 1 host + 4 pemain, receipt/reconnect, alarm deadline, hasil complete D1/CSV/Insights. Browser context dan viewport diuji; perangkat fisik dan kapasitas lebih besar belum | `workers/src/durable/LiveQuizRoom.js`, `workers/src/repositories/live-result.repository.js`, `src/pages/LiveQuizHost.jsx`, `src/pages/LiveQuizPlayer.jsx` |
| AI Assist | Gateway dan draf materi/kuis yang ditinjau guru ada; feedback penilaian di layanan AI belum terhubung sebagai alur UI tugas | `workers/src/routes/ai.js`, `workers/src/services/ai.js`, `src/components/AiAssistModal.jsx` |
| Learning Insights | Terdeploy dan teruji API/browser guru-siswa. Evidence kuis/graded task/Live terautentikasi, fairness, privacy, complete snapshot, dan layout desktop/mobile diperiksa | `workers/src/repositories/learning-analytics.repository.js`, `src/pages/ClassAnalytics.jsx`, `docs/learning-insights.md` |

## Pekerjaan tersisa

### Gate cutover dan beta

- [x] Kedua repository disinkronkan; source/variabel build Pages cocok dengan Worker; deployment Pages sukses.
- [x] Browser produksi guru/siswa, kelas, materi/diskusi, kuis, tugas/nilai, presensi online, Bank Kuis, Insights, Live diuji. Transfer TXT nyata ke Cloudinary dan cleanup aset lulus.
- [x] Live 1 host + 4 browser context, reload, offline/socket reconnect, deadline tanpa host, hasil D1/CSV dan identitas/evidence API diperiksa.
- [x] Canonical, metadata berbagi, sitemap, dan header Pages menggunakan alamat produksi.
- [ ] Ulangi Live 1 host + 3-5 pemain pada perangkat fisik berbeda/jaringan nyata sebelum menyatakan release final READY. Viewport ponsel tidak menggantikan perangkat fisik.
- [ ] Uji kamera/GPS nyata jika presensi opsional itu digunakan; ukur kapasitas Live sebelum trafik lebih besar.
- [ ] Tentukan jadwal/prosedur penonaktifan AWS terpisah setelah cutover diterima; tidak ada penghapusan AWS pada pekerjaan ini.

### Fitur dan pengembangan lanjutan

- [ ] Hubungkan agenda/jadwal nyata; widget dashboard masih menyatakan “Agenda belum tersedia”.
- [ ] Tambahkan pengaturan anggota kelas lanjutan bila diperlukan, misalnya mengeluarkan anggota atau mengubah hak akses; route sekarang baru menyediakan daftar anggota.
- [ ] Pengembangan setelah beta: laporan progres guru, notifikasi/jadwal, rubrik tugas, moderasi/pencarian/rating Bank Kuis, dan preview PPT/PPTX hasil konversi. Ini roadmap, bukan syarat untuk menyatakan API inti sudah bermigrasi.

## Bukti validasi dan batasnya

- [Status migrasi Cloudflare](cloudflare-backend-migration-status.md) mencatat `npm.cmd run validate`, 23 tes Worker, dry run Worker, smoke test, serta uji API produksi terautentikasi pada pengerjaan sebelumnya. Bila tes diulang, tulis tanggal dan hasil aktual pada riwayat di bawah.
- `.github/workflows/validate.yml` menjalankan lint, build, serta tes pada push/PR `main`; workflow itu tidak deploy Worker atau AWS. Pages yang terhubung ke GitHub lain memiliki jalur deploy tersendiri.
- HTTP/CORS dan tes otomatis tidak menggantikan uji UI browser, transfer Cloudinary nyata, perangkat kamera/lokasi, atau uji beban live.

## Riwayat perubahan

### 2 Okt 2026 - Sinkronisasi repository, deploy, dan smoke produksi

- Remote `pages` menunjuk `https://github.com/khoirulzz/nalaroclass.git`. `main` pada remote `url` dan `pages` sudah menerima integrasi hingga `e5cd06d`; Pages berhasil membangun commit itu pada deployment `1bfa4c7d-9406-48a0-ba33-f21949f5c373`. Seluruh variabel build produksi Firebase/API/AI cocok dengan konfigurasi lokal, dibandingkan di proses tanpa mencetak nilainya.
- Worker versi `247b0f1c-4018-428c-bf5b-ba3f294c67a6` terdeploy dengan `--keep-vars`. API produksi lulus untuk LMS, AI, role negatif, duplicate attempt, Live 1 host + 4 pemain, rejoin siswa yang sama dengan rotasi token, penolakan token lama, laporan D1, CSV, dan Learning Insights.
- `workers/scripts/smoke-browser.mjs` menjalankan Chrome terpasang melalui Playwright sementara setelah Browser in-app tidak tersedia. Login guru/siswa, modul kelas, materi/diskusi, refresh progres/hasil kuis, unggahan TXT nyata ke Cloudinary, pengumpulan/penilaian tugas, presensi online, Bank Kuis, serta Live 1 host + 4 browser context lulus pada Pages produksi. Offline/disconnect, reload jawaban terkunci, deadline saat host keluar, dan hasil final D1 ikut diperiksa. Akun/profil, data D1, dan aset Cloudinary uji dibersihkan; fixture file dari percobaan gagal alat uji juga telah dihapus setelah kontennya diverifikasi.
- Pengujian browser memakai desktop 1440x900 dan viewport ponsel 390x844/360x800. Ini bukan uji ponsel fisik, kamera/GPS nyata, Safari, atau pengukuran kapasitas kelas besar.
- Pemeriksaan screenshot menemukan tata letak kartu Insights belum mengikuti wrapper `Card`; label/angka diperbaiki dan alat uji menambah pemeriksaan posisi. Recovery host kuis umum dipisahkan per akun dan storage yang tidak tersedia tidak mematikan sesi.
- `npm.cmd run validate` kembali lulus (10 frontend, 126 backend, 46 Worker; syntax check 48 source/script), lint tanpa warning, build, serta `git diff --check` lulus. Perbaikan tampilan dan alat uji final akan disinkronkan; pemeriksaan Pages akhir masih berjalan. Laporan release dan daftar gate aktual akan diperbarui pada entri akhir.

### 2 Okt 2026 ? Integrasi release dan hardening sebelum deploy

- PR #5, #6, #7 diintegrasikan berurutan pada `main` lokal dengan merge commit; konflik route/dokumen/Live diselesaikan sambil mempertahankan hardening kuis, Learning Insights, WebSocket, dan laporan permanen. Riwayat lama dipertahankan.
- Role D1 yang sudah verified tidak dapat diganti lewat delete/recreate profil Firestore; verifikasi paralel memakai guard SQL. Draft kuis dan recovery host dipisahkan per akun.
- Live memulihkan receipt pribadi setelah reconnect/reload, memakai heartbeat dan stateVersion untuk mencegah state mundur, menutup soal melalui alarm server, serta menolak advance dari fase lama. Hasil gagal tersimpan tidak dibuang saat TTL room berakhir.
- Migration additive `0012_live_result_completion.sql` mencegah snapshot parsial terbaca sebagai laporan/mastery. Migrasi `0009`?`0012` telah diterapkan ke D1 remote setelah export backup lokal; tidak ada reset atau penghapusan data produksi.
- Soal/kunci kuis dikunci setelah ada attempt; randomisasi arrange tidak memakai rotasi jawaban yang dapat dibalik. CSV dinetralkan terhadap formula spreadsheet. Canonical/sitemap menunjuk `nalaroclass.pages.dev` dan header keamanan Pages ditambahkan.
- `npm.cmd install` root/Worker, `npm.cmd run validate` (10 frontend, 126 backend, 46 Worker), syntax check 47 source/script, `git diff --check`, dan Worker dry run `--keep-vars` lulus. Tes lokal tidak menggantikan browser/perangkat/produksi.
- Remote `pages` ditambahkan untuk `khoirulzz/nalaroclass`; `pages/main` adalah ancestor `main`, sehingga sinkronisasi bisa fast-forward tanpa force push.
- Status pada entri ini: merge commit lokal tersedia; perbaikan release belum di-push, Worker/Pages final dan smoke produksi masih dikerjakan. Bukti akhir akan ditambahkan setelah pemeriksaan lingkungan.


Tambahkan entri terbaru di paling atas setelah setiap tugas. Sertakan perubahan, berkas penting, tes yang benar-benar dijalankan, status commit/push/deploy, dan hal yang masih terbuka.

### 1 Okt 2026 — Quiz hardening dan UX interaktif

- Branch `fix/quiz-hardening-ux` dan PR #5 menutup kebocoran answer-key pada payload siswa untuk hotspot dan susun-urutan, menambahkan status attempt siswa, validasi opsi pilihan ganda unik, serta regression test Worker.
- Self-paced quiz sekarang memiliki autosave per tab, restore setelah refresh, navigasi keyboard, transisi antar-soal, pilihan jawaban interaktif, status progres yang lebih jelas, dan tampilan hasil yang lebih ekspresif.
- Nalaro Live mendapat recovery host setelah refresh, timer/progress visual, auto-reveal ketika deadline habis dari sisi host, mode layar penuh, join flow dua tahap, transisi fase, feedback jawaban terkunci, dan animasi leaderboard/hasil.
- Dokumentasi `face-attendance-mvp.md` ditambahkan untuk menegaskan bahwa tantangan gerak kepala saat ini adalah MVP dan belum merupakan anti-spoof/liveness tingkat tinggi.
- GitHub Actions pada PR dan dua run `main` sebelumnya gagal sebelum runner/step dijalankan (`runner_id=0`, `steps=null`). Karena itu lint/build/test untuk branch ini **belum dapat diklaim lulus dari CI**. Review kontrak source dilakukan, tetapi browser/perangkat nyata tetap menjadi gate berikutnya.
- Belum diubah pada PR ini: trusted server-side teacher/student role enforcement, transport WebSocket Nalaro Live, dan penyimpanan hasil Live permanen.

### 1 Okt 2026 — Role enforcement + WebSocket Live + hasil Live permanen

- PR #7 / branch integrasi `feat/live-security-realtime` dibangun di atas `feat/learning-insights` (stacked PR #6). Perubahan Live yang relevan dari PR #5 juga dibawa agar UX/realtime tidak meregresikan hardening kuis sebelumnya.
- Role teacher/student kini diperiksa Worker dari profil Firestore milik Firebase UID yang sama. D1 hanya mempercayai role setelah verifikasi dan cache direvalidasi maksimal 24 jam. Route create/manage kelas, materi, kuis, tugas, presensi, Bank Kuis, AI Assist, Learning Insights, dan host Live diberi boundary teacher/student yang eksplisit.
- Nalaro Live memakai WebSocket Durable Object Hibernation untuk delivery state realtime. Host memakai tiket socket satu kali; peserta dapat mengautentikasi socket dengan participant token. REST tetap dipakai untuk mutation/answer sehingga scoring tetap server-authoritative.
- Hasil sesi Live final disimpan idempotent ke D1 melalui migration `0011_live_quiz_results.sql`: metadata sesi, ranking peserta, dan ringkasan benar/poin per soal. Raw answer tidak disalin ke D1 report. Host dapat retry jika persist gagal; alarm DO mencoba menyimpan lagi sebelum room kedaluwarsa.
- Guru dapat membuka riwayat Live permanen, detail akurasi/ranking, dan ekspor CSV dari Kuis kelas; kuis umum juga mendapat riwayat/detail/CSV.
- Join Live tetap publik. Jika request membawa Firebase token siswa yang verified dan siswa memang anggota kelas, result dipetakan ke `student_id`; peserta publik tidak pernah ditebak identitasnya dari nama.
- Learning Insights sekarang memakai Live terautentikasi sebagai strong evidence dengan bobot mastery 0,90. Hasil Live publik tetap hanya laporan dan tidak masuk profil analitik siswa.
- Test source ditambah/diupdate untuk trusted role cache, Live persistence/report, privacy payload hotspot/arrange, participant reconnect, participant ID contract, dan integrasi Live → Learning Insights. Smoke script produksi juga diperbarui untuk membuat/menghapus profil role Firestore uji.
- **Belum dideploy**: migration `0009`, `0010`, `0011`, Worker terbaru, dan frontend terbaru belum diterapkan ke remote. GitHub Actions PR #7 yang diamati (run #10 dan #11) sama-sama selesai `failure` sebelum satu pun step dijalankan (`steps=null`); jangan menyebut branch ini lulus CI/production sebelum validasi nyata dilakukan.

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


### Snapshot posisi sebelum integrasi release (riwayat, bukan status aktif)

## Posisi saat ini

**Tahap: API inti sudah diimplementasikan pada Worker/D1; verifikasi cutover browser dan sejumlah fitur lanjutan belum selesai.** Jangan menyebut seluruh migrasi dan fitur `100%`.

- Worker `nalaro-api` melayani route LMS, upload signature, AI, Learning Insights, dan Nalaro Live. Pada branch integrasi `feat/live-security-realtime`, role teacher/student diverifikasi server dari profil Firestore immutable lalu dicache 24 jam di D1; Live memakai WebSocket Durable Object dan hasil akhirnya dipersistenkan ke D1. Produksi remote masih pada migrasi `0001`–`0008`; `0009`–`0011` belum diterapkan remote.
- Pages `https://nalaroclass.pages.dev` dan Worker `https://nalaro-api.uniquefactuhl.workers.dev` tersedia. Pada 30 September 2026, halaman depan memberi HTTP 200 dan preflight dari origin Pages ke `/classes?scope=joined` memberi HTTP 204 dengan header CORS yang benar. Ini belum membuktikan alur login atau tampilan kelas.
- Uji API terautentikasi sebelumnya lulus untuk kelas, kuis/hasil, tugas/penilaian, Bank Kuis, kuis umum, signature unggahan, beberapa fase Nalaro Live, dan AI. Akun serta data uji dibersihkan; D1 kemudian memiliki 0 kelas. Rincian ada di [status migrasi Cloudflare](cloudflare-backend-migration-status.md).
- Frontend lokal dan `.env.example` menunjuk Worker lewat `VITE_API_URL`/`VITE_AI_URL`. Variabel build Pages dan kesamaan source dengan repository GitHub lain yang terhubung ke Pages belum diverifikasi dari browser produksi.
- Kode AWS Lambda, DynamoDB, SQS, dan SAM masih ada di `backend/`. Infrastruktur lama belum dinonaktifkan.

