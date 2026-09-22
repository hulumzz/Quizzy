import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMaterialInput, validateProgress } from '../src/validation/material.js';

test('material validation accepts the initial structured block model', () => {
  const value = validateMaterialInput({
    title: '  Pengenalan   Biologi ',
    summary: 'Materi awal',
    status: 'published',
    blocks: [
      { id: 'heading-1', type: 'heading', level: 2, content: 'Makhluk hidup' },
      { id: 'list-1', type: 'bullet_list', items: ['Sel', 'Jaringan'] },
      { id: 'video-1', type: 'youtube', url: 'https://www.youtube.com/watch?v=abc123', label: 'Video pendamping' },
      { id: 'divider-1', type: 'divider' },
    ],
  });
  assert.equal(value.title, 'Pengenalan Biologi');
  assert.equal(value.blocks.length, 4);
});

test('material validation rejects unsupported blocks and unsafe URLs', () => {
  assert.throws(() => validateMaterialInput({
    title: 'Materi valid',
    blocks: [{ id: 'file-1', type: 'file', url: 'javascript:alert(1)' }],
  }), (error) => error.code === 'VALIDATION_ERROR' && Boolean(error.details['blocks.0.url']));
});

test('progress validation only accepts whole percentages from zero to one hundred', () => {
  assert.deepEqual(validateProgress({ percent: 100 }), { percent: 100 });
  assert.throws(() => validateProgress({ percent: 101 }), (error) => error.code === 'VALIDATION_ERROR');
});
