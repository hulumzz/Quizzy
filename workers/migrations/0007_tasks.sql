CREATE TABLE tasks (
  id TEXT PRIMARY KEY, class_id TEXT NOT NULL, owner_id TEXT NOT NULL, session_id TEXT,
  title TEXT NOT NULL, instructions TEXT NOT NULL DEFAULT '', due_at TEXT NOT NULL,
  response_mode TEXT NOT NULL CHECK(response_mode IN ('text','attachment','both')),
  status TEXT NOT NULL CHECK(status IN ('draft','published','archived','deleted')),
  published_at TEXT, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE, FOREIGN KEY(owner_id) REFERENCES users(id)
);
CREATE INDEX idx_tasks_class_due ON tasks(class_id, due_at ASC);
CREATE TABLE task_submissions (
  task_id TEXT NOT NULL, student_id TEXT NOT NULL, class_id TEXT NOT NULL, student_name TEXT NOT NULL,
  text_answer TEXT NOT NULL DEFAULT '', attachments_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL,
  late INTEGER NOT NULL DEFAULT 0, submitted_at TEXT NOT NULL, attempt_number INTEGER NOT NULL, revision_count INTEGER NOT NULL DEFAULT 0,
  score INTEGER, feedback TEXT NOT NULL DEFAULT '', graded_at TEXT, graded_by TEXT, returned_at TEXT, updated_at TEXT NOT NULL,
  PRIMARY KEY(task_id, student_id), FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE, FOREIGN KEY(student_id) REFERENCES users(id)
);
CREATE TABLE task_submission_revisions (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL, student_id TEXT NOT NULL, previous_json TEXT NOT NULL, created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_task_submissions_task ON task_submissions(task_id, submitted_at DESC);
