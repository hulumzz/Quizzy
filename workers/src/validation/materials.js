import { badRequest, HttpError } from '../http/errors.js';

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'bullet_list', 'numbered_list', 'quote', 'image', 'file', 'link', 'youtube', 'divider']);
const URL_BLOCK_TYPES = new Set(['image', 'file', 'link', 'youtube']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const FILE_TYPES = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']);

const cleanText = (value) => typeof value === 'string' ? value.trim() : '';
const httpsUrl = (value) => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
const youtubeUrl = (value) => { try { return /(^|\.)(youtube\.com|youtu\.be)$/.test(new URL(value).hostname); } catch { return false; } };

function validateBlock(block, index, errors) {
  const key = `blocks.${index}`;
  if (!block || typeof block !== 'object' || Array.isArray(block)) { errors[key] = 'Blok materi tidak valid.'; return null; }
  const type = cleanText(block.type); const id = cleanText(block.id);
  if (!BLOCK_TYPES.has(type)) errors[`${key}.type`] = 'Jenis blok tidak didukung.';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) errors[`${key}.id`] = 'Identitas blok tidak valid.';
  if (type === 'divider') return { id, type };
  if (type === 'bullet_list' || type === 'numbered_list') {
    const items = Array.isArray(block.items) ? block.items.map(cleanText).filter(Boolean) : [];
    if (!items.length || items.length > 50 || items.some((item) => item.length > 500)) errors[`${key}.items`] = 'Daftar harus berisi 1–50 item, masing-masing maksimal 500 karakter.';
    return { id, type, items };
  }
  if (URL_BLOCK_TYPES.has(type)) {
    const url = cleanText(block.url); const label = cleanText(block.label);
    if (!httpsUrl(url) || url.length > 2048 || (type === 'youtube' && !youtubeUrl(url))) errors[`${key}.url`] = type === 'youtube' ? 'Gunakan tautan YouTube HTTPS yang valid.' : 'Gunakan URL HTTPS yang valid.';
    if (label.length > 160) errors[`${key}.label`] = 'Label maksimal 160 karakter.';
    return { id, type, url, label };
  }
  const content = cleanText(block.content);
  if (!content || content.length > 5000) errors[`${key}.content`] = 'Isi blok wajib diisi dan maksimal 5.000 karakter.';
  if (type === 'heading') {
    const level = Number(block.level);
    if (![2, 3].includes(level)) errors[`${key}.level`] = 'Level judul harus 2 atau 3.';
    return { id, type, level, content };
  }
  return { id, type, content };
}

export function validateMaterialInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Data materi tidak valid.');
  const title = cleanText(input.title).replace(/\s+/g, ' '); const summary = cleanText(input.summary); const status = cleanText(input.status) || 'draft';
  const rawBlocks = Array.isArray(input.blocks) ? input.blocks : []; const errors = {};
  if (title.length < 3 || title.length > 120) errors.title = 'Judul materi harus terdiri dari 3–120 karakter.';
  if (summary.length > 400) errors.summary = 'Ringkasan maksimal 400 karakter.';
  if (!['draft', 'published'].includes(status)) errors.status = 'Status materi tidak valid.';
  if (rawBlocks.length > 60) errors.blocks = 'Materi maksimal memiliki 60 blok.';
  const blocks = rawBlocks.slice(0, 60).map((block, index) => validateBlock(block, index, errors)).filter(Boolean);
  if (blocks.reduce((size, block) => size + JSON.stringify(block).length, 0) > 70000) errors.blocks = 'Isi materi terlalu besar.';
  if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR', 'Periksa kembali materi.', errors);
  return { title, summary, status, blocks, sessionId: input.sessionId ? validateSessionId(input.sessionId) : null };
}

export function validateMaterialId(value) { if (typeof value !== 'string' || value.length > 64 || !/^[a-zA-Z0-9-]+$/.test(value)) throw badRequest('INVALID_MATERIAL_ID', 'Identitas materi tidak valid.'); return value; }
export function validateSessionId(value) { if (typeof value !== 'string' || value.length > 64 || !/^[a-zA-Z0-9-]+$/.test(value)) throw badRequest('INVALID_LEARNING_SESSION_ID', 'Identitas sesi belajar tidak valid.'); return value; }
export function validateProgress(input) { const percent = Number(input?.percent); if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw badRequest('VALIDATION_ERROR', 'Periksa kembali progres belajar.', { percent: 'Progres harus berupa angka bulat 0–100.' }); return { percent }; }
export function validateUploadIntent(input) {
  const fileName = cleanText(input?.fileName); const mimeType = cleanText(input?.mimeType).toLowerCase(); const size = Number(input?.size); const image = IMAGE_TYPES.has(mimeType); const pdf = mimeType === 'application/pdf';
  if (!fileName || fileName.length > 180 || /[\\/]/.test(fileName) || fileName.includes('\u0000')) throw badRequest('VALIDATION_ERROR', 'Nama file tidak valid.', { fileName: 'Nama file maksimal 180 karakter dan tidak boleh berisi path.' });
  if (!image && !FILE_TYPES.has(mimeType)) throw badRequest('UNSUPPORTED_FILE_TYPE', 'Jenis file belum didukung.');
  const max = image ? 8 * 1024 * 1024 : 15 * 1024 * 1024;
  if (!Number.isInteger(size) || size < 1 || size > max) throw new HttpError(413, 'FILE_TOO_LARGE', image ? 'Ukuran gambar maksimal 8 MB.' : 'Ukuran file maksimal 15 MB.');
  return { fileName, mimeType, size, resourceType: image || pdf ? 'image' : 'raw' };
}
