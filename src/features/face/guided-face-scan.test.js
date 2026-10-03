import assert from 'node:assert/strict';
import test from 'node:test';
import { FaceEngineError, FACE_MODEL_VERSION, enrollmentGuidance } from './face-engine.js';
import { ENROLLMENT_STEPS, scanGuidedFace, verificationSteps } from './guided-face-scan.js';
import { createFaceChallenge } from './face-challenge.js';

const embedding = [1, 0, 0];
const face = (yaw, data = embedding) => ({ embedding: data, yaw, pitch: 0, confidence: .9, box: [.35, .25, .3, .42] });
function simulation(read) {
  let time = 0;
  let progress = { current: 0 };
  const events = [];
  return {
    events,
    options: { now: () => time, wait: async () => { time += 200; }, inspect: async () => read(progress, time), onProgress: (next) => { progress = next; events.push(next); } },
  };
}

test('enrollment advances automatically after stable front/right/left/front and saves only front samples', async () => {
  const sim = simulation(({ current }) => ({ ready: true, face: face([0, 15, -15, 0][current], current === 1 || current === 2 ? [.8, .3, 0] : embedding) }));
  const result = await scanGuidedFace(null, sim.options);
  assert.deepEqual(result, { embedding, modelVersion: FACE_MODEL_VERSION });
  assert.deepEqual([...new Set(sim.events.filter((event) => event.step).map((event) => event.step.id))], ['front', 'right', 'left', 'finish']);
  assert.equal(sim.events.at(-1).stage, 'complete');
  assert.ok(sim.events.filter((event) => event.hold === 1).length >= 4);
});

test('movement quality allows a turn but still rejects darkness, pitch and off-centre faces', () => {
  const turned = face(20);
  assert.equal(enrollmentGuidance(turned, 130).ready, false);
  assert.equal(enrollmentGuidance(turned, 130, { allowTurn: true }).ready, true);
  assert.equal(enrollmentGuidance(turned, 20, { allowTurn: true }).ready, false);
  assert.equal(enrollmentGuidance({ ...turned, pitch: 20 }, 130, { allowTurn: true }).ready, false);
  assert.equal(enrollmentGuidance({ ...turned, box: [.05, .25, .3, .42] }, 130, { allowTurn: true }).ready, false);
});

test('lost face resets hold; a fleeting pose does not finish a step', async () => {
  const sim = simulation((_, time) => {
    if (time === 600) throw new FaceEngineError('FACE_NOT_FOUND', 'Wajah belum terlihat.');
    return { ready: true, face: face(0) };
  });
  await scanGuidedFace(null, { ...sim.options, steps: [ENROLLMENT_STEPS[0]] });
  const reset = sim.events.findIndex((event) => event.guidance?.instruction === 'Wajah belum terlihat.');
  assert.ok(reset > 0);
  assert.equal(sim.events[reset].hold, 0);
  assert.equal(sim.events[reset + 1].hold, 0);
});

test('wrong direction, low quality and a different face time out without completing', async () => {
  for (const inspected of [{ ready: true, face: face(-15) }, { ready: false, face: face(15) }, { ready: true, face: face(15, [0, 1, 0]) }]) {
    const sim = simulation(() => inspected);
    await assert.rejects(scanGuidedFace(null, { ...sim.options, steps: [ENROLLMENT_STEPS[1]], profile: { modelVersion: FACE_MODEL_VERSION, embedding } }), { code: 'FACE_SCAN_TIMEOUT' });
    assert.equal(sim.events.some((event) => event.stage === 'complete'), false);
  }
});

test('verification requires the random challenge between two matching front poses', async () => {
  for (const random of [0, .99]) {
    const steps = verificationSteps(createFaceChallenge(() => random));
    const sim = simulation(({ current }) => ({ ready: true, face: face(current === 1 ? (random ? 15 : -15) : 0) }));
    const result = await scanGuidedFace(null, { ...sim.options, steps, profile: { modelVersion: FACE_MODEL_VERSION, embedding } });
    assert.equal(result.matched, true);
    assert.equal(result.challengeComplete, true);
    assert.equal(result.similarity, 1);
  }
});

test('abort while detection is pending suppresses completion and further progress', async () => {
  const controller = new AbortController();
  let release;
  const events = [];
  const pending = scanGuidedFace(null, { signal: controller.signal, onProgress: (event) => events.push(event), inspect: () => new Promise((resolve) => { release = resolve; }) });
  controller.abort();
  release({ ready: true, face: face(0) });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(events.length, 1);
});

test('incompatible profile is rejected before starting the detector', async () => {
  await assert.rejects(scanGuidedFace(null, { profile: { modelVersion: 'old-model', embedding }, inspect: () => assert.fail('should not run') }), { code: 'FACE_MODEL_MISMATCH' });
});
