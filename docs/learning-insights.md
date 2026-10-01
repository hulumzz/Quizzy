# Nalaro Learning Insights

## Tujuan

Learning Insights membaca perkembangan belajar siswa dari evidence yang sudah ada di kelas tanpa machine learning berat dan tanpa membuat satu skor absolut yang melabeli kemampuan siswa.

Analitik bersifat **deskriptif dan explainable**. Guru dapat melihat sumber setiap sinyal, sedangkan siswa hanya dapat melihat analitik miliknya sendiri.

## Sumber data

### Evidence kuat untuk pemahaman

- hasil kuis mandiri;
- nilai tugas yang sudah dinilai.

Keterlibatan, presensi, dan aktivitas membaca **tidak menaikkan skor pemahaman**.

### Evidence pendukung

- progres materi;
- penyelesaian tugas;
- ketepatan waktu pengumpulan;
- presensi yang sudah berakhir;
- partisipasi diskusi pada materi;
- revisi tugas dan perubahan nilai sebelum/sesudah feedback.

## Dimensi

### Mastery / Pemahaman

Mastery adalah weighted average dari:

- rata-rata kuis: bobot 1.00;
- rata-rata tugas bernilai: bobot 1.15.

Jika belum ada nilai, mastery tidak diisi, bukan dianggap 0.

### Consistency / Konsistensi

Komponen yang tersedia dinormalisasi kembali:

- kehadiran: 55%;
- task completion: 30%;
- ketepatan waktu: 15%.

Sesi presensi yang masih aktif/draf tidak dihitung. Tugas masa depan juga tidak dihitung sebagai belum selesai.

### Engagement / Keterlibatan

Komponen yang tersedia:

- rata-rata progres materi: 45%;
- partisipasi diskusi lintas materi: 15%;
- kehadiran: 20%;
- task completion: 20%.

Diskusi dihitung berdasarkan jumlah materi berbeda yang pernah diikuti, bukan jumlah pesan mentah, agar spam tidak menaikkan engagement secara berlebihan.

### Trend

Trend memakai urutan evidence penilaian berdasarkan waktu.

- 1 evidence: belum cukup data;
- 2–3 evidence: selisih evidence terakhir terhadap evidence pertama;
- 4+ evidence: rata-rata maksimal 3 evidence terbaru dibanding maksimal 3 evidence sebelumnya.

Ambang:

- delta >= +5: meningkat;
- delta <= -5: menurun;
- selainnya: stabil.

### Revision response

Jika tugas memiliki nilai sebelum revisi dan nilai setelah revisi, Learning Insights menghitung rata-rata gain. Sinyal ini tidak menaikkan mastery; ia hanya menjelaskan respons siswa terhadap feedback.

### Confidence

Confidence menunjukkan **kekuatan bukti**, bukan kemampuan.

Confidence bertambah dari:

- jumlah evidence kuat;
- jumlah kesempatan belajar yang terukur;
- keragaman sumber data.

Label:

- < 40: rendah;
- 40–69.9: sedang;
- >= 70: tinggi.

## Status perkembangan

Status bukan ranking dan tidak permanen.

- Belum cukup data: mastery belum tersedia atau evidence kuat < 2;
- Menguasai: mastery >= 80 dan tren tidak menurun;
- Perlu dukungan: mastery < 60 atau tren turun kuat (<= -10);
- Berkembang: kondisi lainnya.

## Analitik per topik

Nalaro memakai **Learning Session / Pertemuan** sebagai unit topik.

Materi, kuis, tugas, dan presensi yang memiliki sessionId otomatis masuk analitik per pertemuan. Diskusi mewarisi pertemuan dari materi.

Konten tanpa sessionId tetap masuk analitik kelas, tetapi ditampilkan sebagai unmapped agar guru tahu coverage topik belum lengkap.

## Fairness siswa baru

Nalaro tidak menghukum siswa karena aktivitas yang sudah lewat sebelum bergabung:

- presensi yang selesai sebelum joinedAt tidak masuk denominator;
- tugas yang sudah jatuh tempo sebelum joinedAt tidak dianggap belum selesai;
- materi lama tidak masuk denominator engagement kecuali siswa memang pernah membukanya.

## Privasi dan akses

- Guru kelas dapat melihat overview dan detail siswa di kelas miliknya.
- Siswa hanya dapat melihat analitik dirinya sendiri.
- Endpoint overview kelas menolak anggota biasa.
- Tidak ada leaderboard kemampuan siswa.

## API

    GET /classes/:classId/analytics
    GET /classes/:classId/analytics/me
    GET /classes/:classId/analytics/students/:studentId

## Batas versi saat ini

Nalaro Live belum menjadi sumber Learning Insights karena hasil Live masih hidup sementara di Durable Object. Setelah hasil Live dipersistenkan ke D1, source tersebut dapat ditambahkan ke engine tanpa mengubah UI atau model analitik utama.

Tidak ada AI/LLM yang menghitung skor. Narrative insight saat ini dihasilkan secara deterministik dari evidence. Jika AI summary ditambahkan nanti, statistik tetap menjadi authority.

## Performa

Learning Insights membaca data authoritative secara batch saat dashboard dibuka. Tidak ada tabel cache yang perlu disinkronkan. Migration 0009 menambahkan index baca pada pola class/student/session agar query analitik tetap ringan ketika histori kelas bertambah.
