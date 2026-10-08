CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS nearhood;

CREATE TABLE IF NOT EXISTS nearhood.contributors (
  id text PRIMARY KEY,
  display_name text NOT NULL
);
CREATE TABLE IF NOT EXISTS nearhood.reports (
  id text PRIMARY KEY,
  contributor_id text NOT NULL REFERENCES nearhood.contributors(id),
  original_text text NOT NULL,
  observed_at timestamptz,
  submitted_at timestamptz NOT NULL,
  provenance text NOT NULL CHECK (provenance IN ('firsthand', 'source_based')),
  source_url text,
  location extensions.geography(Point, 4326) NOT NULL
);
CREATE TABLE IF NOT EXISTS nearhood.observations (
  id text PRIMARY KEY,
  report_id text NOT NULL REFERENCES nearhood.reports(id),
  subject text NOT NULL,
  described_state text NOT NULL,
  spatial_scope text,
  observed_at timestamptz
);
CREATE TABLE IF NOT EXISTS nearhood.happenings (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('disruption', 'safety', 'activity')),
  location_name text NOT NULL,
  location extensions.geography(Point, 4326) NOT NULL,
  status text NOT NULL DEFAULT 'Reports received',
  demo boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz
);
CREATE INDEX IF NOT EXISTS happenings_location_idx ON nearhood.happenings USING gist(location);
CREATE TABLE IF NOT EXISTS nearhood.observation_memberships (
  happening_id text NOT NULL REFERENCES nearhood.happenings(id),
  observation_id text NOT NULL REFERENCES nearhood.observations(id),
  PRIMARY KEY (happening_id, observation_id)
);
CREATE TABLE IF NOT EXISTS nearhood.shared_accounts (
  id text PRIMARY KEY,
  happening_id text NOT NULL REFERENCES nearhood.happenings(id),
  version integer NOT NULL CHECK (version > 0),
  published_at timestamptz NOT NULL,
  origin text NOT NULL CHECK (origin IN ('seed_fixture', 'model_derived')),
  uncertainty text[] NOT NULL DEFAULT '{}',
  UNIQUE (happening_id, version)
);
CREATE TABLE IF NOT EXISTS nearhood.claims (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES nearhood.shared_accounts(id),
  statement text NOT NULL,
  position integer NOT NULL
);
CREATE TABLE IF NOT EXISTS nearhood.claim_supports (
  claim_id text NOT NULL REFERENCES nearhood.claims(id),
  observation_id text NOT NULL REFERENCES nearhood.observations(id),
  PRIMARY KEY (claim_id, observation_id)
);

-- Browser access is through the read-only application HTTP contracts.
-- Keep evidence tables outside Supabase's public Data API and deny direct access.
ALTER TABLE nearhood.contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearhood.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearhood.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearhood.happenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearhood.observation_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearhood.shared_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearhood.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE nearhood.claim_supports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA nearhood FROM PUBLIC;
