-- Outside information about one Happening (ADR 0009). Findings are never
-- claims, supports or membership; they record which account version they
-- were compared against so a later account can trigger a fresh check.
CREATE TABLE nearhood.source_checks (
  id text PRIMARY KEY,
  happening_id text NOT NULL REFERENCES nearhood.happenings(id),
  account_version integer NOT NULL,
  query text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  findings jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX source_checks_happening_idx ON nearhood.source_checks(happening_id, checked_at DESC);

-- Spending counters for the public demo: one row per bucket and window.
CREATE TABLE nearhood.discovery_usage (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

ALTER TABLE nearhood.source_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearhood.discovery_usage ENABLE ROW LEVEL SECURITY;
