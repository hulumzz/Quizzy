function renamed(name, mimeType) {
  const base = name.replace(/\.[^.]+$/, '') || 'gambar';
  const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg';
  return `${base}-optimized.${extension}`;
}

export async function optimizeImageForUpload(file) {
  if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 700 * 1024) return file;
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = source;
    });
    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 2560 / longestSide);
    if (scale === 1 && file.type === 'image/png') return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { alpha: file.type === 'image/png' });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const outputType = file.type === 'image/png' ? 'image/png' : file.type;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, outputType, 0.92));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], renamed(file.name, outputType), { type: outputType, lastModified: file.lastModified });
  } catch { return file; } finally { URL.revokeObjectURL(source); }
}
