# Nalaro Class Cloudflare API

Worker ini melayani API LMS dan AI. Firebase ID token tetap menjadi identitas pengguna; peran teacher/student diverifikasi server dari profil Firestore milik UID yang sama lalu dicache singkat di D1. Data kelas, materi, diskusi, presensi, pertemuan, kuis, tugas, Bank Kuis, dan hasil akhir Nalaro Live disimpan di D1. Sesi Nalaro Live aktif memakai Durable Object SQLite + WebSocket Hibernation; scoring tetap server-side di Durable Object. Unggahan langsung ke Cloudinary memakai signature yang dibuat setelah otorisasi server.

## Menjalankan dan memeriksa

```powershell
npm.cmd ci
npm.cmd run migrate:local
npm.cmd test
npm.cmd run check
npm.cmd run dev
```

Untuk pengujian lokal yang memakai Firebase dan Cloudinary, isi `.dev.vars` sendiri berdasarkan `.dev.vars.example`. File tersebut diabaikan Git. Jangan menyimpan secret di `wrangler.json`, `.env` frontend, atau Git.

## Rilis

Pastikan akun dan database pada `wrangler.json` benar, lalu jalankan dari folder `workers`:

```powershell
npm.cmd exec -- wrangler d1 migrations list nalaro --remote --config wrangler.json
npm.cmd run migrate:remote
npm.cmd exec -- wrangler deploy --dry-run --keep-vars --config wrangler.json
npm.cmd exec -- wrangler deploy --keep-vars --config wrangler.json
```

`--keep-vars` mempertahankan secret dan variable yang dikelola melalui Dashboard. Origin frontend harus terdaftar secara eksplisit pada `ALLOWED_ORIGINS`. Validasi produksi juga memerlukan alur terautentikasi guru/siswa, kuis live, unggahan, dan AI; `/health` hanya memeriksa koneksi D1.

Untuk pemeriksaan API produksi dengan akun Firebase sementara, jalankan `node scripts/smoke-auth.mjs` setelah `.env` frontend berisi konfigurasi Firebase proyek ini. Skrip membuat dua akun uji, menjalankan alur API, kemudian menghapus akun dan baris D1 uji. Sesi Durable Object uji berakhir otomatis setelah 12 jam. Smoke test membuat profil role Firestore sementara, menguji pemetaan siswa ke hasil Live permanen dan Learning Insights, lalu membersihkan profil/account uji. Skrip ini menguji pembuatan signature Cloudinary, bukan transfer file nyata.

Status migrasi dan batas verifikasi tercatat di [`docs/cloudflare-backend-migration-status.md`](../docs/cloudflare-backend-migration-status.md).
