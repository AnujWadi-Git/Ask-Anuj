-- Visitor records: ONLY what visitors voluntarily provide + session start. No audio, no transcripts.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,            -- ISO-8601 UTC
  name       TEXT,                     -- NULL when skipped
  role       TEXT,                     -- recruiter | engineer | other | NULL
  skipped    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions (started_at DESC);

-- Operational counters only (salted IP hashes / session ids). Purged daily by the app.
CREATE TABLE IF NOT EXISTS rate_limits (
  key    TEXT NOT NULL,
  window TEXT NOT NULL,                -- date or minute stamp, lexicographically sortable
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window)
);
