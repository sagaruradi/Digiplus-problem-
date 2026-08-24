-- Log Storage Schema with Anomaly and AI Explanation Metadata
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  eventType TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  isAnomaly INTEGER NOT NULL DEFAULT 0,
  anomalyScore REAL NOT NULL DEFAULT 0.0,
  anomalyReason TEXT,
  createdAt TEXT NOT NULL,
  aiExplanation TEXT,
  aiRootCause TEXT,
  aiNextStep TEXT,
  aiGeneratedAt TEXT
);

-- Indexing for fast search, filter and anomaly monitoring
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_isAnomaly ON logs(isAnomaly);
CREATE INDEX IF NOT EXISTS idx_logs_severity ON logs(severity);
CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source);
CREATE INDEX IF NOT EXISTS idx_logs_eventType ON logs(eventType);
