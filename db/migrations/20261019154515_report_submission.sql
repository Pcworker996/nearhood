-- Server-owned schema; no direct browser grants or auth/email storage.
CREATE TABLE nearhood.report_processing (
  report_id text PRIMARY KEY REFERENCES nearhood.reports(id),
  request_key uuid NOT NULL,
  request_body jsonb NOT NULL,
  contributor_id text NOT NULL REFERENCES nearhood.contributors(id),
  clearly_new boolean NOT NULL,
  candidate_id text REFERENCES nearhood.happenings(id),
  location_name text NOT NULL,
  state text NOT NULL DEFAULT 'saved' CHECK (state IN ('saved', 'processing', 'pending', 'clarification', 'published')),
  attempt uuid,
  lease_until timestamptz,
  happening_id text REFERENCES nearhood.happenings(id),
  model_id text,
  UNIQUE (contributor_id, request_key)
);
CREATE INDEX report_processing_candidate_idx ON nearhood.report_processing(candidate_id);
CREATE INDEX report_processing_happening_idx ON nearhood.report_processing(happening_id);
CREATE INDEX reports_contributor_idx ON nearhood.reports(contributor_id);
CREATE INDEX observations_report_idx ON nearhood.observations(report_id);
CREATE INDEX observation_memberships_observation_idx ON nearhood.observation_memberships(observation_id);
CREATE INDEX claims_account_idx ON nearhood.claims(account_id);
CREATE INDEX claim_supports_observation_idx ON nearhood.claim_supports(observation_id);
ALTER TABLE nearhood.report_processing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nearhood.report_processing FROM PUBLIC;
