import { badRequest } from '../http/errors.js';

const TYPES = new Set(['multiple_choice', 'true_false', 'short_answer']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
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
    if (type === 'short_answer' && ((status === 'published' && !correctAnswer) || correctAnswer.length > 300)) errors[`${prefix}.correctAnswer`] = 'Jawaban benar wajib diisi dan maksimal 300 karakter.';
    return { id, type, prompt, choices, correctAnswer, explanation, points };
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
  return { answers: input.answers.map((answer) => ({ questionId: text(answer?.questionId), answer: typeof answer?.answer === 'boolean' ? answer.answer : text(answer?.answer) })) };
}
