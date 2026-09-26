import { badRequest } from '../http/errors.js';

const TYPES = new Set(['multiple_choice', 'true_false', 'short_answer', 'arrange', 'image_hotspot']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOrder(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function normalizeHotspots(value) {
  if (!Array.isArray(value)) return [];
  return value.map((spot, index) => ({
    id: text(spot?.id) || `area-${index + 1}`,
    label: text(spot?.label),
    x: Number(spot?.x), y: Number(spot?.y), width: Number(spot?.width), height: Number(spot?.height),
    correct: Boolean(spot?.correct),
  }));
}

function validateAnswerValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return text(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).slice(0, 12);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const x = Number(value.x); const y = Number(value.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  return '';
}

export function validateQuizId(value) {
  if (typeof value !== 'string' || value.length > 64 || !/^[A-Za-z0-9-]+$/.test(value)) {
    throw badRequest('INVALID_QUIZ_ID', 'Identitas kuis tidak valid.');
  }
  return value;
}

export function validateQuizInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Data kuis tidak valid.');
  const title = text(input.title).replace(/\s+/g, ' ');
  const description = text(input.description);
  const status = text(input.status) || 'draft';
  const rawQuestions = Array.isArray(input.questions) ? input.questions : [];
  const errors = {};
  if (title.length < 3 || title.length > 120) errors.title = 'Judul kuis harus terdiri dari 3-120 karakter.';
  if (description.length > 500) errors.description = 'Deskripsi maksimal 500 karakter.';
  if (!['draft', 'published'].includes(status)) errors.status = 'Status kuis tidak valid.';
  if (rawQuestions.length > 30) errors.questions = 'Kuis maksimal memiliki 30 soal.';

  const questionIds = new Set();
  const questions = rawQuestions.slice(0, 30).map((question, index) => {
    const prefix = `questions.${index}`;
    const type = text(question?.type);
    const prompt = text(question?.prompt);
    const explanation = text(question?.explanation);
    const points = Number(question?.points ?? 1);
    const id = text(question?.id) || `q-${index + 1}`;
    const choices = type === 'multiple_choice' && Array.isArray(question?.choices) ? question.choices.map(text) : [];
    const items = type === 'arrange' && Array.isArray(question?.items) ? question.items.map((item, itemIndex) => ({ id: text(item?.id) || `item-${itemIndex + 1}`, text: text(item?.text) })) : [];
    const correctOrder = type === 'arrange' ? normalizeOrder(question?.correctOrder) : [];
    const hotspots = type === 'image_hotspot' ? normalizeHotspots(question?.hotspots) : [];
    const imageUrl = text(question?.imageUrl);
    const tolerancePercent = type === 'image_hotspot' ? Number(question?.tolerancePercent ?? 2) : 0;
    let correctAnswer = type === 'true_false' ? Boolean(question?.correctAnswer) : text(question?.correctAnswer);
    if (!TYPES.has(type)) errors[`${prefix}.type`] = 'Jenis soal tidak didukung.';
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || questionIds.has(id)) errors[`${prefix}.id`] = 'Identitas soal harus unik dan valid.';
    questionIds.add(id);
    if ((status === 'published' && prompt.length < 3) || prompt.length > 1000) errors[`${prefix}.prompt`] = 'Pertanyaan harus terdiri dari 3-1.000 karakter.';
    if (!Number.isInteger(points) || points < 1 || points > 100) errors[`${prefix}.points`] = 'Poin harus berupa angka bulat 1-100.';
    if (explanation.length > 1000) errors[`${prefix}.explanation`] = 'Pembahasan maksimal 1.000 karakter.';
    if (type === 'multiple_choice') {
      if ((status === 'published' && (choices.filter(Boolean).length < 2 || choices.some((choice) => !choice))) || choices.length > 6 || choices.some((choice) => choice.length > 300)) errors[`${prefix}.choices`] = 'Pilihan jawaban harus berisi 2-6 pilihan, masing-masing maksimal 300 karakter.';
      if (status === 'published' && !choices.includes(correctAnswer)) errors[`${prefix}.correctAnswer`] = 'Jawaban benar harus cocok dengan salah satu pilihan.';
    }
    if (imageUrl && !/^https:\/\/.{1,2000}$/i.test(imageUrl)) errors[`${prefix}.imageUrl`] = 'Gambar soal harus menggunakan URL HTTPS yang valid.';
    if (type === 'short_answer' && ((status === 'published' && !correctAnswer) || correctAnswer.length > 300)) errors[`${prefix}.correctAnswer`] = 'Jawaban benar wajib diisi dan maksimal 300 karakter.';
    if (type === 'arrange') {
      const itemIds = items.map((item) => item.id);
      const validOrder = correctOrder.length === itemIds.length && new Set(correctOrder).size === itemIds.length && correctOrder.every((itemId) => itemIds.includes(itemId));
      const malformedItems = items.some((item) => !/^[A-Za-z0-9_-]{1,64}$/.test(item.id) || item.text.length > 300);
      const incompletePublishedArrangement = items.length < 3 || !validOrder || items.some((item) => !item.text);
      if (items.length > 10 || malformedItems || new Set(itemIds).size !== itemIds.length || (status === 'published' && incompletePublishedArrangement)) errors[`${prefix}.items`] = 'Susunan harus berisi 3-10 item unik dengan urutan jawaban yang lengkap.';
    }
    if (type === 'image_hotspot') {
      const validImage = /^https:\/\/.{1,2000}$/i.test(imageUrl);
      const validSpot = (spot) => /^[A-Za-z0-9_-]{1,64}$/.test(spot.id) && spot.label.length <= 80 && [spot.x, spot.y, spot.width, spot.height].every(Number.isFinite) && spot.x >= 0 && spot.y >= 0 && spot.width >= 2 && spot.height >= 2 && spot.x + spot.width <= 100 && spot.y + spot.height <= 100;
      if ((status === 'published' && (!validImage || hotspots.length < 1 || hotspots.filter((spot) => spot.correct).length !== 1)) || hotspots.length > 8 || hotspots.some((spot) => !validSpot(spot)) || new Set(hotspots.map((spot) => spot.id)).size !== hotspots.length) errors[`${prefix}.hotspots`] = 'Peta klik memerlukan gambar HTTPS, 1 area benar, dan blok area valid.';
      if (!Number.isFinite(tolerancePercent) || tolerancePercent < 0 || tolerancePercent > 10) errors[`${prefix}.tolerancePercent`] = 'Toleransi area harus 0-10 persen.';
    }
    return { id, type, prompt, choices, correctAnswer, items, correctOrder, imageUrl, hotspots, tolerancePercent, explanation, points };
  });
  if (status === 'published' && questions.length < 1) errors.questions = 'Tambahkan minimal satu soal sebelum menerbitkan kuis.';

  const settings = {
    shuffleQuestions: Boolean(input.settings?.shuffleQuestions),
    showCorrectAnswers: input.settings?.showCorrectAnswers !== false,
    passingScore: Number(input.settings?.passingScore ?? 70),
  };
  if (!Number.isInteger(settings.passingScore) || settings.passingScore < 0 || settings.passingScore > 100) errors['settings.passingScore'] = 'Nilai kelulusan harus berupa angka bulat 0-100.';
  if (JSON.stringify(questions).length > 120000) errors.questions = 'Isi kuis terlalu besar.';
  if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR', 'Periksa kembali kuis.', errors);
  return { title, description, status, mode: 'self_paced', questions, settings };
}

export function validateAttempt(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.answers)) throw badRequest('INVALID_BODY', 'Jawaban kuis tidak valid.');
  if (input.answers.length > 30) throw badRequest('VALIDATION_ERROR', 'Jawaban melebihi jumlah soal.');
  const answers = input.answers.map((answer) => ({ questionId: text(answer?.questionId), answer: validateAnswerValue(answer?.answer) }));
  if (answers.some((answer) => !/^[A-Za-z0-9_-]{1,64}$/.test(answer.questionId))) throw badRequest('VALIDATION_ERROR', 'Identitas soal tidak valid.');
  return { answers };
}
