# Fase 10 dan roadmap pembelajaran Quizzy

Status dokumen: diperbarui setelah audit `main` pada 23 September 2026, baseline `4bdef7d`.

Dokumen ini membedakan tiga hal: fitur yang sudah ada di repository, pekerjaan yang masih harus diverifikasi/deploy, dan fitur produk lanjutan yang memang belum diimplementasikan.

## Posisi proyek saat ini

Fase 1 sampai 9 telah membentuk LMS inti:

- autentikasi Firebase;
- kelas dan membership;
- materi blok dan upload Cloudinary;
- diskusi kontekstual;
- presensi berbasis lokasi;
- kuis mandiri dengan scoring server;
- progress dan bookmark siswa.

Fase 10-12 tidak lagi sekadar rancangan lokal. Fondasi live quiz, SQS answer buffering, serta tipe soal `arrange` dan `image_hotspot` sekarang sudah berada di branch `main`.

Namun status repository tidak sama dengan status produksi. Deployment cloud terbaru dan uji browser end-to-end tetap menjadi gate sebelum live quiz dipakai pada kelas nyata.

## Fase 10 - live quiz foundation

Sudah tersedia di kode:

- guru membuat sesi live dari kuis yang sudah diterbitkan;
- kode enam karakter dan URL yang dapat dijadikan QR;
- peserta dapat masuk tanpa akun dan tanpa membership kelas;
- peserta menerima token sementara opaque;
- state server: `lobby -> question -> reveal -> question/finished`;
- jawaban hanya diterima untuk peserta, soal, dan waktu yang masih aktif;
- correct answer tidak dikirim pada fase `question`;
- correct answer dan pembahasan tersedia pada fase `reveal`;
- TTL 12 jam untuk data live;
- rate limit join berdasarkan hash source network;
- host/player melakukan polling state ringkas setiap dua detik.

Yang masih wajib sebelum production:

- deploy versi SAM terbaru;
- uji multi-device di browser nyata;
- tetapkan batas peserta yang didukung;
- perbaiki kapasitas DynamoDB live-answer.

## Fase 11 - buffering jawaban live

Sudah tersedia di kode:

```text
browser answer
-> public live endpoint
-> participant/session validation
-> SQS
-> LiveQuizAnswerProcessor Lambda
-> canonical state recheck
-> DynamoDB transaction
```

SQS mencegah lonjakan request langsung menghantam seluruh proses penulisan sinkron. Pesan stale dapat dibuang dan kegagalan transient dapat diretry melalui partial batch failure. DLQ menampung pesan yang gagal berulang.

### Gate kapasitas

DynamoDB masih memakai `PROVISIONED` 1 RCU / 1 WCU. Ini cocok untuk development hemat, tetapi bukan target kapasitas live quiz. Satu jawaban live membutuhkan beberapa write di satu transaksi. Sebelum fase live dinyatakan production-ready, tentukan salah satu strategi berikut:

- on-demand untuk beta awal yang trafiknya belum dapat diprediksi;
- provisioned + autoscaling;
- kapasitas provisioned eksplisit berdasarkan target peserta dan waktu jawab.

Keputusan harus diikuti load test, metrik antrean, dan budget guardrail.

## Fase 12 - tipe soal khas Quizzy

Sudah tersedia di editor, validator, self-paced scoring, dan payload live:

### Arrange

- item memiliki ID stabil;
- guru menentukan urutan benar;
- server memeriksa permutasi lengkap;
- siswa dapat mengurutkan melalui drag/move controls.

### Image hotspot

- gambar HTTPS;
- area dinyatakan dalam koordinat persentase;
- tepat satu area ditandai sebagai benar;
- toleransi 0-10%;
- server menilai titik klik, bukan keputusan browser.

Masih perlu pengujian usability mobile/touch dan aksesibilitas.

## Fase 13 - scoring live dan hasil permanen

Implementasi lokal tersedia. Processor antrean menilai jawaban terhadap soal kanonik di server, lalu menulis jawaban, poin, jawaban benar, dan agregat sesi secara atomik. Hasil individu memerlukan participant token dan hanya tersedia setelah host mengakhiri sesi; layar host menampilkan papan skor akhir.

Masih diperlukan deployment AWS, load test, dan E2E multi-perangkat sebelum fitur ini dapat dianggap siap produksi.

Target:

- server menghitung benar/salah untuk setiap answer event;
- score per soal;
- optional speed bonus yang tetap ditentukan server;
- score peserta per sesi;
- leaderboard host;
- personal result peserta;
- hasil akhir persisten;
- export/rekap guru;
- aturan seri dan late-answer yang eksplisit.

Jangan menyimpan score yang dihitung browser sebagai sumber kebenaran.

## Realtime transport

Firestore realtime belum diperlukan untuk membuktikan flow produk. Polling dua detik saat ini lebih sederhana dan aman untuk beta terbatas.

Migrasi ke realtime baru dilakukan jika pengukuran menunjukkan polling tidak memenuhi kebutuhan pengalaman atau biaya. Jika Firestore digunakan, batasi pada state kecil seperti `publicState` / `hostState`; jawaban dan scoring tetap menjadi domain backend.

## Quizzy Assist

Cloudflare Worker sekarang menjadi satu-satunya jalur AI yang dirancang untuk frontend.

Endpoint:

`POST /api/ai/assist`

Task yang didukung:

- `material_draft`;
- `quiz_draft`;
- `assessment_feedback`.

Kontrol yang sudah ada:

- Firebase bearer verification;
- exact-origin CORS;
- request size limit;
- per-UID edge rate limit;
- `GROQ_API_KEY` hanya sebagai Worker secret;
- output AI selalu berupa draft yang perlu ditinjau guru.

Model repository saat audit:

- `qwen/qwen3.8-27b` untuk drafting;
- `openai/gpt-oss-120b` untuk assessment feedback.

Keduanya masih tercantum sebagai model Groq yang aktif pada audit 23 September 2026.

### Pekerjaan AI berikutnya

- sambungkan `VITE_AI_URL` pada deployment frontend ke Worker produksi;
- masukkan Worker tests ke validation/CI utama;
- gunakan `material_draft` di editor materi;
- gunakan `assessment_feedback` hanya setelah modul tugas/submission tersedia;
- tambahkan usage telemetry/cost guardrail bila penggunaan AI mulai terbuka luas.

## Learning Sessions

Implementasi kode tersedia.

Model saat ini:

```text
Class
└─ LearningSession
   ├─ materials (sessionId opsional)
   ├─ tasks (belum diimplementasikan)
   ├─ quizzes (sessionId opsional)
   └─ attendance (sessionId opsional)
```

Perilaku yang sudah ada:

- guru membuat, mengubah, menerbitkan, mengarsipkan, memulihkan, dan mengurutkan pertemuan;
- siswa hanya melihat pertemuan published;
- pertemuan memiliki tanggal dan `sortOrder` eksplisit;
- assignment resource diverifikasi server-side agar hanya mengarah ke pertemuan kelas yang sama dan bukan archived;
- konten lama tanpa `sessionId` tidak dimigrasikan dan tetap tampil pada blok `Tanpa pertemuan`;
- batas saat ini 100 pertemuan per kelas agar reorder dapat dilakukan atomik dalam satu transaksi;
- halaman Pertemuan tersedia untuk guru dan siswa, dengan resource materi, kuis, dan presensi dikelompokkan dalam satu alur responsif;
- editor materi/kuis serta form presensi dapat memilih pertemuan.

Yang masih diperlukan sebelum production: deployment backend/frontend terbaru dan E2E browser untuk create/edit/reorder/archive/publish, visibility siswa, assignment resource, serta legacy unassigned content.

## Tugas dan submission

Belum diimplementasikan.

Entity yang disarankan:

- `Task`;
- `TaskSubmission`;
- `SubmissionRevision`.

Kebutuhan minimum:

- jawaban teks;
- upload file/gambar/PDF;
- deadline;
- resubmission policy;
- status submitted/returned/graded;
- nilai;
- feedback;
- revisi;
- rubrik.

Signed upload Cloudinary yang sudah ada dapat dipakai ulang, tetapi metadata submission dan authorization tetap harus lewat backend.

## Bank Kuis guru

Implementasi lokal sudah tersedia dengan desain **catalog + copy**, bukan dokumen kuis bersama yang diedit lintas guru.

1. Guru menerbitkan kuis kelas yang sudah published menjadi snapshot katalog.
2. Katalog memuat jenjang, mata pelajaran sistematis, tag, lisensi, ID pembuat, dan ringkasan soal.
3. Guru lain memilih `Gunakan sebagai draf`; server membuat salinan baru di kelas tujuan tanpa akses edit ke kuis sumber.
4. Pemilik dapat menarik publikasi tanpa memengaruhi salinan yang sudah dibuat guru lain.
5. Kuis dapat diunduh oleh pemilik sebagai JSON Quizzy dan diimpor ulang sebagai draf tervalidasi.
6. Listing DynamoDB menggunakan empat partition-key filter (`all`, jenjang, mata pelajaran, kombinasi), sehingga tidak memakai full-table scan.

Belum ada moderation queue, pencarian teks, rating, ataupun analytics penggunaan. Fitur tersebut hanya ditambahkan setelah deployment backend dan E2E Bank Kuis selesai.

## Dokumen dan preview

Materi sudah menerima image, PDF, dokumen Office tertentu, TXT, tautan HTTPS, dan YouTube.

PPT/PPTX -> PDF/thumbnail belum tersedia. Bila fitur ini benar-benar dibutuhkan, jalur yang lebih aman adalah asynchronous converter:

```text
upload
-> conversion job
-> isolated converter
-> PDF/thumbnail
-> metadata status
-> preview
```

Cloudflare Worker bukan tempat menjalankan LibreOffice.

## Production Beta Gate

Sebelum menambah modul besar, selesaikan gate berikut:

1. deploy AWS template terbaru;
2. deploy AI Worker dengan origin dan secret produksi;
3. ubah strategi kapasitas DynamoDB agar live quiz realistis;
4. tambahkan log retention + monitoring untuk answer processor;
5. monitor queue age/depth dan DLQ;
6. jalankan `npm run validate`;
7. jalankan Worker tests;
8. jalankan SAM validation/build;
9. buat CI untuk seluruh validation;
10. lakukan E2E browser untuk class, material upload, attendance, self-paced quiz, live quiz, dan AI draft;
11. load-test live answers berdasarkan target peserta;
12. dokumentasikan batas peserta dan failure/recovery behavior.

Setelah gate ini lulus, urutan pengembangan yang direkomendasikan:

```text
13. Live scoring + leaderboard + result
14. Learning Sessions
15. Tasks + submissions + grading
16. Quiz Bank / catalog - implementasi lokal selesai, deployment dan E2E masih diperlukan
17. Progress analytics + teacher reports
18. Notifications / schedules
19. Accessibility, performance, security, and release hardening
20. Production release
```

Urutan tersebut menjaga agar Quizzy tidak terus menambah permukaan fitur di atas backend yang belum dibuktikan pada beban live.
