-- A contributor who can't tell may publish their Report on its own (ADR 0008).
ALTER TABLE nearhood.report_processing
  DROP CONSTRAINT report_processing_decision_source_check,
  ADD CONSTRAINT report_processing_decision_source_check
    CHECK (decision_source IS NULL OR decision_source IN ('model_no_match', 'contributor_confirmed', 'contributor_rejected_candidates', 'contributor_unsure'));

-- A suggestion that two Happenings may describe one situation, made of
-- attributed statements. A connection never changes membership or claims.
CREATE TABLE nearhood.happening_connections (
  id text PRIMARY KEY,
  happening_low text NOT NULL REFERENCES nearhood.happenings(id),
  happening_high text NOT NULL REFERENCES nearhood.happenings(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  CHECK (happening_low < happening_high),
  UNIQUE (happening_low, happening_high)
);
CREATE INDEX happening_connections_high_idx ON nearhood.happening_connections(happening_high);

-- Append-only. People speak only through their own Report's matching answer.
CREATE TABLE nearhood.connection_statements (
  id text PRIMARY KEY,
  connection_id text NOT NULL REFERENCES nearhood.happening_connections(id),
  source text NOT NULL CHECK (source IN ('automatic_matching', 'contributor')),
  kind text NOT NULL CHECK (kind IN ('possibly_same', 'unsure', 'different')),
  report_id text NOT NULL REFERENCES nearhood.reports(id),
  contributor_id text REFERENCES nearhood.contributors(id),
  matching_version text,
  snapshot_fingerprint text,
  evidence_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  partial_evidence boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, report_id, source, kind),
  CHECK (
    (source = 'automatic_matching' AND kind = 'possibly_same' AND contributor_id IS NULL)
    OR (source = 'contributor' AND kind IN ('unsure', 'different') AND contributor_id IS NOT NULL
      AND matching_version IS NULL AND reason IS NULL)
  )
);

ALTER TABLE nearhood.happening_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearhood.connection_statements ENABLE ROW LEVEL SECURITY;

-- A version that only records a displayed connection copies claims unchanged.
ALTER TABLE nearhood.shared_accounts
  DROP CONSTRAINT shared_accounts_origin_check,
  ADD CONSTRAINT shared_accounts_origin_check
    CHECK (origin IN ('seed_fixture', 'model_derived', 'connection_update'));
