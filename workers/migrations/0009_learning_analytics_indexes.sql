-- Read-optimized indexes for Nalaro Learning Insights.
-- No analytics cache/table is introduced; existing learning data remains authoritative.

CREATE INDEX IF NOT EXISTS idx_materials_analytics
  ON materials(class_id, status, session_id);

CREATE INDEX IF NOT EXISTS idx_material_progress_class_user
  ON material_progress(class_id, user_id, material_id);

CREATE INDEX IF NOT EXISTS idx_discussions_class_author
  ON discussions(class_id, author_id, material_id, created_at);

CREATE INDEX IF NOT EXISTS idx_discussion_replies_class_author
  ON discussion_replies(class_id, author_id, material_id, created_at);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_analytics
  ON attendance_sessions(class_id, status, session_id, ended_at);

CREATE INDEX IF NOT EXISTS idx_attendance_checkins_class_user
  ON attendance_checkins(class_id, user_id, attendance_id);

CREATE INDEX IF NOT EXISTS idx_quizzes_analytics
  ON quizzes(class_id, status, session_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_class_student
  ON quiz_attempts(class_id, student_id, submitted_at);

CREATE INDEX IF NOT EXISTS idx_tasks_analytics
  ON tasks(class_id, status, session_id, due_at);

CREATE INDEX IF NOT EXISTS idx_task_submissions_class_student
  ON task_submissions(class_id, student_id, submitted_at);

CREATE INDEX IF NOT EXISTS idx_task_revisions_student_task
  ON task_submission_revisions(student_id, task_id, created_at);
