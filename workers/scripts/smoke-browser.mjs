import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

// Optional release tooling; Playwright is installed separately from app dependencies.
export async function runBrowserSmoke({ teacher, student, classroom, quiz, material, call, teacherToken }) {
  const toolsDir = process.env.NALARO_BROWSER_TOOLS || path.join(os.tmpdir(), 'nalaro-release-tools');
  const { chromium } = createRequire(path.join(toolsDir, 'package.json'))('playwright');
  const base = process.env.NALARO_SMOKE_PAGES_URL || 'https://nalaroclass.pages.dev';
  const insightsOnly = process.env.NALARO_SMOKE_BROWSER_MODE === 'insights';
  const artifacts = path.resolve('workers/.wrangler/release-artifacts');
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.NALARO_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const runtimeErrors = [];
  const uploads = [];
  let currentPage;
  let failed = false;
  const newPage = async (viewport = { width: 1440, height: 900 }) => {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on('pageerror', (error) => runtimeErrors.push(error.name));
    return page;
  };
  const visible = async (page, text) => page.getByText(text, { exact: true }).first().waitFor({ state: 'visible' });
  const goto = async (page, route) => {
    currentPage = page;
    const response = await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200, `Pages route ${route}: HTTP ${response.status()}`);
  };
  const cleanPage = async (page) => {
    await page.locator('.qz-page-loader').waitFor({ state: 'hidden' }).catch(() => {});
    assert.equal(await page.getByRole('alert').count(), 0, 'Unexpected UI error banner');
  };
  const login = async (page, account, role) => {
    await goto(page, '/login');
    const name = role === 'teacher' ? 'Guru' : 'Siswa';
    await page.getByRole('group', { name: 'Pilih peran akun' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.getByLabel('Email', { exact: true }).fill(account.email);
    await page.getByLabel('Kata sandi', { exact: true }).fill(account.smokePassword);
    await page.getByRole('button', { name: `Masuk sebagai ${name}`, exact: true }).click();
    await page.waitForURL(`**/${role}/home`);
    await page.locator('.qz-dashboard').waitFor();
    await cleanPage(page);
    console.log(`Browser ${role} login: PASS`);
  };
  const screenshot = async (page, name) => {
    await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
  };
  try {
    const host = await newPage();
    const pupil = await newPage({ width: 390, height: 844 });
    await goto(pupil, '/');
    await pupil.getByRole('link').first().waitFor();
    await screenshot(pupil, 'landing-mobile');
    await login(host, teacher, 'teacher');
    await login(pupil, student, 'student');
    await screenshot(host, 'teacher-desktop');
    await screenshot(pupil, 'student-mobile');
    await goto(host, '/teacher/classes');
    await host.getByRole('button', { name: 'Buat kelas', exact: true }).click();
    await host.getByRole('dialog').getByLabel('Nama kelas', { exact: true }).fill('Kelas browser release');
    const [classResponse] = await Promise.all([
      host.waitForResponse((response) => response.url().endsWith('/classes') && response.request().method() === 'POST'),
      host.getByRole('dialog').getByRole('button', { name: 'Buat kelas', exact: true }).click(),
    ]);
    assert.equal(classResponse.status(), 201);
    const browserClass = (await classResponse.json()).data.class;
    await goto(pupil, '/student/classes');
    await pupil.getByRole('button', { name: 'Gabung kelas', exact: true }).click();
    await pupil.getByRole('dialog').getByLabel('Kode kelas', { exact: true }).fill(browserClass.code);
    await pupil.getByRole('dialog').getByRole('button', { name: 'Gabung kelas', exact: true }).click();
    await pupil.getByRole('dialog').waitFor({ state: 'hidden' });
    await visible(pupil, 'Kelas browser release');
    await goto(pupil, `/student/classes/${browserClass.id}/analytics`);
    await visible(pupil, 'Belum cukup data');
    console.log('Browser teacher create class + student join + empty Insights: PASS');
    const classRoute = (role, suffix) => `/${role}/classes/${classroom.id}/${suffix}`;
    for (const role of ['teacher', 'student']) {
      const page = role === 'teacher' ? host : pupil;
      for (const suffix of insightsOnly ? ['analytics'] : ['overview', 'sessions', 'materials', 'attendance', 'quizzes', 'tasks', 'analytics']) {
        await goto(page, classRoute(role, suffix));
        await page.locator('h1').first().waitFor();
        await page.locator('.qz-skeleton').first().waitFor({ state: 'hidden' }).catch(() => {});
        await cleanPage(page);
        assert.ok(!page.url().includes('/login'), 'Authenticated route redirected to login');
      }
      const metric = page.locator('.qz-insight-metric').first();
      await metric.locator('strong').waitFor();
      const labelBox = await metric.locator('.qz-insight-metric__icon + div > span').boundingBox();
      const numberBox = await metric.locator('strong').boundingBox();
      assert.ok(numberBox.y >= labelBox.y + labelBox.height - 1, 'Insights metric label and value overlap');
      const cardBox = await metric.boundingBox();
      const iconBox = await metric.locator('.qz-insight-metric__icon').boundingBox();
      assert.ok(iconBox.x - cardBox.x >= 12, 'Insights card content lacks padding');
      await screenshot(page, `${role}-insights`);
      console.log(`Browser ${role} class modules + Insights: PASS`);
    }
    if (insightsOnly) {
      assert.equal(runtimeErrors.length, 0);
      console.log('Targeted production Insights desktop/mobile layout: PASS');
      return;
    }
    await goto(pupil, classRoute('student', `materials/${material.id}`));
    await visible(pupil, 'Materi pecahan untuk pengujian release.');
    await goto(pupil, classRoute('student', `materials/${material.id}/discussions`));
    await pupil.getByLabel(/^Pesan/).fill('Pesan uji dari browser produksi.');
    await pupil.getByRole('button', { name: 'Kirim ke diskusi', exact: true }).click();
    await visible(pupil, 'Pesan uji dari browser produksi.');
    await cleanPage(pupil);
    console.log('Browser material read + discussion write: PASS');

    const browserQuiz = (await call('browser quiz create', 'POST', `/classes/${classroom.id}/quizzes`, teacherToken, {
      title: 'Kuis browser release', status: 'published', questions: [
        { id: 'b1', type: 'multiple_choice', prompt: 'Dua tambah dua?', choices: ['Empat', 'Lima'], correctAnswer: 'Empat', points: 1 },
        { id: 'b2', type: 'true_false', prompt: 'Empat lebih besar dari dua?', correctAnswer: true, points: 1 },
      ],
    })).quiz;
    await goto(pupil, classRoute('student', `quizzes/${browserQuiz.id}`));
    await pupil.getByRole('button', { name: /Empat/ }).click();
    await pupil.getByRole('button', { name: /Soal berikutnya/ }).click();
    await visible(pupil, 'Empat lebih besar dari dua?');
    await pupil.reload({ waitUntil: 'domcontentloaded' });
    await visible(pupil, 'Empat lebih besar dari dua?');
    await pupil.getByRole('button', { name: /Benar/ }).click();
    await pupil.getByRole('button', { name: 'Tinjau & kumpulkan', exact: true }).click();
    await pupil.getByRole('dialog').getByRole('button', { name: 'Kumpulkan sekarang', exact: true }).click();
    await pupil.locator('.qz-quiz-score strong').waitFor();
    assert.equal(await pupil.locator('.qz-quiz-score strong').innerText(), '100');
    await pupil.reload({ waitUntil: 'domcontentloaded' });
    await pupil.locator('.qz-quiz-score strong').waitFor();
    assert.equal(await pupil.locator('.qz-quiz-score strong').innerText(), '100');
    await screenshot(pupil, 'quiz-result-mobile');
    console.log('Browser quiz draft refresh + submit + result refresh: PASS');

    const uploadTask = (await call('browser upload task create', 'POST', `/classes/${classroom.id}/tasks`, teacherToken, {
      title: 'Tugas file browser', dueAt: new Date(Date.now() + 86400_000).toISOString(), responseMode: 'both', status: 'published',
    })).task;
    await goto(pupil, classRoute('student', `tasks/${uploadTask.id}`));
    await pupil.getByLabel('Jawaban teks', { exact: true }).fill('Jawaban browser dengan berkas uji.');
    await pupil.locator('input[type=file]').setInputFiles({ name: 'release-smoke.txt', mimeType: 'text/plain', buffer: Buffer.from('Nalaro release smoke test. No user data.') });
    const [uploadResponse] = await Promise.all([
      pupil.waitForResponse((response) => response.url().startsWith('https://api.cloudinary.com/') && response.url().endsWith('/upload')),
      pupil.getByRole('button', { name: 'Kumpulkan tugas', exact: true }).click(),
    ]);
    assert.equal(uploadResponse.status(), 200, 'Cloudinary file transfer failed');
    const asset = await uploadResponse.json();
    assert.ok(asset.delete_token, 'Cloudinary test cleanup token missing');
    uploads.push({ token: asset.delete_token, url: uploadResponse.url().replace(/\/(?:image|raw|video)\/upload$/, '/delete_by_token') });
    await pupil.getByRole('heading', { name: 'Jawaban telah dikirim', exact: true }).waitFor();
    await goto(host, classRoute('teacher', `tasks/${uploadTask.id}`));
    await host.getByText('Lihat jawaban dan penilaian', { exact: true }).click();
    await host.getByLabel('Nilai', { exact: true }).fill('85');
    await host.getByLabel('Umpan balik', { exact: true }).fill('Feedback browser produksi.');
    await host.getByRole('button', { name: 'Simpan nilai', exact: true }).click();
    await visible(host, '85/100');
    await pupil.reload({ waitUntil: 'domcontentloaded' });
    await visible(pupil, 'Feedback browser produksi.');
    await visible(pupil, 'release-smoke.txt');
    await cleanPage(pupil);
    console.log('Browser actual Cloudinary upload + task submission + teacher grade: PASS');

    await goto(host, classRoute('teacher', 'attendance'));
    await host.getByLabel('Nama sesi', { exact: true }).fill('Presensi browser release');
    await host.getByRole('button', { name: 'Simpan sebagai draf', exact: true }).click();
    const attendanceCard = host.locator('.qz-attendance-session').filter({ has: host.getByRole('heading', { name: 'Presensi browser release', exact: true }) });
    await attendanceCard.getByRole('button', { name: 'Mulai sesi', exact: true }).click();
    await goto(pupil, classRoute('student', 'attendance'));
    const studentCard = pupil.locator('.qz-attendance-session').filter({ has: pupil.getByRole('heading', { name: 'Presensi browser release', exact: true }) });
    await studentCard.getByRole('button', { name: 'Presensi biasa', exact: true }).click();
    await studentCard.getByText('Hadir', { exact: true }).waitFor();
    await attendanceCard.getByRole('button', { name: 'Akhiri sesi', exact: true }).click();
    console.log('Browser online attendance create + check-in + end: PASS');
    await goto(host, '/teacher/quiz-bank');
    await host.getByRole('heading', { name: 'Bank Kuis', exact: true }).waitFor();
    await host.getByRole('heading', { name: quiz.title, exact: true }).first().waitFor();
    await cleanPage(host);
    console.log('Browser Quiz Bank catalog: PASS');

    await goto(host, classRoute('teacher', `quizzes/${quiz.id}/live`));
    await host.getByLabel('Durasi per soal (detik)', { exact: true }).fill('60');
    await host.getByRole('button', { name: 'Buat sesi live', exact: true }).click();
    await host.locator('.qz-live-code strong').waitFor();
    const code = await host.locator('.qz-live-code strong').innerText();
    assert.match(code, /^[A-Z0-9]{6}$/);
    const players = [pupil, await newPage(), await newPage({ width: 360, height: 800 }), await newPage()];
    for (const [index, player] of players.entries()) {
      await goto(player, `/quiz/join/${code}`);
      await player.getByLabel('Nama pemain', { exact: true }).fill(`Browser Pemain ${index + 1}`);
      await player.getByRole('button', { name: /Masuk arena/ }).click();
      await visible(player, 'Realtime tersambung');
    }
    await visible(host, '4 peserta bergabung');
    await host.getByRole('button', { name: 'Mulai soal pertama', exact: true }).click();
    for (const player of players) await player.getByRole('heading', { name: 'Two plus two?', exact: true }).waitFor();
    for (const player of players.slice(0, 3)) {
      await player.getByRole('button', { name: /Four/ }).click();
      await player.getByRole('button', { name: 'Kunci jawaban', exact: true }).click();
      await visible(player, '✓ Jawaban terkunci');
    }
    await pupil.reload({ waitUntil: 'domcontentloaded' });
    await visible(pupil, '✓ Jawaban terkunci');
    assert.equal(await pupil.getByRole('button', { name: 'Kunci jawaban', exact: true }).count(), 0);
    await pupil.context().setOffline(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await pupil.context().setOffline(false);
    await visible(pupil, 'Realtime tersambung');
    await visible(pupil, '✓ Jawaban terkunci');
    await screenshot(pupil, 'live-locked-mobile');
    // Leaving the host page closes its socket; only the server can advance the deadline.
    await goto(host, '/teacher/home');
    await players[3].locator('.qz-live-reveal').waitFor({ timeout: 75_000 });
    await goto(host, classRoute('teacher', `quizzes/${quiz.id}/live`));
    await host.getByText('4 peserta bergabung', { exact: true }).waitFor();
    await players[3].context().setOffline(true);
    await host.getByRole('button', { name: 'Akhiri sesi', exact: true }).click();
    await host.getByText('✓ Hasil Live tersimpan permanen untuk laporan guru.', { exact: true }).waitFor();
    await players[3].context().setOffline(false);
    await players[3].reload({ waitUntil: 'domcontentloaded' });
    for (const [index, player] of players.entries()) {
      await player.locator('.qz-live-result').waitFor();
      assert.equal(await player.locator('.qz-live-result > .qz-card__body > strong').innerText(), index < 3 ? '1 poin' : '0 poin');
    }
    await screenshot(host, 'live-results-desktop');
    await screenshot(pupil, 'live-results-mobile');
    const liveInsights = await call('browser Live Insights', 'GET', `/classes/${classroom.id}/analytics/students/${student.localId}`, teacherToken);
    assert.equal(liveInsights.analytics.profile.counts.liveQuizzesCompleted, 2);
    console.log('Browser Live 1 host + 4 players, refresh lock, offline recovery, server deadline without host, finish while player offline, D1 result + Insights: PASS');
    assert.equal(runtimeErrors.length, 0, `Browser runtime errors: ${runtimeErrors.join(', ')}`);
    console.log('Production Chrome desktop + mobile viewport smoke: PASS');
  } catch (error) {
    failed = true;
    // Avoid locator call logs containing generated login credentials.
    let message = String(error.message);
    for (const account of [teacher, student]) {
      message = message.replaceAll(account.email, '[test email]').replaceAll(account.smokePassword, '[redacted]');
    }
    console.error(`Browser smoke failed: ${error.name}: ${message}`);
    if (currentPage && !currentPage.url().includes('/login')) await screenshot(currentPage, 'failure').catch(() => {});
  } finally {
    await browser.close();
    for (const upload of uploads) {
      const response = await fetch(upload.url, { method: 'POST', body: new URLSearchParams({ token: upload.token }) });
      if (!response.ok || (await response.json()).result !== 'ok') {
        failed = true;
        console.error('Cloudinary smoke asset cleanup failed');
      } else console.log('Cloudinary smoke asset cleanup: PASS');
    }
  }
  assert.equal(failed, false, 'Browser release gate failed');
}
