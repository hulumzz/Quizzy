-- Hide partially persisted snapshots until all participant/answer batches succeed.
ALTER TABLE live_quiz_sessions ADD COLUMN persistence_status TEXT NOT NULL
  DEFAULT 'complete' CHECK(persistence_status IN ('pending','complete'));
