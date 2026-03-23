CREATE TABLE IF NOT EXISTS events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT    NOT NULL,
  key             TEXT,
  tier            INTEGER,
  event           TEXT    NOT NULL,
  ts              TEXT    NOT NULL,
  country         TEXT,
  city            TEXT,
  referer         TEXT,
  ua              TEXT,
  cf_threat_score INTEGER,
  has_js          INTEGER DEFAULT 0,
  payload         TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_key     ON events(key);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_ts      ON events(ts);

CREATE TABLE IF NOT EXISTS referral_keys (
  key         TEXT PRIMARY KEY,
  label       TEXT,
  company     TEXT,
  role        TEXT,
  channel     TEXT,
  created_at  TEXT,
  sent_at     TEXT,
  active      INTEGER DEFAULT 1
);