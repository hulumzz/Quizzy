CREATE TABLE general_quizzes (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('draft','published','deleted')),
  mode TEXT NOT NULL DEFAULT 'self_paced', questions_json TEXT NOT NULL, settings_json TEXT NOT NULL,
  published_at TEXT, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_general_quizzes_owner_updated ON general_quizzes(owner_id, updated_at DESC);

CREATE TABLE quiz_bank_catalog (
  id TEXT PRIMARY KEY, author_id TEXT NOT NULL, source_type TEXT NOT NULL CHECK(source_type IN ('class','general')),
  source_class_id TEXT, source_quiz_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('published','unpublished')),
  title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', question_count INTEGER NOT NULL,
  total_points INTEGER NOT NULL, level TEXT NOT NULL, subject_id TEXT NOT NULL,
  tags_json TEXT NOT NULL, license TEXT NOT NULL, snapshot_json TEXT NOT NULL,
  published_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(author_id, source_type, source_quiz_id)
);
CREATE INDEX idx_quiz_bank_public ON quiz_bank_catalog(status, published_at DESC);
CREATE INDEX idx_quiz_bank_author ON quiz_bank_catalog(author_id, status, updated_at DESC);
CREATE INDEX idx_quiz_bank_level_subject ON quiz_bank_catalog(status, level, subject_id, published_at DESC);
