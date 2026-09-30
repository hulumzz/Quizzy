import assert from 'node:assert/strict';
import test from 'node:test';
import { FaceProfileRepository } from '../src/repositories/face-profile-repository.js';

test('face profile persists only a bounded profile record under its owner key', async () => {
  const commands = [];
  const repository = new FaceProfileRepository({ tableName: 'QuizzyTest', documentClient: { async send(command) { commands.push(command); return commands.length === 1 ? {} : {}; } } });
  const profile = await repository.save({ uid: 'student-1', embedding: [0.1, 0.2], modelVersion: 'human-v1', now: '2026-09-29T00:00:00.000Z' });
  const item = commands[1].input.Item;
  assert.equal(item.PK, 'USER#student-1');
  assert.equal(item.SK, 'FACE_PROFILE');
  assert.equal(item.entityType, 'FACE_PROFILE');
  assert.equal(item.rawImage, undefined);
  assert.deepEqual(profile.embedding, [0.1, 0.2]);
});
