CREATE TABLE attendance_sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  session_id TEXT,
  location_mode TEXT NOT NULL CHECK (location_mode IN ('online', 'on_site')),
  latitude REAL,
  longitude REAL,
  radius_meters INTEGER,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'ended')),
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  CHECK ((location_mode = 'online' AND latitude IS NULL AND longitude IS NULL AND radius_meters IS NULL) OR (location_mode = 'on_site' AND latitude IS NOT NULL AND longitude IS NOT NULL AND radius_meters BETWEEN 10 AND 1000))
);
CREATE INDEX idx_attendance_sessions_class_created ON attendance_sessions(class_id, created_at DESC);
CREATE INDEX idx_attendance_sessions_class_status ON attendance_sessions(class_id, status, created_at DESC);

CREATE TABLE attendance_checkins (
  attendance_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  name TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  accuracy_meters REAL,
  distance_meters INTEGER,
  checked_in_at TEXT NOT NULL,
  PRIMARY KEY (attendance_id, user_id),
  FOREIGN KEY (attendance_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_attendance_checkins_attendance ON attendance_checkins(attendance_id, checked_in_at ASC);
