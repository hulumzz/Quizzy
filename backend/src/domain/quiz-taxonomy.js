export const QUIZ_LEVELS = Object.freeze([
  { id: 'paud', label: 'PAUD/TK' },
  { id: 'sd', label: 'SD/MI' },
  { id: 'smp', label: 'SMP/MTs' },
  { id: 'sma-smk', label: 'SMA/SMK/MA' },
  { id: 'perguruan-tinggi', label: 'Perguruan Tinggi' },
  { id: 'umum', label: 'Umum/Profesional' },
]);

export const QUIZ_SUBJECTS = Object.freeze([
  ['agama-islam', 'Pendidikan Agama Islam', 'keagamaan'], ['agama-kristen', 'Pendidikan Agama Kristen', 'keagamaan'], ['agama-katolik', 'Pendidikan Agama Katolik', 'keagamaan'], ['agama-hindu', 'Pendidikan Agama Hindu', 'keagamaan'], ['agama-buddha', 'Pendidikan Agama Buddha', 'keagamaan'], ['agama-konghucu', 'Pendidikan Agama Konghucu', 'keagamaan'], ['kepercayaan', 'Kepercayaan terhadap Tuhan YME', 'keagamaan'],
  ['ppkn', 'Pendidikan Pancasila dan Kewarganegaraan', 'sosial'], ['bahasa-indonesia', 'Bahasa Indonesia', 'bahasa'], ['bahasa-inggris', 'Bahasa Inggris', 'bahasa'], ['bahasa-arab', 'Bahasa Arab', 'bahasa'], ['bahasa-jepang', 'Bahasa Jepang', 'bahasa'], ['bahasa-mandarin', 'Bahasa Mandarin', 'bahasa'], ['bahasa-korea', 'Bahasa Korea', 'bahasa'], ['bahasa-jerman', 'Bahasa Jerman', 'bahasa'], ['bahasa-perancis', 'Bahasa Prancis', 'bahasa'], ['bahasa-daerah', 'Bahasa Daerah', 'bahasa'], ['sastra', 'Sastra', 'bahasa'],
  ['matematika', 'Matematika', 'sains'], ['ipa', 'Ilmu Pengetahuan Alam', 'sains'], ['fisika', 'Fisika', 'sains'], ['kimia', 'Kimia', 'sains'], ['biologi', 'Biologi', 'sains'], ['astronomi', 'Astronomi', 'sains'], ['geologi', 'Geologi', 'sains'], ['statistika', 'Statistika', 'sains'], ['ilmu-komputer', 'Ilmu Komputer', 'teknologi'], ['informatika', 'Informatika', 'teknologi'], ['pemrograman', 'Pemrograman', 'teknologi'], ['robotika', 'Robotika', 'teknologi'], ['kecerdasan-buatan', 'Kecerdasan Buatan', 'teknologi'], ['desain-ui-ux', 'Desain UI/UX', 'teknologi'],
  ['ips', 'Ilmu Pengetahuan Sosial', 'sosial'], ['sejarah', 'Sejarah', 'sosial'], ['geografi', 'Geografi', 'sosial'], ['ekonomi', 'Ekonomi', 'sosial'], ['sosiologi', 'Sosiologi', 'sosial'], ['antropologi', 'Antropologi', 'sosial'], ['akuntansi', 'Akuntansi', 'vokasi'], ['manajemen', 'Manajemen', 'vokasi'], ['bisnis-digital', 'Bisnis Digital', 'vokasi'], ['kewirausahaan', 'Kewirausahaan', 'vokasi'], ['hukum', 'Hukum', 'sosial'], ['psikologi', 'Psikologi', 'sosial'], ['filsafat', 'Filsafat', 'sosial'],
  ['seni-budaya', 'Seni Budaya', 'seni'], ['seni-musik', 'Seni Musik', 'seni'], ['seni-rupa', 'Seni Rupa', 'seni'], ['seni-tari', 'Seni Tari', 'seni'], ['teater', 'Teater', 'seni'], ['fotografi', 'Fotografi', 'seni'], ['desain-komunikasi-visual', 'Desain Komunikasi Visual', 'seni'], ['prakarya', 'Prakarya', 'vokasi'], ['pjok', 'Pendidikan Jasmani, Olahraga, dan Kesehatan', 'olahraga'], ['kesehatan', 'Kesehatan', 'olahraga'],
  ['pendidikan-anak-usia-dini', 'Pendidikan Anak Usia Dini', 'pendidikan'], ['bimbingan-konseling', 'Bimbingan dan Konseling', 'pendidikan'], ['pendidikan-khusus', 'Pendidikan Khusus', 'pendidikan'], ['keperawatan', 'Keperawatan', 'vokasi'], ['farmasi', 'Farmasi', 'vokasi'], ['kedokteran', 'Kedokteran', 'vokasi'], ['teknik-mesin', 'Teknik Mesin', 'vokasi'], ['teknik-elektro', 'Teknik Elektro', 'vokasi'], ['teknik-sipil', 'Teknik Sipil', 'vokasi'], ['arsitektur', 'Arsitektur', 'vokasi'], ['agribisnis', 'Agribisnis', 'vokasi'], ['perhotelan', 'Perhotelan', 'vokasi'], ['kuliner', 'Kuliner', 'vokasi'], ['pariwisata', 'Pariwisata', 'vokasi'], ['maritim', 'Kemaritiman', 'vokasi'], ['lingkungan-hidup', 'Lingkungan Hidup', 'lintas-disiplin'], ['literasi-keuangan', 'Literasi Keuangan', 'lintas-disiplin'], ['literasi-digital', 'Literasi Digital', 'lintas-disiplin'], ['pengetahuan-umum', 'Pengetahuan Umum', 'umum'],
].map(([id, label, group]) => Object.freeze({ id, label, group })));

export const quizLevelById = (id) => QUIZ_LEVELS.find((level) => level.id === id);
export const quizSubjectById = (id) => QUIZ_SUBJECTS.find((subject) => subject.id === id);
