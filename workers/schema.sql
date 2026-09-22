-- Cloudflare D1 SQL Schema for Quizzy LMS

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('teacher', 'student')) DEFAULT 'student',
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    teacher_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS class_members (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    UNIQUE(class_id, student_id)
);

CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content_blocks TEXT NOT NULL, -- JSON array of Notion-like blocks
    youtube_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS discussions (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS attendances (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    session_name TEXT NOT NULL,
    venue_lat REAL,
    venue_lng REAL,
    radius_meters INTEGER DEFAULT 100,
    duration_minutes INTEGER DEFAULT 60,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS attendance_logs (
    id TEXT PRIMARY KEY,
    attendance_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    distance_meters REAL,
    status TEXT CHECK(status IN ('Hadir', 'Terlambat', 'Luar Radius')) DEFAULT 'Hadir',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attendance_id) REFERENCES attendances(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    UNIQUE(attendance_id, student_id)
);
