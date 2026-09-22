import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Enable CORS for Vite Frontend
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Root Healthcheck
app.get('/', (c) => c.json({ name: 'Quizzy Cloudflare Workers API', status: 'online', timestamp: new Date() }));

// ==========================================
// 1. CLOUDFLARE WORKERS AI ENDPOINTS (NEURONS)
// ==========================================

// AI Summarizer (Materi -> Rangkuman)
app.post('/api/ai/summarize', async (c) => {
  try {
    const { text } = await c.req.json();
    if (!text) return c.json({ error: 'Text content required' }, 400);

    const prompt = `Berikan rangkuman materi berikut secara ringkas, jelas, dan mudah dipahami oleh siswa dalam bahasa Indonesia:\n\n${text}`;
    
    // Cloudflare Workers AI Call
    const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'Anda adalah asisten guru Quizzy LMS yang ahli merangkum materi pembelajaran.' },
        { role: 'user', content: prompt }
      ]
    });

    return c.json({ summary: response.response });
  } catch (err) {
    console.error('AI Error:', err);
    return c.json({ error: 'Failed to run Cloudflare Workers AI', details: err.message }, 500);
  }
});

// AI Auto-Quiz Generator (Materi -> JSON 5 Soal Kuis)
app.post('/api/ai/generate-quiz', async (c) => {
  try {
    const { text, count = 5 } = await c.req.json();
    if (!text) return c.json({ error: 'Text content required' }, 400);

    const prompt = `Buatkan ${count} soal kuis pilihan ganda berdasarkan teks materi berikut. 
Format jawaban HARUS berupa array JSON murni tanpa markdown formatting dengan struktur berikut:
[
  {
    "question": "Pertanyaan?",
    "type": "multiple_choice",
    "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
    "correctIndex": 0,
    "explanation": "Penjelasan singkat"
  }
]

Teks Materi:
${text}`;

    const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'Anda adalah generator kuis otomatis yang selalu merespons dengan JSON array valid tanpa teks tambahan.' },
        { role: 'user', content: prompt }
      ]
    });

    let raw = response.response;
    // Strip markdown JSON block if present
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const questions = JSON.parse(raw);

    return c.json({ questions });
  } catch (err) {
    console.error('AI Quiz Gen Error:', err);
    return c.json({ 
      error: 'AI generation error',
      fallbackQuestions: [
        {
          question: "Apa definisi utama dari materi yang baru saja dibaca?",
          type: "multiple_choice",
          options: ["Konsep Dasar", "Aplikasi Praktis", "Prinsip Utama", "Kesimpulan"],
          correctIndex: 0,
          explanation: "Jawaban berdasarkan pemahaman umum materi."
        }
      ] 
    }, 200);
  }
});

// AI Class Tutor Chat
app.post('/api/ai/tutor', async (c) => {
  try {
    const { materialContext, userQuestion } = await c.req.json();
    
    const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: `Anda adalah AI Tutor ramah yang membantu siswa belajar berdasarkan konteks materi berikut:\n${materialContext || 'Materi Umum'}` },
        { role: 'user', content: userQuestion }
      ]
    });

    return c.json({ answer: response.response });
  } catch (err) {
    return c.json({ error: 'AI Tutor unavailable', details: err.message }, 500);
  }
});

// ==========================================
// 2. CLASSROOM & WORKSPACE ENDPOINTS (D1)
// ==========================================

// Get All Classes
app.get('/api/classes', async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM classes ORDER BY created_at DESC").all();
    return c.json({ classes: results });
  } catch (e) {
    return c.json({ classes: [] });
  }
});

// Create Class
app.post('/api/classes', async (c) => {
  try {
    const { name, description, teacherId } = await c.req.json();
    const id = 'class_' + Math.random().toString(36).substr(2, 9);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    await c.env.DB.prepare(
      "INSERT INTO classes (id, code, name, description, teacher_id) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, code, name, description, teacherId || 'teacher_demo').run();

    return c.json({ success: true, class: { id, code, name, description } });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// ==========================================
// 3. GEOTAGGED ATTENDANCE ENDPOINTS (D1)
// ==========================================

// Haversine Distance Helper (Meters)
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Student Submit GPS Check-in
app.post('/api/attendance/checkin', async (c) => {
  try {
    const { attendanceId, studentId, studentName, lat, lng, venueLat, venueLng, radiusMeters = 100 } = await c.req.json();
    
    let distance = null;
    let status = 'Hadir';

    if (venueLat && venueLng && lat && lng) {
      distance = calculateDistanceMeters(lat, lng, venueLat, venueLng);
      if (distance > radiusMeters) {
        status = 'Luar Radius';
      }
    }

    const logId = 'att_log_' + Math.random().toString(36).substr(2, 9);

    await c.env.DB.prepare(
      "INSERT INTO attendance_logs (id, attendance_id, student_id, student_name, lat, lng, distance_meters, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(logId, attendanceId || 'att_session_1', studentId || 'std_1', studentName || 'Siswa', lat, lng, distance, status).run();

    return c.json({ 
      success: true, 
      status, 
      distanceMeters: distance ? Math.round(distance) : null,
      message: status === 'Hadir' ? 'Presensi berhasil diverifikasi!' : 'Lokasi Anda berada di luar radius yang diizinkan.' 
    });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;
