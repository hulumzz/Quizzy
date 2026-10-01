import { forbidden, notFound } from '../http/errors.js';

const round = (value) => Math.round(Number(value || 0) * 10) / 10;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value || 0)));
const average = (values) => values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : null;

function weightedAverage(parts) {
  const valid = parts.filter((part) => Number.isFinite(part.value) && part.weight > 0);
  if (!valid.length) return null;
  const totalWeight = valid.reduce((sum, part) => sum + part.weight, 0);
  return round(valid.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight);
}

function rate(value, total) {
  if (!total) return null;
  return round((value / total) * 100);
}

function labelForConfidence(value) {
  if (value >= 70) return 'tinggi';
  if (value >= 40) return 'sedang';
  return 'rendah';
}

function confidenceScore({ strongCount, supportCount, sourceCount }) {
  const value = clamp((strongCount * 14) + (supportCount * 2.5) + (sourceCount * 5));
  return { value: round(value), label: labelForConfidence(value) };
}

export function calculateTrend(events) {
  const values = [...events]
    .filter((event) => Number.isFinite(Number(event.score)) && event.occurredAt)
    .sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)));
  if (values.length < 2) return { direction: 'insufficient', delta: null, label: 'Belum cukup data', evidenceCount: values.length, confidence: 'rendah' };

  let delta;
  if (values.length < 4) delta = Number(values.at(-1).score) - Number(values[0].score);
  else {
    const recent = values.slice(-3);
    const previous = values.slice(Math.max(0, values.length - 6), -3);
    delta = average(recent.map((item) => item.score)) - average(previous.map((item) => item.score));
  }
  delta = round(delta);
  const direction = delta >= 5 ? 'improving' : delta <= -5 ? 'declining' : 'stable';
  const label = direction === 'improving' ? 'Meningkat' : direction === 'declining' ? 'Menurun' : 'Stabil';
  return { direction, delta, label, evidenceCount: values.length, confidence: values.length >= 4 ? 'sedang' : 'rendah' };
}

function learningStatus({ mastery, strongCount, trend }) {
  if (!Number.isFinite(mastery) || strongCount < 2) return { key: 'insufficient', label: 'Belum cukup data' };
  if (mastery >= 80 && trend.direction !== 'declining') return { key: 'mastering', label: 'Menguasai' };
  if (mastery < 60 || (trend.direction === 'declining' && Number(trend.delta) <= -10)) return { key: 'support', label: 'Perlu dukungan' };
  return { key: 'developing', label: 'Berkembang' };
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function sourceLabel(source) {
  if (source === 'quiz') return 'Kuis';
  if (source === 'task') return 'Tugas';
  if (source === 'task_revision') return 'Nilai sebelum revisi';
  return source;
}

function summarizeScope({
  studentId,
  joinedAtMs = 0,
  sessionId = undefined,
  nowMs,
  sessionsById,
  materials,
  progress,
  discussions,
  attendanceSessions,
  checkins,
  quizzes,
  quizAttempts,
  tasks,
  taskSubmissions,
  taskRevisions,
}) {
  const inScope = (itemSessionId) => sessionId === undefined || (itemSessionId || null) === sessionId;
  const ownProgressIds = new Set(progress.filter((item) => item.user_id === studentId).map((item) => item.material_id));
  const scopedMaterials = materials.filter((item) => inScope(item.session_id) && (!item.published_at || Date.parse(item.published_at) >= joinedAtMs || ownProgressIds.has(item.id)));
  const materialIds = new Set(scopedMaterials.map((item) => item.id));
  const progressRows = progress.filter((item) => item.user_id === studentId && materialIds.has(item.material_id));
  const progressByMaterial = new Map(progressRows.map((item) => [item.material_id, item]));
  const materialProgressValues = scopedMaterials.map((item) => Number(progressByMaterial.get(item.id)?.percent || 0));
  const materialsStarted = progressRows.filter((item) => Number(item.percent || 0) > 0).length;
  const materialsCompleted = progressRows.filter((item) => Number(item.percent || 0) >= 100).length;

  const discussionRows = discussions.filter((item) => item.user_id === studentId && materialIds.has(item.material_id));
  const discussionMaterials = new Set(discussionRows.map((item) => item.material_id));

  const scopedAttendance = attendanceSessions.filter((item) => inScope(item.session_id) && Date.parse(item.ended_at || 0) >= joinedAtMs);
  const attendanceIds = new Set(scopedAttendance.map((item) => item.id));
  const ownCheckins = checkins.filter((item) => item.user_id === studentId && attendanceIds.has(item.attendance_id));
  const attendanceRate = rate(ownCheckins.length, scopedAttendance.length);

  const scopedQuizzes = quizzes.filter((item) => inScope(item.session_id));
  const quizIds = new Set(scopedQuizzes.map((item) => item.id));
  const ownQuizAttempts = quizAttempts.filter((item) => item.student_id === studentId && quizIds.has(item.quiz_id));

  const scopedTasks = tasks.filter((item) => inScope(item.session_id));
  const taskIds = new Set(scopedTasks.map((item) => item.id));
  const ownTaskSubmissions = taskSubmissions.filter((item) => item.student_id === studentId && taskIds.has(item.task_id));
  const submissionByTask = new Map(ownTaskSubmissions.map((item) => [item.task_id, item]));
  const eligibleTasks = scopedTasks.filter((item) => Date.parse(item.due_at) <= nowMs || submissionByTask.has(item.id));
  const submittedEligibleTasks = eligibleTasks.filter((item) => submissionByTask.has(item.id));
  const onTimeSubmissions = submittedEligibleTasks.filter((item) => !Boolean(submissionByTask.get(item.id)?.late));
  const taskCompletionRate = rate(submittedEligibleTasks.length, eligibleTasks.length);
  const onTimeRate = rate(onTimeSubmissions.length, submittedEligibleTasks.length);

  const gradedTaskSubmissions = ownTaskSubmissions.filter((item) => Number.isFinite(Number(item.score)));
  const quizScores = ownQuizAttempts.map((item) => Number(item.score));
  const taskScores = gradedTaskSubmissions.map((item) => Number(item.score));
  const quizAverage = average(quizScores);
  const taskAverage = average(taskScores);
  const mastery = weightedAverage([
    { value: quizAverage, weight: 1 },
    { value: taskAverage, weight: 1.15 },
  ]);

  const revisionRows = taskRevisions.filter((item) => item.student_id === studentId && taskIds.has(item.task_id));
  const scoredTimeline = [
    ...ownQuizAttempts.map((item) => ({ source: 'quiz', sourceId: item.quiz_id, label: item.quiz_title, score: Number(item.score), occurredAt: item.submitted_at, sessionId: item.session_id || null })),
    ...gradedTaskSubmissions.map((item) => ({ source: 'task', sourceId: item.task_id, label: item.task_title, score: Number(item.score), occurredAt: item.graded_at || item.submitted_at, sessionId: item.session_id || null })),
    ...revisionRows.flatMap((item) => {
      const previous = parseJson(item.previous_json, {});
      return Number.isFinite(Number(previous.score))
        ? [{ source: 'task_revision', sourceId: item.task_id, label: item.task_title, score: Number(previous.score), occurredAt: item.created_at, sessionId: item.session_id || null }]
        : [];
    }),
  ];
  const trend = calculateTrend(scoredTimeline);

  const consistency = weightedAverage([
    { value: attendanceRate, weight: 0.55 },
    { value: taskCompletionRate, weight: 0.30 },
    { value: onTimeRate, weight: 0.15 },
  ]);

  const materialProgressAverage = scopedMaterials.length ? average(materialProgressValues) : null;
  const materialCompletionRate = rate(materialsCompleted, scopedMaterials.length);
  const discussionParticipationRate = rate(discussionMaterials.size, scopedMaterials.length);
  const engagement = weightedAverage([
    { value: materialProgressAverage, weight: 0.45 },
    { value: discussionParticipationRate, weight: 0.15 },
    { value: attendanceRate, weight: 0.20 },
    { value: taskCompletionRate, weight: 0.20 },
  ]);

  const strongCount = ownQuizAttempts.length + gradedTaskSubmissions.length;
  const supportCount = materialsStarted + ownCheckins.length + submittedEligibleTasks.length + discussionMaterials.size;
  const sourceTypes = new Set();
  if (ownQuizAttempts.length) sourceTypes.add('quiz');
  if (gradedTaskSubmissions.length) sourceTypes.add('task');
  if (materialsStarted) sourceTypes.add('material');
  if (ownCheckins.length) sourceTypes.add('attendance');
  if (discussionRows.length) sourceTypes.add('discussion');
  const confidence = confidenceScore({ strongCount, supportCount, sourceCount: sourceTypes.size });
  const status = learningStatus({ mastery, strongCount, trend });

  const recentEvidence = [...scoredTimeline]
    .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
    .slice(0, 6)
    .map((item) => ({ ...item, sourceLabel: sourceLabel(item.source), sessionTitle: item.sessionId ? sessionsById.get(item.sessionId)?.title || null : null }));

  return {
    mastery: Number.isFinite(mastery) ? mastery : null,
    consistency: Number.isFinite(consistency) ? consistency : null,
    engagement: Number.isFinite(engagement) ? engagement : null,
    trend,
    confidence,
    status,
    strongEvidenceCount: strongCount,
    supportEvidenceCount: supportCount,
    evidenceCount: strongCount + supportCount,
    rates: {
      quizAverage: Number.isFinite(quizAverage) ? round(quizAverage) : null,
      taskAverage: Number.isFinite(taskAverage) ? round(taskAverage) : null,
      attendance: attendanceRate,
      taskCompletion: taskCompletionRate,
      onTimeSubmission: onTimeRate,
      materialProgress: Number.isFinite(materialProgressAverage) ? round(materialProgressAverage) : null,
      materialCompletion: materialCompletionRate,
      discussionParticipation: discussionParticipationRate,
    },
    counts: {
      quizzesCompleted: ownQuizAttempts.length,
      tasksEligible: eligibleTasks.length,
      tasksSubmitted: submittedEligibleTasks.length,
      tasksGraded: gradedTaskSubmissions.length,
      revisions: revisionRows.length,
      materialsAvailable: scopedMaterials.length,
      materialsStarted,
      materialsCompleted,
      discussionContributions: discussionRows.length,
      attendanceExpected: scopedAttendance.length,
      attendancePresent: ownCheckins.length,
    },
    recentEvidence,
  };
}

function studentInsights(profile) {
  const insights = [];
  if (profile.status.key === 'insufficient') {
    insights.push({ tone: 'neutral', title: 'Belum cukup bukti belajar', body: 'Nalaro belum memiliki cukup hasil kuis/tugas untuk menilai pemahaman dengan yakin. Aktivitas berikutnya akan memperkuat analisis.' });
  } else if (profile.mastery >= 80) {
    insights.push({ tone: 'positive', title: 'Pemahaman terlihat kuat', body: `Rata-rata evidence penilaian berada di sekitar ${Math.round(profile.mastery)}. Tetap lihat tren agar performa tinggi ini konsisten.` });
  } else if (profile.mastery < 60) {
    insights.push({ tone: 'attention', title: 'Perlu penguatan pemahaman', body: `Evidence penilaian saat ini berada di sekitar ${Math.round(profile.mastery)}. Periksa topik dengan hasil terendah sebelum menambah materi baru.` });
  } else {
    insights.push({ tone: 'neutral', title: 'Pemahaman sedang berkembang', body: `Evidence penilaian berada di sekitar ${Math.round(profile.mastery)} dan masih dapat diperkuat melalui latihan berikutnya.` });
  }

  if (profile.trend.direction === 'improving') insights.push({ tone: 'positive', title: 'Performa terbaru meningkat', body: `Aktivitas penilaian terbaru naik sekitar ${Math.abs(profile.trend.delta)} poin dibanding evidence sebelumnya.` });
  if (profile.trend.direction === 'declining') insights.push({ tone: 'attention', title: 'Performa terbaru menurun', body: `Aktivitas penilaian terbaru turun sekitar ${Math.abs(profile.trend.delta)} poin. Periksa apakah topik terbaru membutuhkan dukungan tambahan.` });

  if (Number.isFinite(profile.engagement) && profile.engagement < 50) insights.push({ tone: 'attention', title: 'Keterlibatan masih rendah', body: 'Progres materi, kehadiran, tugas, atau diskusi belum konsisten. Gunakan detail evidence untuk melihat sumber utamanya.' });
  else if (Number.isFinite(profile.engagement) && profile.engagement >= 80) insights.push({ tone: 'positive', title: 'Keterlibatan belajar tinggi', body: 'Aktivitas materi, tugas, presensi, dan diskusi menunjukkan keterlibatan yang konsisten.' });

  return insights.slice(0, 3);
}

function compactStudent(profile) {
  return {
    studentId: profile.studentId,
    name: profile.name,
    joinedAt: profile.joinedAt,
    mastery: profile.mastery,
    consistency: profile.consistency,
    engagement: profile.engagement,
    trend: profile.trend,
    confidence: profile.confidence,
    status: profile.status,
    evidenceCount: profile.evidenceCount,
  };
}

function aggregateStudents(profiles) {
  const numberValues = (key) => profiles.map((profile) => profile[key]).filter(Number.isFinite);
  const trendValues = profiles.map((profile) => profile.trend?.delta).filter(Number.isFinite);
  return {
    mastery: round(average(numberValues('mastery')) ?? 0),
    masteryAvailable: numberValues('mastery').length,
    consistency: round(average(numberValues('consistency')) ?? 0),
    engagement: round(average(numberValues('engagement')) ?? 0),
    trendDelta: trendValues.length ? round(average(trendValues)) : null,
  };
}

function classInsights({ summary, statuses, sessionAnalytics, unmapped }) {
  const insights = [];
  const measured = summary.masteryAvailable;
  if (!measured) insights.push({ tone: 'neutral', title: 'Belum ada evidence penilaian yang cukup', body: 'Mulai dari kuis atau tugas bernilai agar Nalaro dapat membaca pemahaman kelas.' });
  else if (summary.trendDelta >= 5) insights.push({ tone: 'positive', title: 'Performa kelas sedang meningkat', body: `Rata-rata tren siswa yang memiliki data naik sekitar ${Math.abs(summary.trendDelta)} poin pada aktivitas terbaru.` });
  else if (summary.trendDelta <= -5) insights.push({ tone: 'attention', title: 'Performa terbaru perlu diperiksa', body: `Rata-rata tren siswa yang memiliki data turun sekitar ${Math.abs(summary.trendDelta)} poin pada aktivitas terbaru.` });

  if (statuses.support > 0) insights.push({ tone: 'attention', title: `${statuses.support} siswa perlu dukungan`, body: 'Status ini berasal dari evidence pemahaman yang rendah atau tren penurunan yang cukup kuat, bukan label kemampuan permanen.' });

  const eligibleSessions = sessionAnalytics.filter((item) => Number.isFinite(item.mastery) && item.coverage >= 25);
  if (eligibleSessions.length) {
    const weakest = [...eligibleSessions].sort((a, b) => a.mastery - b.mastery)[0];
    insights.push({ tone: weakest.mastery < 65 ? 'attention' : 'neutral', title: `Perhatikan topik: ${weakest.title}`, body: `Rata-rata pemahaman pada pertemuan ini sekitar ${Math.round(weakest.mastery)} dengan coverage evidence ${Math.round(weakest.coverage)}% siswa.` });
  }

  const unmappedTotal = Object.values(unmapped).reduce((sum, value) => sum + value, 0);
  if (unmappedTotal) insights.push({ tone: 'neutral', title: 'Sebagian aktivitas belum terhubung ke pertemuan', body: `${unmappedTotal} aktivitas terbit belum memiliki Learning Session, sehingga tetap masuk analitik kelas tetapi belum memperkaya analitik per topik.` });
  return insights.slice(0, 4);
}

export class LearningAnalyticsRepository {
  constructor({ db, classRepository }) {
    if (!db || !classRepository) throw new Error('DB and classRepository are required');
    this.db = db;
    this.classRepository = classRepository;
  }

  async access(classId, uid) { return this.classRepository.getForUser(classId, uid); }

  async loadDataset(classId) {
    const all = async (query, ...values) => (await this.db.prepare(query).bind(...values).all()).results || [];
    const [
      members, sessions, materials, progress, discussions, attendanceSessions, checkins,
      quizzes, quizAttempts, tasks, taskSubmissions, taskRevisions,
    ] = await Promise.all([
      all('SELECT user_id,name,joined_at FROM class_members WHERE class_id=?1 ORDER BY joined_at ASC', classId),
      all("SELECT id,title,description,meeting_date,status,sort_order FROM learning_sessions WHERE class_id=?1 AND status IN ('published','archived') ORDER BY sort_order ASC,meeting_date ASC", classId),
      all("SELECT id,title,session_id,published_at FROM materials WHERE class_id=?1 AND status='published'", classId),
      all("SELECT p.user_id,p.material_id,p.percent,p.status,p.last_read_at,p.completed_at FROM material_progress p JOIN materials m ON m.id=p.material_id WHERE p.class_id=?1 AND m.status='published'", classId),
      all("SELECT d.author_id AS user_id,d.material_id,m.session_id,d.created_at AS occurred_at FROM discussions d JOIN materials m ON m.id=d.material_id WHERE d.class_id=?1 AND d.author_role='student' AND d.deleted_at IS NULL UNION ALL SELECT r.author_id AS user_id,r.material_id,m.session_id,r.created_at AS occurred_at FROM discussion_replies r JOIN materials m ON m.id=r.material_id WHERE r.class_id=?1 AND r.author_role='student' AND r.deleted_at IS NULL", classId),
      all("SELECT id,session_id,title,ended_at FROM attendance_sessions WHERE class_id=?1 AND status='ended'", classId),
      all("SELECT c.attendance_id,c.user_id,c.checked_in_at FROM attendance_checkins c JOIN attendance_sessions s ON s.id=c.attendance_id WHERE c.class_id=?1 AND s.status='ended'", classId),
      all("SELECT id,title,session_id,published_at FROM quizzes WHERE class_id=?1 AND status='published'", classId),
      all("SELECT a.quiz_id,a.student_id,a.score,a.submitted_at,q.title AS quiz_title,q.session_id FROM quiz_attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE a.class_id=?1 AND q.status='published'", classId),
      all("SELECT id,title,session_id,due_at,status FROM tasks WHERE class_id=?1 AND status IN ('published','archived')", classId),
      all("SELECT s.task_id,s.student_id,s.status,s.late,s.submitted_at,s.score,s.graded_at,s.revision_count,t.title AS task_title,t.session_id FROM task_submissions s JOIN tasks t ON t.id=s.task_id WHERE s.class_id=?1 AND t.status<>'deleted'", classId),
      all("SELECT r.task_id,r.student_id,r.previous_json,r.created_at,t.title AS task_title,t.session_id FROM task_submission_revisions r JOIN tasks t ON t.id=r.task_id WHERE t.class_id=?1 AND t.status<>'deleted'", classId),
    ]);
    return { members, sessions, materials, progress, discussions, attendanceSessions, checkins, quizzes, quizAttempts, tasks, taskSubmissions, taskRevisions };
  }

  buildStudent(dataset, member, now = new Date()) {
    const sessionsById = new Map(dataset.sessions.map((item) => [item.id, item]));
    const base = summarizeScope({ studentId: member.user_id, nowMs: now.getTime(), sessionsById, ...dataset });
    const sessionAnalytics = dataset.sessions.map((session) => {
      const metrics = summarizeScope({ studentId: member.user_id, sessionId: session.id, nowMs: now.getTime(), sessionsById, ...dataset });
      return {
        sessionId: session.id,
        title: session.title,
        meetingDate: session.meeting_date,
        status: session.status,
        mastery: metrics.mastery,
        consistency: metrics.consistency,
        engagement: metrics.engagement,
        trend: metrics.trend,
        confidence: metrics.confidence,
        evidenceCount: metrics.evidenceCount,
        rates: metrics.rates,
        counts: metrics.counts,
      };
    }).filter((item) => item.evidenceCount > 0);

    const strongest = sessionAnalytics.filter((item) => Number.isFinite(item.mastery)).sort((a, b) => b.mastery - a.mastery)[0] || null;
    const weakest = sessionAnalytics.filter((item) => Number.isFinite(item.mastery)).sort((a, b) => a.mastery - b.mastery)[0] || null;
    const profile = {
      studentId: member.user_id,
      name: member.name || 'Siswa Nalaro',
      joinedAt: member.joined_at,
      ...base,
      sessionAnalytics,
      strongestSession: strongest ? { sessionId: strongest.sessionId, title: strongest.title, mastery: strongest.mastery } : null,
      weakestSession: weakest ? { sessionId: weakest.sessionId, title: weakest.title, mastery: weakest.mastery } : null,
    };
    profile.insights = studentInsights(profile);
    return profile;
  }

  async getClassOverview(classId, ownerId, { now = new Date() } = {}) {
    const access = await this.access(classId, ownerId);
    if (access.accessRole !== 'owner') throw forbidden('Analitik kelas hanya tersedia untuk pengelola kelas.');
    const dataset = await this.loadDataset(classId);
    const profiles = dataset.members.map((member) => this.buildStudent(dataset, member, now));
    const summary = aggregateStudents(profiles);
    const statuses = {
      mastering: profiles.filter((item) => item.status.key === 'mastering').length,
      developing: profiles.filter((item) => item.status.key === 'developing').length,
      support: profiles.filter((item) => item.status.key === 'support').length,
      insufficient: profiles.filter((item) => item.status.key === 'insufficient').length,
    };
    const sessionAnalytics = dataset.sessions.map((session) => {
      const values = profiles.map((profile) => profile.sessionAnalytics.find((item) => item.sessionId === session.id)).filter(Boolean);
      const withEvidence = values.filter((item) => item.evidenceCount > 0);
      const masteryValues = values.map((item) => item.mastery).filter(Number.isFinite);
      return {
        sessionId: session.id,
        title: session.title,
        meetingDate: session.meeting_date,
        mastery: masteryValues.length ? round(average(masteryValues)) : null,
        engagement: round(average(values.map((item) => item.engagement).filter(Number.isFinite)) ?? 0),
        coverage: dataset.members.length ? round((withEvidence.length / dataset.members.length) * 100) : 0,
        evidenceCount: values.reduce((sum, item) => sum + item.evidenceCount, 0),
      };
    });

    const unmapped = {
      materials: dataset.materials.filter((item) => !item.session_id).length,
      quizzes: dataset.quizzes.filter((item) => !item.session_id).length,
      tasks: dataset.tasks.filter((item) => !item.session_id).length,
      attendance: dataset.attendanceSessions.filter((item) => !item.session_id).length,
    };

    const evidenceCount = profiles.reduce((sum, item) => sum + item.evidenceCount, 0);
    const confidenceValues = profiles.map((item) => item.confidence.value).filter(Number.isFinite);
    const classConfidence = confidenceValues.length ? round(average(confidenceValues)) : 0;
    return {
      class: { id: access.id, name: access.name, studentsCount: dataset.members.length },
      summary: { ...summary, evidenceCount, confidence: { value: classConfidence, label: labelForConfidence(classConfidence) } },
      statuses,
      sessionAnalytics,
      unmapped,
      students: profiles.map(compactStudent),
      insights: classInsights({ summary, statuses, sessionAnalytics, unmapped }),
      generatedAt: now.toISOString(),
      methodologyVersion: 'learning-insights-v1',
    };
  }

  async getStudent(classId, requesterId, studentId, { now = new Date() } = {}) {
    const access = await this.access(classId, requesterId);
    if (access.accessRole === 'member' && requesterId !== studentId) throw forbidden('Siswa hanya dapat melihat analitik belajarnya sendiri.');
    const dataset = await this.loadDataset(classId);
    const member = dataset.members.find((item) => item.user_id === studentId);
    if (!member) throw notFound('Siswa tidak ditemukan di kelas ini.');
    return {
      class: { id: access.id, name: access.name },
      profile: this.buildStudent(dataset, member, now),
      generatedAt: now.toISOString(),
      methodologyVersion: 'learning-insights-v1',
    };
  }
}
