PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS chain_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'chat_chain',
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  request_json TEXT NOT NULL,
  response_json TEXT,
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  elapsed_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_chain_runs_status ON chain_runs(status);
CREATE INDEX IF NOT EXISTS idx_chain_runs_created ON chain_runs(created_at DESC);
