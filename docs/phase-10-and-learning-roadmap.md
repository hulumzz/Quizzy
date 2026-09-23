# Fase 10 dan roadmap pembelajaran Quizzy

Status dokumen: rancangan implementasi setelah audit 23 September 2026. Ini membedakan fitur yang sudah ada, fondasi lokal yang menunggu deployment, dan pekerjaan yang belum boleh diklaim selesai.

## Posisi proyek saat ini

Fase 1 sampai 9 telah menyediakan autentikasi, kelas, materi blok, diskusi, presensi, unggah Cloudinary, serta kuis mandiri dengan penilaian server. Kuis mandiri masih mewajibkan siswa menjadi anggota kelas.

Fondasi lokal Fase 10 menambahkan sesi live yang terpisah dari keanggotaan kelas:

- guru membuat sesi dari kuis yang sudah diterbitkan;
- server mengeluarkan kode enam karakter dan URL yang dapat diubah menjadi QR di browser;
- siswa membuka URL publik, memasukkan nama, dan menerima identitas peserta sementara yang bersifat opaque;
- jawaban hanya diterima untuk peserta, soal, dan waktu yang masih aktif;
- host adalah satu-satunya pihak yang dapat menggeser state `lobby -> question -> reveal -> question/finished`;
- layar peserta melakukan polling state publik dua detik sekali sebagai fondasi lokal yang aman untuk diuji.

Setiap kode dan data sesi memiliki TTL 12 jam. Join dibatasi 30 percobaan per menit per jaringan berdasarkan hash satu-arah alamat sumber, sehingga alamat IP mentah tidak disimpan. Transaksi jawaban mengecek lagi state server, indeks soal, dan deadline sebelum menulis jawaban.

Kode live belum dideploy. Endpoint publik Function URL tidak boleh dipromosikan untuk kelas besar sebelum pembatasan trafik, metrik, dan jalur realtime produksi selesai.

## Kontrak kuis live

Satu kuis terbit dapat memiliki beberapa sesi. Kuis adalah sumber soal; sesi menyimpan snapshot soal agar perubahan editor tidak memengaruhi permainan yang sudah dimulai.

| Data | Disimpan server | Terlihat peserta |
| --- | --- | --- |
| Jawaban benar dan pembahasan | Ya | Hanya setelah state reveal, pada fase lanjutan |
| Kode sesi dan state publik | Ya | Ya |
| Token peserta acak | Ya | Hanya pada browser peserta terkait |
| Jawaban individual | Ya | Tidak |
| Aksi host | Ya | Tidak langsung, hanya state hasilnya |

Fondasi lokal Fase 11 sekarang memindahkan jawaban burst ke SQS standar. Request publik hanya mengautentikasi receipt peserta dan memeriksa soal aktif, lalu processor terpisah mengulang pemeriksaan state dan menulis jawaban serta penghitung `answeredCount` dalam satu transaksi DynamoDB. Pesan ganda SQS tidak dapat menggandakan jawaban karena kunci jawaban bersifat unik. Pesan transient memakai partial batch failure dan pesan stale dibuang dengan aman. Konfigurasi awal membatasi consumer menjadi lima concurrency untuk melindungi kapasitas akun.

Firestore tetap hanya digunakan untuk `publicState` dan `hostState`, bukan seluruh jawaban. Integrasi Firestore belum ditambahkan karena rules host/peserta harus diaudit bersama sebelum state realtime dipublikasikan. Sampai saat itu, layar host dan peserta masih polling state ringkas setiap dua detik.

Fase 12 kini memiliki dua bentuk jawaban khas Quizzy yang siap dipakai di kuis mandiri dan live: `arrange` serta `image_hotspot`. `arrange` menyimpan ID item dan urutan benar, lalu memeriksa permutasi lengkap di server. `image_hotspot` menyimpan blok persegi dalam koordinat persentase gambar, tepat satu area benar, dan toleransi 0-10 persen; server menilai titik klik terhadap blok plus margin, bukan keputusan browser. Editor menampilkan gambar serta blok area yang bisa ditarik dan dipilih secara visual. Fase 13 menambahkan skor, checkpoint, leaderboard, dan hasil permanen. Tidak ada nilai atau skor dari browser yang akan dipercaya server.

Implementasi lokal kini memperlihatkan penghitung dan distribusi pilihan agregat hanya kepada host. Saat fase `reveal`, peserta menerima jawaban benar serta pembahasan; pada fase `question`, field tersebut tidak pernah ada pada payload publik.

## Bank Kuis guru

Bank Kuis tidak boleh berbagi dokumen kuis yang dapat diedit lintas guru. Desainnya memakai katalog dan salinan:

1. Guru menyimpan kuis lokal dan menjadi satu-satunya editor sumbernya.
2. Saat menerbitkan ke bank, dibuat entri katalog dengan penulis, lisensi, jenjang, mapel, tag, versi, status moderasi, dan snapshot kuis yang dapat dimainkan.
3. Guru lain memilih `Gunakan`, lalu sistem membuat salinan baru miliknya. Perubahan salinan tidak mengubah sumber atau karya guru lain.
4. `Unduh` berarti ekspor format Quizzy JSON yang tervalidasi. Impor membuat draf, tidak langsung menerbitkan.
5. Katalog publik memerlukan indeks DynamoDB khusus dan moderasi. Jangan memaksakan query lintas kelas dengan scan tabel.

Taksonomi memakai ID yang stabil seperti `matematika`, `bahasa-indonesia`, `informatika`, bukan nama bebas sebagai kunci. Label dapat berubah tanpa memecahkan filter. Data disusun sebagai jenjang `paud`, `sd`, `smp`, `sma-smk`, `perguruan-tinggi`, dan `umum`, plus rumpun seperti sains, sosial, bahasa, vokasi, keagamaan, seni, olahraga, dan lintas disiplin. Fase katalog berikutnya menyediakan daftar mapel Indonesia yang luas, alias pencarian, dan tag tambahan tanpa membuat nama mapel baru dari input bebas.

## Materi dan sesi kelas

Materi saat ini sudah menerima gambar, PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, tautan HTTPS, dan YouTube. YouTube divalidasi terhadap domain resmi dan ditampilkan dari `youtube-nocookie.com`, sehingga streaming memakai infrastruktur YouTube, bukan Quizzy.

PPT ke PDF belum tersedia. Cloudflare Worker tidak dapat menjalankan LibreOffice. Jalur yang benar adalah pekerjaan asinkron: upload -> antrean -> converter berisolasi -> PDF/thumbnail -> metadata status -> preview. Pilihan converter, batas ukuran, retensi file, dan biaya harus disetujui sebelum implementasi. Browser hanya meng-cache PDF dan thumbnail yang immutable, tidak pernah menyimpan token upload atau file privat tanpa kebijakan akses.

Kelas akan memiliki `learningSessions` seperti Google Classroom. Sesi memuat tanggal, judul, urutan, materi, tugas, dan kuis, sehingga materi A hari ini serta materi B besok tetap berada pada kelas yang sama tetapi tidak bercampur.

## Tugas

Fase tugas menambah `Task`, `TaskSubmission`, dan `SubmissionRevision`:

- jenis jawaban: teks LMS, file, gambar/scan, PDF, atau kombinasi;
- aturan per tugas menentukan jenis yang diizinkan, ukuran, tenggat, pengumpulan ulang, dan rubrik;
- file diunggah dengan signed upload yang sama, tetapi metadata submission selalu ditulis dan diberi otorisasi server;
- guru dapat memberi nilai, umpan balik, dan meminta revisi; siswa hanya membaca tugas di kelasnya dan submission miliknya.

## Quizzy Assist melalui Cloudflare Worker

Satu endpoint Worker akan menerima task terbatas: `material_draft`, `quiz_draft`, dan `assessment_feedback`. Endpoint memakai `GROQ_API_KEY` sebagai Cloudflare secret, bukan variabel frontend atau kode sumber. Draf AI selalu masuk editor untuk ditinjau guru, tidak dapat otomatis diterbitkan atau dipakai pada jalur jawaban live.

Worker sekarang berada di `workers/` dan menghapus endpoint D1 lama yang menerima identitas dari browser. `POST /api/ai/assist` memverifikasi tanda tangan Firebase ID token melalui sertifikat publik Google, membatasi body 24 KB, membatasi 12 request per UID per menit di Cloudflare edge, memakai CORS allow-list, dan menyimpan `GROQ_API_KEY` hanya sebagai secret Worker. Draf soal sudah dapat dipanggil dari editor, tetap perlu ditinjau dan diterbitkan guru.

Worker telah lolos dry-run Wrangler, tetapi belum dideploy karena environment Cloudflare belum memiliki `FIREBASE_PROJECT_ID`, origin frontend produksi, maupun secret Groq. Instruksi deployment aman terdapat di `workers/README.md`. AWS deployment untuk antrean jawaban juga menunggu kredensial AWS lokal tersedia.
