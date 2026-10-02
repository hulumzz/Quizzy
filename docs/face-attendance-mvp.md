# Presensi Wajah MVP

Dokumen ini menjelaskan batas kemampuan presensi wajah Nalaro Class saat ini.

## Arsitektur

- Profil wajah bersifat opsional dan disimpan di Firestore pada dokumen milik UID Firebase pengguna.
- Data utama yang disimpan adalah embedding numerik dan metadata versi model, bukan foto atau rekaman video.
- Kamera, ekstraksi embedding, dan pencocokan 1:1 berjalan di browser menggunakan `@vladmandic/human`.
- API presensi tetap memeriksa autentikasi, keanggotaan kelas, status sesi, duplikasi check-in, dan lokasi jika sesi memakai mode tatap muka.
- Patch lokal 3 Oktober 2026 menambah mode sesi `standard`, `face_optional`, dan `face_required`, serta metode check-in `standard`/`face`. Jenis lokasi tetap terpisah; check-in wajah pada sesi tatap muka tetap memerlukan GPS/radius. Patch ini belum dideploy.

## Verifikasi saat ini

MVP memakai pencocokan wajah ditambah tantangan gerakan kepala acak ke kiri atau kanan. Ini membantu mencegah check-in pasif sederhana, tetapi **bukan liveness atau anti-spoofing tingkat tinggi**. Konfigurasi Human saat ini tidak mengaktifkan model liveness/antispoof.

Karena itu:

- presensi biasa tersedia pada mode `standard` atau `face_optional`; `face_required` hanya menerima metode wajah sesuai pilihan guru;
- `verificationMethod=face` masih merupakan sinyal dari client, bukan bukti pencocokan yang diverifikasi server. Jangan memberlakukan wajah wajib secara luas sebelum gate perangkat dan evaluasi batas MVP dipenuhi;
- hasil face match tidak boleh dianggap bukti identitas absolut;
- threshold perlu diuji di perangkat dan pencahayaan nyata;
- jangan menyimpan screenshot/video kamera sebagai default;
- jangan menghapus validasi server hanya karena face match berhasil di browser.

## Data dan akses

Firestore rules membatasi `faceProfiles/{uid}` agar hanya dapat dibaca, dibuat, diubah, atau dihapus oleh UID yang sama. Profil memakai `schemaVersion`, `modelVersion`, `consentVersion`, status, embedding, serta timestamp enrollment/update.

## Gate sebelum beta

- Uji pendaftaran dan pencocokan di Android/iOS serta desktop dengan beberapa kondisi cahaya.
- Ukur false reject dan false accept pada sampel yang relevan.
- Uji kamera ditolak, kamera tidak tersedia, koneksi terputus, serta pergantian perangkat.
- Pastikan jalur hapus/daftar ulang bekerja.
- Jika presensi wajah akan menjadi syarat wajib atau dipakai pada konteks berisiko lebih tinggi, pindahkan verifikasi kritis ke backend atau gunakan solusi liveness yang lebih kuat.
