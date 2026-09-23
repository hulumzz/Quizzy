# Quizzy AI Worker

Worker ini hanya melayani `POST /api/ai/assist`. Endpoint memverifikasi Firebase ID token sebelum meneruskan permintaan ke Groq. Endpoint lama D1 untuk kelas dan presensi sengaja dihapus, karena API AWS adalah sumber data kelas Quizzy.

## Konfigurasi produksi

1. Ganti `ALLOWED_ORIGINS` di `wrangler.json` dengan domain frontend sebenarnya, misalnya `https://app.quizzy.id`. Bila ada beberapa origin, pisahkan dengan koma. Jangan memakai `*`.
2. Set `FIREBASE_PROJECT_ID` sebagai variable biasa di dashboard Worker. Nilainya adalah Firebase Project ID yang sama dengan `VITE_FIREBASE_PROJECT_ID`.
3. Dari folder ini, jalankan `npm.cmd exec -- wrangler secret put GROQ_API_KEY`, lalu masukkan Groq key secara interaktif. Jangan menaruh key pada `.dev.vars`, `wrangler.json`, atau Git.
4. Audit dan deploy: `npm.cmd exec -- wrangler deploy --dry-run --keep-vars`, lalu `npm.cmd exec -- wrangler deploy --keep-vars`.

Model default adalah `qwen/qwen3.8-27b` untuk draf materi dan soal. Penilaian memakai `openai/gpt-oss-120b` dengan reasoning `medium`; pembuatan soal memakai reasoning `low`; ringkasan memakai Qwen `none` agar hemat token. Endpoint tidak mengirim reasoning ke browser. Setiap Firebase UID dibatasi 12 permintaan AI per menit pada Cloudflare edge; ini pelindung biaya, bukan mekanisme akuntansi yang presisi.

Untuk lokal, salin `.dev.vars.example` menjadi `.dev.vars` dan isi sendiri. File itu sudah diabaikan Git.
