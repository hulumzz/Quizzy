CREATE TABLE live_quiz_sessions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL CHECK(scope IN ('class','general')),
  class_id TEXT,
  learning_session_id TEXT,
  quiz_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  participant_count INTEGER NOT NULL,
  started_at TEXT,
  finished_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  persisted_at TEXT NOT NULL,
  FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY(owner_id) REFERENCES users(id)
);

CREATE INDEX idx_live_sessions_class_finished
  ON live_quiz_sessions(class_id, finished_at DESC);
CREATE INDEX idx_live_sessions_owner_finished
  ON live_quiz_sessions(owner_id, finished_at DESC);
CREATE INDEX idx_live_sessions_learning_session
  ON live_quiz_sessions(class_id, learning_session_id, finished_at DESC);

CREATE TABLE live_quiz_results (
  live_session_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  student_id TEXT,
  participant_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY(live_session_id, participant_id),
  FOREIGN KEY(live_session_id) REFERENCES live_quiz_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_live_results_student
  ON live_quiz_results(student_id, live_session_id);

CREATE TABLE live_quiz_answer_results (
  live_session_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  student_id TEXT,
  correct INTEGER NOT NULL,
  earned_points INTEGER NOT NULL,
  answered_at TEXT NOT NULL,
  PRIMARY KEY(live_session_id, question_id, participant_id),
  FOREIGN KEY(live_session_id) REFERENCES live_quiz_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_live_answers_student
  ON live_quiz_answer_results(student_id, live_session_id);
