import { badRequest } from '../http/errors.js';

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'bullet_list', 'numbered_list', 'quote', 'image', 'file', 'link', 'youtube', 'divider']);
const URL_BLOCK_TYPES = new Set(['image', 'file', 'link', 'youtube']);

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validYouTubeUrl(value) {
  try {
    const hostname = new URL(value).hostname;
    return /(^|\.)(youtube\.com|youtu\.be)$/.test(hostname);
  } catch {
    return false;
  }
}

function validateBlock(block, index, errors) {
  const prefix = `blocks.${index}`;
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    errors[prefix] = 'Blok materi tidak valid.';
    return null;
  }
  const type = cleanText(block.type);
  const id = cleanText(block.id);
  if (!BLOCK_TYPES.has(type)) errors[`${prefix}.type`] = 'Jenis blok tidak didukung.';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) errors[`${prefix}.id`] = 'Identitas blok tidak valid.';

  if (type === 'divider') return { id, type };
  if (type === 'bullet_list' || type === 'numbered_list') {
    const items = Array.isArray(block.items) ? block.items.map(cleanText).filter(Boolean) : [];
    if (!items.length || items.length > 50) errors[`${prefix}.items`] = 'Daftar harus berisi 1–50 item.';
    if (items.some((item) => item.length > 500)) errors[`${prefix}.items`] = 'Setiap item maksimal 500 karakter.';
    return { id, type, items };
  }
  if (URL_BLOCK_TYPES.has(type)) {
    const url = cleanText(block.url);
    const label = cleanText(block.label);
    if (!validHttpsUrl(url) || url.length > 2048) errors[`${prefix}.url`] = 'Gunakan URL HTTPS yang valid.';
    if (label.length > 160) errors[`${prefix}.label`] = 'Label maksimal 160 karakter.';
    if (type === 'youtube' && !validYouTubeUrl(url)) {
      errors[`${prefix}.url`] = 'Gunakan tautan YouTube yang valid.';
    }
    return { id, type, url, label };
  }

  const content = cleanText(block.content);
  if (!content || content.length > 5000) errors[`${prefix}.content`] = 'Isi blok wajib diisi dan maksimal 5.000 karakter.';
  if (type === 'heading') {
    const level = Number(block.level);
    if (![2, 3].includes(level)) errors[`${prefix}.level`] = 'Level judul harus 2 atau 3.';
    return { id, type, level, content };
  }
  return { id, type, content };
}

export function validateMaterialInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Data materi tidak valid.');
  const title = cleanText(input.title).replace(/\s+/g, ' ');
  const summary = cleanText(input.summary);
  const status = cleanText(input.status) || 'draft';
  const rawBlocks = Array.isArray(input.blocks) ? input.blocks : [];
  const errors = {};
  if (title.length < 3 || title.length > 120) errors.title = 'Judul materi harus terdiri dari 3–120 karakter.';
  if (summary.length > 400) errors.summary = 'Ringkasan maksimal 400 karakter.';
  if (!['draft', 'published'].includes(status)) errors.status = 'Status materi tidak valid.';
  if (rawBlocks.length > 60) errors.blocks = 'Materi maksimal memiliki 60 blok.';
  const blocks = rawBlocks.slice(0, 60).map((block, index) => validateBlock(block, index, errors)).filter(Boolean);
  const contentSize = blocks.reduce((size, block) => size + JSON.stringify(block).length, 0);
  if (contentSize > 70000) errors.blocks = 'Isi materi terlalu besar.';
  if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR', 'Periksa kembali materi.', errors);
  return { title, summary, status, blocks };
}

export function validateMaterialId(value) {
  if (typeof value !== 'string' || value.length > 64 || !/^[A-Za-z0-9-]+$/.test(value)) {
    throw badRequest('INVALID_MATERIAL_ID', 'Identitas materi tidak valid.');
  }
  return value;
}

export function validateProgress(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Data progres tidak valid.');
  const percent = Number(input.percent);
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw badRequest('VALIDATION_ERROR', 'Periksa kembali progres belajar.', { percent: 'Progres harus berupa angka bulat 0–100.' });
  }
  return { percent };
}
