import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

// Local component smoke with synthetic data, camera video and detector results.
// No authentication, production API, face model download or real biometric data.
const root = path.resolve(import.meta.dirname, '../..');
const artifacts = path.join(root, 'workers/.wrangler/ux-artifacts');
await mkdir(artifacts, { recursive: true });
const { chromium } = createRequire(path.join(process.env.NALARO_BROWSER_TOOLS || path.join(os.tmpdir(), 'nalaro-release-tools'), 'package.json'))('playwright');
const base = process.env.NALARO_UX_LOCAL_URL || 'http://127.0.0.1:5173';
const classroom = { id: 'demo', name: 'Bahasa Indonesia 12IPS1', teacherName: 'Pengajar contoh dengan nama yang panjang', studentsCount: 28, status: 'active', code: 'DEMO123', description: '' };
const longText = 'Buat sebuah karya ilmiah sederhana. Tuliskan judul, tujuan, pembahasan, dan kesimpulan. Gunakan contoh yang dekat dengan kehidupan sehari-hari. '.repeat(8);
const quiz = { id: 'quiz-demo', title: 'Gramatika Bahasa Indonesia dan penggunaan kata dalam kehidupan sehari-hari', description: longText, status: 'published', questionCount: 6, totalPoints: 7, settings: { passingScore: 70 }, level: 'sma', subjectId: 'bahasa', tags: ['gramatika', 'kelas-12'] };
const material = { id: 'material-demo', classId: 'demo', title: quiz.title, summary: longText, status: 'published', blocksCount: 7, progress: { percent: 25 }, updatedAt: '2026-10-03T01:00:00Z' };
const fixtureData = { class: classroom, classes: [classroom], members: [], quizzes: [quiz], materials: [material, { ...material, id: 'material-2', title: 'Menulis Artikel' }], tasks: [{ id: 'task-demo', title: 'Membuat karya ilmiah sederhana', instructions: longText, status: 'published', dueAt: '2026-10-05T01:00:00Z', responseMode: 'both' }], sessions: [{ id: 'session-demo', title: 'Tata bahasa Indonesia', description: longText.slice(0, 150), status: 'published', meetingDate: '2026-10-03' }], attendance: [], levels: [{ id: 'sma', label: 'SMA' }], subjects: [{ id: 'bahasa', label: 'Bahasa Indonesia' }] };
async function writeFixture(name, contents) {
  const filename = path.join(artifacts, name);
  if (await readFile(filename, 'utf8').catch(() => null) !== contents) await writeFile(filename, contents);
}
await writeFixture('preview.html', '<!doctype html><html lang="id"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="./preview.jsx"></script></html>');
await writeFixture('preview.jsx', `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '/src/index.css';
import TeacherQuizzes from '/src/pages/teacher/TeacherQuizzes.jsx';
import TeacherGeneralQuizzes from '/src/pages/teacher/TeacherGeneralQuizzes.jsx';
import QuizBank from '/src/pages/teacher/QuizBank.jsx';
import ClassOverview from '/src/pages/ClassOverview.jsx';
import ClassDiscussions from '/src/pages/ClassDiscussions.jsx';
import ClassQuizzes from '/src/pages/ClassQuizzes.jsx';
import ClassTasks from '/src/pages/ClassTasks.jsx';
import ClassMaterials from '/src/pages/ClassMaterials.jsx';
import ClassSessions from '/src/pages/ClassSessions.jsx';
import FaceProfile from '/src/pages/student/FaceProfile.jsx';
import FaceCheckInDialog from '/src/features/face/FaceCheckInDialog.jsx';
const page = new URLSearchParams(location.search).get('page') || 'hub';
const role = new URLSearchParams(location.search).get('role') || 'student';
const pages = {hub: <TeacherQuizzes />, general: <TeacherGeneralQuizzes />, bank: <QuizBank />, overview: <ClassOverview role={role} />, discussions: <ClassDiscussions role={role} />, quizzes: <ClassQuizzes role={role} />, tasks: <ClassTasks role={role} />, materials: <ClassMaterials role={role} />, sessions: <ClassSessions role={role} />, face: <FaceProfile />};
function CheckIn() { const [open, setOpen] = useState(true); return <><p>Presensi kelas contoh</p><FaceCheckInDialog open={open} onClose={() => setOpen(false)} profile={{embedding:[1,0,0],modelVersion:'human-v1'}} required={role === 'required'} onVerified={async () => { window.__verified = (window.__verified || 0) + 1; if (window.__mode === 'submit-error') return false; setOpen(false); return true; }} /></>; }
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/' + role + '/classes/demo/' + page]}><div className="qz-app-shell"><aside className="qz-sidebar"><b>Nalaro Class</b></aside><main className="qz-main"><header className="qz-header"><b>Ruang kelas</b></header><div className="qz-content"><Routes><Route path="/:role/classes/:classId/:page" element={page === 'checkin' ? <CheckIn /> : pages[page]} /></Routes></div></main></div></MemoryRouter>);
`);
const browser = await chromium.launch({ headless: true, executablePath: process.env.NALARO_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const runtimeErrors = [];
const context = await browser.newContext({ reducedMotion: 'reduce' });
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.origin !== new URL(base).origin) return route.abort();
  if (url.pathname === '/src/services/api.js') return route.fulfill({ contentType: 'application/javascript', body: `const data=${JSON.stringify(fixtureData)}; export async function apiRequest() { return data; } export const publicApiRequest=apiRequest, optionalAuthApiRequest=apiRequest; export async function apiDownload(){ return {blob:new Blob(['demo'])}; }` });
  if (url.pathname === '/src/config/env.js') return route.fulfill({ contentType: 'application/javascript', body: `export const appEnv={apiUrl:'/fixture',firebase:{}}; export const hasFirebaseConfig=false;` });
  if (url.pathname === '/src/context/useAuth.js') return route.fulfill({ contentType: 'application/javascript', body: `export const useAuth=()=>({user:{uid:'synthetic-user'},profile:{role:'student'}});` });
  if (url.pathname === '/src/services/face.service.js') return route.fulfill({ contentType: 'application/javascript', body: `export async function getFaceProfile(){return null;} export async function saveFaceProfile(uid,profile){ window.__saveCalls=(window.__saveCalls||0)+1; if(window.__mode==='save-error') throw new Error('Penyimpanan contoh gagal. Coba lagi.'); return {...profile,enrolledAt:new Date().toISOString()}; } export async function deleteFaceProfile(){} export const faceProfileErrorMessage=e=>e.message;` });
  if (url.pathname === '/src/features/face/face-engine.js' && !url.searchParams.has('real')) return route.fulfill({ contentType: 'application/javascript', body: `
    export * from '/src/features/face/face-engine.js?real';
    import {startFaceCamera as startReal} from '/src/features/face/face-engine.js?real';
    export async function warmFaceEngine(){await new Promise(r=>setTimeout(r,80));}
    export async function startFaceCamera(video,options){const stream=await startReal(video,options); (window.__streams ||= []).push(stream); return stream;}
    export async function inspectEnrollmentFace(){ await new Promise(r=>setTimeout(r,60)); if(window.__mode==='detect-error') throw new Error('Pemindai contoh gagal. Coba lagi.'); if(window.__mode==='pause-scan') return {ready:false,instruction:'Hadapkan wajah lurus ke kamera.'}; const step=document.querySelector('[aria-current="step"]')?.textContent || ''; return {ready:true,face:{embedding:window.__mode==='wrong-face'?[0,1,0]:[1,0,0],yaw:step.includes('Kanan')?15:step.includes('Kiri')?-15:0}}; }
  ` });
  return route.continue();
});
const page = await context.newPage();
page.on('pageerror', (error) => runtimeErrors.push(error.message));
await page.addInitScript(() => {
  const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (options) => {
    if (window.__mode === 'denied') throw new DOMException('Denied', 'NotAllowedError');
    if (window.__mode === 'late-camera') await new Promise((resolve) => setTimeout(resolve, 1200));
    const stream = await getUserMedia(options);
    (window.__allStreams ||= []).push(stream);
    return stream;
  };
});
const goto = async (name, role = 'student') => {
  await page.goto(`${base}/workers/.wrangler/ux-artifacts/preview.html?page=${name}&role=${role}`);
  await page.locator('.qz-dashboard, .qz-dialog').first().waitFor();
  await page.locator('.qz-skeleton').first().waitFor({ state: 'hidden' });
  await page.evaluate(() => document.fonts.ready);
};
const assertLayout = async (name) => {
  const metrics = await page.evaluate(() => {
    const bounds = (node) => node.getBoundingClientRect();
    const cards = [...document.querySelectorAll('.qz-content-card, .qz-class-summary-card, .qz-material-card')];
    const overlaps = [...document.querySelectorAll('.qz-content-card')].flatMap((card) => {
      const parts = [...card.querySelector('.qz-card__body').children].map(bounds).filter((box) => box.height);
      return parts.slice(1).filter((box, index) => box.top < parts[index].bottom - 1).map(() => 'overlap');
    });
    const bad = cards.flatMap((card) => {
      const box = bounds(card);
      return [...card.querySelectorAll('h2,h3,p,.qz-card-icon,.qz-badge,.qz-content-card__meta,.qz-content-card__actions')].filter((child) => { const b=bounds(child); return b.width && (b.left<box.left-1 || b.right>box.right+1); }).map((child) => child.className || child.tagName);
    });
    return { overflow:document.documentElement.scrollWidth-innerWidth, bad, overlaps };
  });
  assert.ok(metrics.overflow <= 1, `${name}: horizontal page overflow ${metrics.overflow}`);
  assert.deepEqual(metrics.bad, [], `${name}: content outside card`);
  assert.deepEqual(metrics.overlaps, [], `${name}: card sections overlap`);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
};
try {
  const widths = process.env.NALARO_UX_WIDTHS?.split(',').map(Number) || [320, 390, 768, 1440];
  const pages = process.env.NALARO_UX_PAGES?.split(',') || ['hub', 'general', 'bank', 'overview', 'discussions', 'quizzes', 'tasks', 'materials', 'sessions', 'face'];
  const role = process.env.NALARO_UX_ROLE || 'student';
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 320 ? 640 : 900 });
    for (const name of pages) {
      await goto(name, role);
      await assertLayout(`${name}-${width}`);
      const activeTab = page.locator('.qz-class-nav a.active');
      if (await activeTab.count()) {
        const tab = await activeTab.boundingBox();
        const nav = await page.locator('.qz-class-nav').boundingBox();
        assert.ok(tab.x >= nav.x - 1 && tab.x + tab.width <= nav.x + nav.width + 1, `${name}: active class tab is clipped`);
      }
      if (name === 'overview') assert.equal(await page.locator('.qz-class-summary-card').count(), 1);
      if (['hub', 'general', 'bank', 'discussions', 'quizzes', 'tasks'].includes(name)) assert.ok(await page.locator('.qz-content-card').count() > 0, `${name}: fixture card missing`);
    }
    console.log(`Synthetic browser layout ${width}px (${role}): ${pages.length} pages PASS`);
  }
  if (process.env.NALARO_UX_LAYOUT_ONLY !== '1') {
  await page.setViewportSize({ width: 390, height: 844 });
  await goto('face');
  assert.equal(await page.getByRole('button', { name: 'Rekam wajah', exact: true }).isDisabled(), true);
  assert.equal(await page.locator('video').count(), 0);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Rekam wajah', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByText('Hadapkan wajah lurus ke kamera.', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifacts, 'face-scanning-mobile.png') });
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 15000 });
  await page.getByText('Profil wajah aktif', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__saveCalls), 1);
  assert.equal(await page.getByRole('button', { name: 'Rekam ulang wajah' }).isEnabled(), true);
  assert.equal(await page.evaluate(() => window.__allStreams.every((stream) => stream.getTracks().every((track) => track.readyState === 'ended'))), true);
  console.log('Consent -> one click -> automatic guided save + camera cleanup: PASS');
  for (const mode of ['denied', 'detect-error', 'save-error']) {
    await goto('face'); await page.evaluate((mode) => { window.__mode = mode; }, mode);
    await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Rekam wajah', exact: true }).click();
    await page.getByRole('alert').waitFor({ timeout: 15000 });
    assert.equal(await page.getByRole('button', { name: 'Coba lagi', exact: true }).isEnabled(), true);
    await page.evaluate(() => { window.__mode = ''; });
    await page.getByRole('button', { name: 'Coba lagi', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 15000 });
    console.log(`Camera/scan/save error ${mode} -> retry: PASS`);
  }
  for (const mode of ['pause-scan', 'late-camera']) {
    await goto('face'); await page.evaluate((mode) => { window.__mode = mode; }, mode);
    await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Rekam wajah', exact: true }).click();
    if (mode === 'pause-scan') await page.getByText('Hadapkan wajah lurus ke kamera.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Batal', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => window.__saveCalls || 0), 0);
    assert.equal(await page.evaluate(() => (window.__allStreams || []).every((stream) => stream.getTracks().every((track) => track.readyState === 'ended'))), true);
    assert.equal(await page.getByRole('button', { name: 'Rekam wajah', exact: true }).isEnabled(), true);
    console.log(`Cancel ${mode} -> no save, tracks stopped: PASS`);
  }
  await goto('checkin', 'required');
  assert.equal(await page.getByRole('button', { name: 'Batal', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Mulai pemindaian' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 15000 });
  assert.equal(await page.evaluate(() => window.__verified), 1);
  console.log('Face-required guided check-in auto-submits exactly once: PASS');
  await goto('checkin'); await page.evaluate(() => { window.__mode = 'submit-error'; });
  await page.getByRole('button', { name: 'Mulai pemindaian' }).click();
  await page.getByRole('alert').waitFor({ timeout: 15000 });
  await page.evaluate(() => { window.__mode = ''; });
  await page.getByRole('button', { name: 'Coba lagi' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 15000 });
  assert.equal(await page.evaluate(() => window.__verified), 2);
  console.log('Check-in submission failure -> explicit retry: PASS');
  }
  assert.deepEqual(runtimeErrors, []);
  console.log(`Browser runtime errors: 0. Artifacts: ${artifacts}`);
} finally { await browser.close(); }
