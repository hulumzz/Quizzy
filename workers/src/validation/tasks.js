import { badRequest } from '../http/errors.js';
import { validateUploadIntent } from './materials.js';
import { validateLearningSessionId } from './learning-sessions.js';
const text = (v) => typeof v === 'string' ? v.trim() : '';
const id = (v) => { if (typeof v !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(v)) throw badRequest('INVALID_TASK_ID', 'Identitas tugas tidak valid.'); return v; };
export const validateTaskId = id;
export function validateTaskInput(input) { const title = text(input?.title).replace(/\s+/g, ' '); const instructions = text(input?.instructions); const dueAt = text(input?.dueAt); const responseMode = text(input?.responseMode) || 'both'; const status = text(input?.status) || 'published'; const errors = {}; if (title.length < 3 || title.length > 160) errors.title = 'Judul tugas harus terdiri dari 3-160 karakter.'; if (instructions.length > 5000) errors.instructions = 'Petunjuk tugas maksimal 5.000 karakter.'; if (!Number.isFinite(Date.parse(dueAt)) || new Date(dueAt).toISOString() !== dueAt) errors.dueAt = 'Tenggat tugas harus berupa tanggal dan waktu ISO yang valid.'; if (!['text','attachment','both'].includes(responseMode)) errors.responseMode = 'Bentuk jawaban tidak valid.'; if (!['draft','published','archived'].includes(status)) errors.status = 'Status tugas tidak valid.'; if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR','Periksa kembali data tugas.',errors); return { title,instructions,dueAt,responseMode,status,sessionId: input?.sessionId ? validateLearningSessionId(input.sessionId) : null }; }
export function validateSubmissionInput(input) {
  const textAnswer = text(input?.textAnswer);
  const attachments = Array.isArray(input?.attachments) ? input.attachments : [];
  if (textAnswer.length > 10000 || attachments.length > 5) throw badRequest('VALIDATION_ERROR', 'Jawaban tugas tidak valid.');
  return { textAnswer, attachments: attachments.map((file) => {
    const name = text(file?.name); const url = text(file?.url); const publicId = text(file?.publicId);
    const mimeType = text(file?.mimeType).toLowerCase(); const bytes = Number(file?.bytes);
    validateUploadIntent({ fileName: name, mimeType, size: bytes });
    if (url.length > 2048 || !/^https:\/\//.test(url) || !/^[A-Za-z0-9_./-]{1,500}$/.test(publicId) || publicId.includes('/../')) throw badRequest('VALIDATION_ERROR', 'Lampiran tugas tidak valid.');
    return { name, url, publicId, mimeType, bytes };
  }) };
}
export function validateGradeInput(input) { const status = text(input?.status) || 'graded'; const score = input?.score === '' || input?.score === null || input?.score === undefined ? null : Number(input.score); const feedback = text(input?.feedback); if (!['graded','returned'].includes(status) || (status === 'graded' && (!Number.isInteger(score)||score<0||score>100)) || (score !== null && (!Number.isInteger(score)||score<0||score>100)) || feedback.length>3000) throw badRequest('VALIDATION_ERROR','Data penilaian tidak valid.'); return { status,score,feedback }; }
