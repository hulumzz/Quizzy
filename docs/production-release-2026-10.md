# Release Nalaro Class - 2 Oktober 2026

Status: **RELEASE CANDIDATE**. Aplikasi dan API sudah live, validasi lokal serta API/browser produksi lulus. Gate yang belum terpenuhi adalah uji Live pada perangkat fisik berbeda dan jaringan nyata. Pengujian kamera/GPS presensi opsional juga belum dilakukan. Jangan menyamakan viewport ponsel atau beberapa browser context pada satu komputer dengan perangkat fisik.

## Arsitektur produksi

- Frontend React/Vite: https://nalaroclass.pages.dev, Cloudflare Pages project `nalaroclass`, GitHub `khoirulzz/nalaroclass`, production branch `main`.
- API: https://nalaro-api.uniquefactuhl.workers.dev, Worker `nalaro-api`, D1 `nalaro` binding `DB`.
- Live: Durable Object SQLite binding `LIVE_QUIZ`, WebSocket Hibernation untuk state; REST untuk mutation/answer, alarm server untuk deadline, D1 untuk hasil final/laporan/CSV.
- Firebase Auth untuk identitas; profil/peran dan Face Profile di Firestore. Peran D1 terverifikasi menjadi anchor yang tidak dapat diganti dengan delete/recreate profil.
- Cloudinary: file langsung dari browser memakai signature server. Groq: melalui Worker; draf AI tetap ditinjau guru.
- `backend/` AWS adalah kode legacy, tidak menjadi jalur frontend produksi. Infrastruktur/data AWS tidak dihapus atau dinonaktifkan pada pekerjaan ini.
- Remote `url`: `hulumzz/Quizzy`; remote `pages`: `khoirulzz/nalaroclass`. Keduanya disinkronkan dengan fast-forward push, tanpa force push. Push ke `pages/main` terbukti memicu build/deploy Pages.

## Source dan deployment terverifikasi

- Integrasi PR #5/#6/#7: merge commit `7062ab5`, `e2d0473`, `0242e25`.
- Perbaikan runtime utama: `f885249`; canonical runtime: `e5cd06d`; UI Insights/recovery host/alat smoke: `1fa2f20`; source aplikasi final setelah koreksi spacing: `d91d1153aa9780b241b380e6862b934267590e72`.
- Worker final: `247b0f1c-4018-428c-bf5b-ba3f294c67a6`, deployed dengan `--keep-vars`.
- Deployment Pages aplikasi final: `f8b81d3a-7790-48a4-8d85-682aa597b577`, https://f8b81d3a.nalaroclass.pages.dev, build/deploy sukses untuk commit `d91d115`.
- Commit dokumentasi/alat smoke setelahnya tidak mengubah bundle aplikasi. SHA `main` dan deployment terbaru diperiksa kembali setelah push akhir; gunakan histori Git/Pages untuk identitas commit dokumentasi tersebut.

## Migrasi dan data

Backup sebelum migrasi: `workers/.wrangler/release-backups/nalaro-before-release-20261002.sql`, lokal dan diabaikan Git. Backup dapat memuat data; jangan commit atau tampilkan isinya.

| Migrasi remote baru | Hasil |
| --- | --- |
| `0009_learning_analytics_indexes.sql` | PASS, index analitik |
| `0010_verified_account_roles.sql` | PASS, anchor role terverifikasi |
| `0011_live_quiz_results.sql` | PASS, hasil/participant/answer Live permanen |
| `0012_live_result_completion.sql` | PASS, penanda snapshot pending/complete |

Migrasi bersifat additive. Daftar migrasi remote tidak memiliki pending migration; `PRAGMA foreign_key_check` kosong. Tidak ada reset D1, pemindahan DynamoDB, atau penghapusan data pengguna. Cleanup hanya menyasar akun/profil, kelas, kuis, laporan, dan file yang dibuat oleh smoke.

## Matriks validasi

| Pemeriksaan yang benar-benar dijalankan | Hasil dan batas |
| --- | --- |
| `npm.cmd run validate` | PASS: lint/build, 10 frontend, 126 backend legacy, 46 Worker, syntax checks |
| Lint/build setelah perbaikan layout | PASS, lint tanpa warning; warning ukuran chunk build masih non-blocking |
| Worker syntax check | PASS, 48 berkas source/script |
| `git diff --check` | PASS |
| CI GitHub `khoirulzz/nalaroclass` | PASS pada `d91d115`, [run Validate](https://github.com/khoirulzz/nalaroclass/actions/runs/36912548348) |
| CI GitHub `hulumzz/Quizzy` | Job tidak mulai: GitHub mengunci akun karena masalah billing, [run/annotation](https://github.com/hulumzz/Quizzy/actions/runs/36912539968). Source yang sama lulus pada repo Pages dan lokal |
| Worker dry run `--keep-vars` | PASS |
| Backup/migration/schema/FK remote | PASS |
| Worker deploy dan authenticated smoke | PASS pada endpoint produksi |
| Security smoke | PASS, student ditolak untuk create class/quiz, edit quiz, grade, host Live, analitik kelas/siswa lain; teacher ditolak pada submission khusus siswa |
| Submission/rejoin/token | PASS, attempt dan answer ganda ditolak; rejoin UID sama tidak membuat peserta baru; token lama ditolak |
| Live socket API | PASS, 1 host + 4 pemain, state/reconnect/receipt, result D1/CSV |
| Pages env/source/deploy | PASS, VITE API/AI/Firebase cocok; build main dari repo Pages benar |
| Browser produksi | PASS, Chrome terpasang via Playwright; desktop 1440x900, mobile viewport 390x844/360x800 |
| Transfer file Cloudinary nyata | PASS, TXT dari browser sampai submission dan review guru; aset smoke dihapus |
| Secret lokal pada tracked source/dist | Tidak ada kecocokan nilai server secret; pemeriksaan ini bukan pemindaian semua histori Git atau secret remote |
| Perangkat fisik/kamera/GPS | BELUM DIUJI |
| Load test di atas 4 pemain | BELUM DIUKUR, jangan mengklaim kapasitas kelas besar |

Browser in-app tidak tersedia pada sesi ini; fallback menggunakan Chrome headless terpasang, dengan koneksi nyata ke Pages/Worker/Firebase/Cloudinary. Tidak memakai mock API.

Smoke browser lengkap exit 0 dilakukan pada source `1fa2f20`. Source final `d91d115` hanya mengoreksi padding kartu Insights dan memperluas alat uji; API/socket/auth smoke serta pemeriksaan UI Insights desktop/mobile dijalankan lagi pada versi itu. Tata letak label/angka dan padding diperiksa dari bounding box serta screenshot.

## Cakupan smoke

API: pendaftaran/login akun uji guru/siswa, profil immutable, kelas/join/member, pertemuan, materi/progres/diskusi, presensi online, kuis/publikasi/attempt/export, tugas/pengumpulan/nilai, signature file, Bank Kuis publish/copy, kuis umum, Live, Learning Insights, dan AI draft.

Browser: login guru/siswa; membuat/gabung kelas dan Insights kosong; membuka modul kelas dan Insights; membaca materi dan mengirim diskusi; autosave kuis dua soal, refresh, submit, refresh hasil; unggah TXT, kumpulkan tugas, simpan nilai/feedback guru dan baca kembali sebagai siswa; presensi online buat/aktif/check-in/akhir; Bank Kuis; Live 1 host + 4 browser context dengan QR/kode, jumlah peserta, soal tanpa refresh, jawaban terkunci, reload, offline/reconnect, alarm pembahasan saat host keluar, finish saat satu pemain offline, hasil/nilai individual serta evidence D1/Insights.

Akun Firebase/Firestore, data D1, dan seluruh file smoke dibersihkan. Percobaan alat uji sebelumnya gagal karena selector label/class dan URL cleanup Cloudinary yang salah; alat diperbaiki, file fixture diverifikasi lalu dihapus, dan alur diulang hingga exit 0. Kegagalan alat tersebut tidak disembunyikan sebagai keberhasilan tes.

## Temuan release yang diperbaiki

- Role tetap terikat ke UID, termasuk verifikasi paralel, kedaluwarsa cache, dan profil Firestore yang dibuat ulang.
- Receipt peserta dipulihkan dari server; heartbeat, auth timeout, stateVersion, dan token socket mencegah state publik/lama dianggap jawaban valid.
- Deadline server berjalan tanpa host; stale advance ditolak. Persistensi gagal diulang tanpa membuang room saat TTL.
- Snapshot D1 parsial tidak masuk laporan/mastery; kode sesi tidak menimpa laporan sesi sebelumnya.
- Perubahan kunci/soal ditolak setelah attempt; arrange tidak mengirim rotasi kunci yang bisa dibalik; boolean benar/salah divalidasi.
- CSV dinetralkan terhadap formula spreadsheet. Recovery/draft dipisahkan per akun; storage gagal tidak merusak alur aktif.
- Canonical/OG/sitemap memakai Pages produksi; CORS WebSocket dan header Pages diperiksa. Kartu Insights mengikuti wrapper Card dan label/angka diperiksa dari posisi DOM serta screenshot.

## Learning Insights

Mastery hanya memakai kuis mandiri, tugas bernilai, dan Live terautentikasi dengan snapshot complete. Presensi/baca materi/diskusi tidak berubah menjadi nilai kemampuan. Peserta publik memiliki `student_id=NULL`, tetap terbaca di laporan Live dan tidak dicocokkan berdasarkan nama. Tes fairness mencakup presensi/tugas sebelum join dan materi lama yang belum diakses; submission tanpa nilai tidak menjadi mastery nol. Endpoint siswa hanya menampilkan dirinya; guru hanya kelasnya. Tidak ada ranking kecerdasan siswa.

## Konfigurasi tanpa nilai secret

Pages: `VITE_API_URL`, `VITE_AI_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`; database/measurement ID mengikuti kebutuhan Firebase proyek. Prefix VITE hanya untuk konfigurasi publik.

Worker: `DB`, `LIVE_QUIZ`, `AI_RATE_LIMITER`, `FIREBASE_PROJECT_ID`, `ALLOWED_ORIGINS`, `GROQ_DEFAULT_MODEL`. Secret binding: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GROQ_API_KEY`. Nilai Dashboard dipertahankan melalui `--keep-vars`. Jangan menyalin server secret ke Pages/VITE.

## Rollback tanpa menghapus data

Checkpoint integrasi sebelumnya yang sudah lolos API: Worker `f15eb465-cb2d-4930-a66a-59776635d461`. Checkpoint frontend yang sudah lolos alur browser utama: Pages `1bfa4c7d-9406-48a0-ba33-f21949f5c373` (`e5cd06d`).

```powershell
npm.cmd --prefix workers exec -- wrangler rollback f15eb465-cb2d-4930-a66a-59776635d461 --name nalaro-api --config workers/wrangler.json
```

Untuk frontend, pilih deployment produksi yang sukses di Dashboard Cloudflare Pages lalu **Rollback**. Hentikan/revert push penyebab masalah agar Git integration tidak men-deploy ulang perubahan itu. Revert source dengan commit baru, tanpa force push. Pastikan checkpoint frontend/Worker kompatibel, lalu ulangi health/auth/Live/hasil. [Panduan rollback Pages](https://developers.cloudflare.com/pages/configuration/rollbacks/).

Pertahankan migrasi `0009`-`0012` dan data D1. Jangan DROP tabel, reset database, atau import backup menimpa data baru untuk rollback kode. Backup adalah pemulihan bencana yang membutuhkan kajian data terpisah. Rollback ini didokumentasikan, tidak dieksekusi pada release sukses.

## Gate tersisa dan backlog

Gate release final: ulangi skenario Live 1 host + 3-5 pemain pada perangkat fisik berbeda, termasuk Wi-Fi putus/sambung. Jika presensi wajah/lokasi dipakai, lakukan uji izin/akurasi kamera/GPS pada perangkat yang relevan. Setelah bukti ini ada, revisi status RC menjadi READY; jangan memindahkan gate hanya karena build lulus.

Non-blocking: pengukuran kapasitas Live lebih besar, browser lain/Safari, perbaikan ukuran chunk, agenda/jadwal, pengaturan anggota lanjutan, moderasi/rating Bank Kuis, rubrik/notifikasi, preview Office, dan sinkronisasi nama Firestore ketika Firebase Auth belum memiliki displayName. Penonaktifan AWS diputuskan terpisah setelah cutover diterima.

CI pada repository asal `hulumzz/Quizzy` membutuhkan pemulihan akun/billing GitHub oleh pemilik. CI repository Pages tetap lulus dan kedua remote menerima push. Tidak ada perubahan paket berbayar atau pembayaran pada pekerjaan ini.

## Mengulang smoke

```powershell
$env:NODE_OPTIONS='--dns-result-order=ipv4first'
node workers/scripts/smoke-auth.mjs
```

Untuk browser, install Playwright di direktori tools sementara di luar dependensi aplikasi; script default memakai `%TEMP%/nalaro-release-tools` dan Chrome terpasang. Atur `NALARO_BROWSER_TOOLS`/`NALARO_CHROME_PATH` bila berbeda, serta `NALARO_SMOKE_BROWSER=1`. Smoke membuat data uji di produksi dan melakukan cleanup yang dibatasi UID akun uji; jalankan hanya pada akun Cloudflare/proyek Firebase yang sesuai. Token/login tidak dicetak. Screenshot lokal berada di `workers/.wrangler/release-artifacts/` dan tidak di-commit.
