-- Migration 0014: permanent student name snapshot in quiz_attempts
-- Adds nullable student_name column. Nullable because historical attempts
-- may have lost their membership row.

ALTER TABLE quiz_attempts
  ADD COLUMN student_name TEXT;

-- Best-effort backfill from current class_members.
-- Rows where membership is already gone will remain NULL (fallback handled in application layer).
UPDATE quiz_attempts
SET student_name = (
  SELECT cm.name
  FROM class_members cm
  WHERE cm.class_id = quiz_attempts.class_id
    AND cm.user_id = quiz_attempts.student_id
  LIMIT 1
)
WHERE student_name IS NULL;
