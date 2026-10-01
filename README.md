# Nalaro Class

Nalaro Class adalah LMS berbasis React untuk kelas, materi, diskusi, presensi, tugas, kuis mandiri, Nalaro Live, dan Learning Insights yang membaca perkembangan belajar dari evidence kelas.

## Arsitektur

- React + Vite untuk antarmuka guru dan siswa.
- Firebase Auth untuk identitas dan pembatasan peran.
- Cloudflare Worker + D1 untuk API LMS; sesi live memakai Durable Object SQLite.
- AWS Lambda + DynamoDB masih tersedia sambil menunggu verifikasi cutover dan rencana penonaktifan; data LMS lama diputuskan tidak dipindahkan.
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

## Status produk

- Kuis mandiri mendukung pilihan ganda, benar/salah, jawaban singkat, susun urutan, dan hotspot gambar; penilaian dilakukan backend.
- Nalaro Live menyediakan lobi, kode/QR, jawaban terkunci, pembahasan, papan skor host, dan peringkat akhir peserta.
- Tugas mendukung tenggat waktu lokal, pengaitan ke Pertemuan Pembelajaran, upload Cloudinary, penilaian, feedback, serta snapshot revisi.
- Presensi wajah MVP bersifat opsional: embedding dan pencocokan 1:1 berjalan di browser, tanpa menyimpan foto/video. Lihat [batasan dan alurnya](docs/face-attendance-mvp.md).
- Nalaro Learning Insights menggabungkan kuis, tugas, revisi, presensi, progres materi, dan diskusi menjadi mastery, tren, konsistensi, keterlibatan, serta keyakinan data yang dapat dijelaskan. Lihat [metodologi Learning Insights](docs/learning-insights.md).

Mulai dari [status dan riwayat pengerjaan Nalaro Class](docs/nalaro-project-status.md) untuk posisi terkini, fitur yang sudah ada, pekerjaan tersisa, dan catatan pembaruan setiap tugas. Bukti migrasi backend tersedia di [status migrasi Cloudflare](docs/cloudflare-backend-migration-status.md). [Arsitektur terdahulu](docs/architecture-status.md) menyimpan baseline pengembangan sebelumnya.
