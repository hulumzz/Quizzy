CREATE TABLE quizzes (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  session_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'deleted')),
  mode TEXT NOT NULL DEFAULT 'self_paced',
  questions_json TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  published_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE INDEX idx_quizzes_class_updated ON quizzes(class_id, updated_at DESC);
CREATE INDEX idx_quizzes_class_published ON quizzes(class_id, status, updated_at DESC);
CREATE TABLE quiz_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  score INTEGER NOT NULL,
  earned_points INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  submitted_at TEXT NOT NULL,
  UNIQUE(quiz_id, student_id),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_quiz_attempts_quiz_submitted ON quiz_attempts(quiz_id, submitted_at DESC);
