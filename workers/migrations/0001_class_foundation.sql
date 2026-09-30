PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('teacher', 'student')),
  avatar TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

CREATE TABLE classes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  teacher_name TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  students_count INTEGER NOT NULL DEFAULT 0 CHECK (students_count >= 0),
  materials_count INTEGER NOT NULL DEFAULT 0 CHECK (materials_count >= 0),
  quizzes_count INTEGER NOT NULL DEFAULT 0 CHECK (quizzes_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_classes_owner_created ON classes(owner_id, created_at DESC);

CREATE TABLE class_members (
  class_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'student' CHECK (role = 'student'),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (class_id, user_id),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_class_members_user_joined ON class_members(user_id, joined_at DESC);
