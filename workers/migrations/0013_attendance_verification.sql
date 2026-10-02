-- Migration 0013: attendance verification mode and method
-- Adds verification_mode to attendance_sessions and verification_method to attendance_checkins.
-- Default 'standard' ensures all existing data remains valid without any backfill.

ALTER TABLE attendance_sessions
  ADD COLUMN verification_mode TEXT NOT NULL
  DEFAULT 'standard'
  CHECK(verification_mode IN ('standard','face_optional','face_required'));

ALTER TABLE attendance_checkins
  ADD COLUMN verification_method TEXT NOT NULL
  DEFAULT 'standard'
  CHECK(verification_method IN ('standard','face'));
