# Status migrasi backend ke Cloudflare

Terakhir diperbarui: 30 September 2026.

## Arsitektur sasaran

- Frontend React tetap memakai Firebase Authentication dan unggahan langsung ke Cloudinary.
- Worker `nalaro-api` memverifikasi Firebase ID token, menyediakan REST API LMS dan gateway AI, lalu menyimpan domain LMS di D1 `nalaro`.
- Nalaro Live menyimpan sesi dan jawaban di Durable Object SQLite yang dipilih berdasarkan kode sesi.
- Profil wajah masih memakai layanan Firestore tersendiri dan berada di luar pemindahan API AWS ke Worker.

## Sudah ada di kode

- Fondasi API: CORS origin eksplisit, error terstruktur, Firebase JWT, `/health`, migrasi D1, dan AI.
- REST kelas, materi, diskusi, presensi, pertemuan pembelajaran, kuis kelas, kuis umum, Bank Kuis, serta tugas dan penilaian.
- Signature Cloudinary untuk materi dan lampiran tugas, review hasil kuis, impor/ekspor kuis, serta riwayat revisi tugas.
- Endpoint host dan peserta Nalaro Live dengan skor server, jawaban tersembunyi sampai fase pembahasan, token peserta, batas percobaan bergabung, dan kedaluwarsa 12 jam.
- Validasi lokal: `npm.cmd run validate`, 23 tes Worker, dry run deployment, dan smoke test `/health` serta kode sesi tak dikenal pada Wrangler lokal.

## Status lingkungan

- Akun Cloudflare yang terpilih melalui Wrangler: `fa9e4b5cc90250f132b17fb7c067490b`.
- D1: `nalaro` (`750ff7b1-7db4-4ed5-8c3b-5f42773b74af`), region APAC.
- Worker: `https://nalaro-api.uniquefactuhl.workers.dev`.
- Nilai secret tidak diperiksa; nama binding Cloudinary dan Groq tersedia pada Worker. Satu permintaan AI terautentikasi menghasilkan HTTP 200 pada Worker produksi.
- Migrasi D1 `0001` sampai `0008` sudah tercatat di remote; tabel `general_quizzes` dan `quiz_bank_catalog` terverifikasi.
- Worker versi `5aa186d9-d4ff-4300-84df-b606a5e84548` dideploy 30 September 2026 dengan origin Pages baru. Preflight dari `https://nalaroclass.pages.dev` ke `/classes?scope=joined` memberi 204 dengan `Access-Control-Allow-Origin`; GET tanpa token memberi 401 dengan header CORS yang sama, sedangkan origin asing tetap 403.
- Proyek Pages `nalaroclass` pada akun Cloudflare yang sama sudah terhubung ke GitHub dan tersedia di `https://nalaroclass.pages.dev`. Frontend lokal dalam `.env` dan `.env.example` menunjuk Worker untuk API dan AI. AWS dan data DynamoDB belum dihapus atau dipindahkan.
- Uji terautentikasi di Worker produksi lulus untuk kelas guru/siswa, kuis dan hasil, tugas dan penilaian, Bank Kuis, kuis umum, signature Cloudinary, Nalaro Live, serta AI. Dua akun Firebase dan baris D1 uji dibersihkan sesudahnya. Uji ini belum mengunggah file Cloudinary nyata atau memeriksa tampilan di browser/perangkat nyata.
- Pengguna menyatakan data LMS lama boleh ditinggalkan. Pemindahan data DynamoDB tidak diperlukan untuk cutover ini.
- D1 produksi mempunyai 0 kelas pada pemeriksaan 30 September 2026. Daftar kelas kosong setelah cutover sesuai keputusan untuk meninggalkan data LMS lama.

## Pemeriksaan lanjutan

1. Uji tampilan serta alur guru/siswa di browser dan dua perangkat, termasuk unggahan Cloudinary nyata serta Nalaro Live. Pantau kegagalan API dan kuis live sebelum menonaktifkan AWS.
2. Setelah Pages memakai domain final, perbarui URL kanonis dan sitemap frontend yang masih menunjuk `quizzy-f01.pages.dev`.

Pemeriksaan build, tes otomatis, dry run, dan `/health` tidak membuktikan seluruh alur terautentikasi maupun cutover produksi.
