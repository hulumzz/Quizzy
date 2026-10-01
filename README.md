# Nalaro Class

Nalaro Class adalah LMS berbasis React untuk kelas, materi, diskusi, presensi, tugas, kuis mandiri, Nalaro Live, dan Learning Insights yang membaca perkembangan belajar dari evidence kelas.

Live: [nalaroclass.pages.dev](https://nalaroclass.pages.dev). Status 2 Oktober 2026: **RELEASE CANDIDATE** dengan API dan browser produksi teruji; perangkat fisik/jaringan nyata serta kamera/GPS opsional belum diverifikasi. Lihat [laporan release, bukti tes, dan rollback](docs/production-release-2026-10.md).

## Arsitektur

- React + Vite pada Cloudflare Pages `nalaroclass`, production branch `main` dari `khoirulzz/nalaroclass`.
- Firebase Auth untuk identitas; role teacher/student diverifikasi ulang oleh Worker dari profil Firestore immutable dan dicache terbatas di D1.
- Cloudflare Worker + D1 untuk API LMS dan hasil Live permanen; sesi Nalaro Live aktif memakai Durable Object SQLite + WebSocket realtime.
- Frontend produksi memakai Worker. Kode/infrastruktur AWS Lambda + DynamoDB masih disimpan sebagai legacy; penonaktifan terpisah dan data LMS lama tidak dipindahkan.
- Cloudinary untuk unggahan langsung dari browser dengan signature backend.
- Worker juga menjadi gateway AI, tanpa API key di browser.

## Menjalankan lokal

```powershell
npm.cmd ci
npm.cmd --prefix backend ci
npm.cmd --prefix workers ci
npm.cmd run dev
```

Salin `.env.example` ke `.env` dan isi hanya konfigurasi publik yang diperlukan frontend. Secret backend dan Worker tidak boleh disimpan di frontend.

## Validasi

```powershell
npm.cmd run validate
npm.cmd run validate:infra
git diff --check
```

`validate` menjalankan lint, build, test frontend/backend/Worker, dan syntax check backend. `validate:infra` menjalankan SAM lint dan build tanpa melakukan deployment.

`validate:infra` hanya diperlukan jika mengubah infrastruktur AWS legacy. Release Cloudflare diuji dengan `validate`, Worker dry run, migrasi remote, dan smoke produksi. Cara mengulang smoke guru/siswa/Live/browser serta batas buktinya ada pada [laporan release](docs/production-release-2026-10.md).

Remote Git: `url` = `hulumzz/Quizzy`, `pages` = `khoirulzz/nalaroclass`. Kirim commit yang sudah divalidasi ke keduanya dengan `git push url main` dan `git push pages main`; push `pages/main` memicu build Pages. Worker dideploy terpisah memakai `--keep-vars`.

## Status produk

- Kuis mandiri mendukung pilihan ganda, benar/salah, jawaban singkat, susun urutan, dan hotspot gambar; penilaian dilakukan backend.
- Nalaro Live menyediakan lobi, kode/QR, jawaban terkunci, pembahasan, papan skor host, state realtime WebSocket, reconnect, serta hasil akhir permanen dan ekspor CSV guru.
- Tugas mendukung tenggat waktu lokal, pengaitan ke Pertemuan Pembelajaran, upload Cloudinary, penilaian, feedback, serta snapshot revisi.
- Presensi wajah MVP bersifat opsional: embedding dan pencocokan 1:1 berjalan di browser, tanpa menyimpan foto/video. Lihat [batasan dan alurnya](docs/face-attendance-mvp.md).
- Nalaro Learning Insights menggabungkan kuis mandiri, Nalaro Live terautentikasi, tugas, revisi, presensi, progres materi, dan diskusi menjadi mastery, tren, konsistensi, keterlibatan, serta keyakinan data yang dapat dijelaskan. Lihat [metodologi Learning Insights](docs/learning-insights.md).

Mulai dari [status dan riwayat pengerjaan Nalaro Class](docs/nalaro-project-status.md) untuk posisi terkini, fitur yang sudah ada, pekerjaan tersisa, dan catatan pembaruan setiap tugas. Bukti migrasi backend tersedia di [status migrasi Cloudflare](docs/cloudflare-backend-migration-status.md). [Arsitektur terdahulu](docs/architecture-status.md) menyimpan baseline pengembangan sebelumnya.
