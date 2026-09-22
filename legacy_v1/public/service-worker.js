// --- KONFIGURASI VERSI ---
// Ganti versi ini SETIAP KALI update kodingan (samakan dengan APP_VERSION di index.html)
const APP_VERSION = 'v5.6.8'; 

const CACHE_NAME = `quizzy-cache-${APP_VERSION}`;
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
  // Tambahkan file statis lain jika ada (misal: './icons/icon-192.png')
];

// 1. INSTALL: Caching Aset Awal & Paksa Aktif
self.addEventListener('install', (event) => {
  // skipWaiting() memaksa SW baru untuk langsung aktif menggantikan yang lama
  // tanpa menunggu tab ditutup. Penting untuk update instan!
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching assets:', ASSETS_TO_CACHE);
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE: Bersih-bersih Cache Lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Hapus cache yang namanya BEDA dengan versi sekarang
          // Ini mencegah HP user penuh dengan sampah versi jadul
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // clients.claim() membuat SW langsung mengontrol semua halaman yang terbuka
  self.clients.claim();
});

// 3. FETCH: Strategi "Network First" (Prioritas Online)
self.addEventListener('fetch', (event) => {
  // Hanya handle request GET dan pastikan protokolnya http/https
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Jika berhasil ambil dari internet:
        // 1. Cek apakah respon valid
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // 2. Simpan copy terbaru ke cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return response;
      })
      .catch(() => {
        // Jika internet mati (Offline):
        // Ambil dari cache yang tersimpan
        return caches.match(event.request);
      })
  );
});