export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const error = new Error('GEOLOCATION_UNAVAILABLE');
      error.name = 'GeolocationError';
      error.code = 'GEOLOCATION_UNAVAILABLE';
      reject(error);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null,
      }),
      (error) => {
        const wrapped = new Error(error?.message || 'Lokasi tidak dapat dibaca.');
        wrapped.name = 'GeolocationError';
        wrapped.code = error?.code;
        reject(wrapped);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  });
}

export function geolocationErrorMessage(error) {
  if (error?.message === 'GEOLOCATION_UNAVAILABLE') return 'Perangkat atau browser ini tidak menyediakan lokasi.';
  if (error?.code === 1) return 'Izin lokasi ditolak. Aktifkan izin lokasi browser lalu coba lagi.';
  if (error?.code === 2) return 'Lokasi belum dapat ditentukan. Pastikan GPS atau layanan lokasi aktif.';
  if (error?.code === 3) return 'Permintaan lokasi terlalu lama. Coba lagi di area dengan sinyal lokasi lebih baik.';
  return 'Lokasi belum dapat dibaca. Coba lagi.';
}
