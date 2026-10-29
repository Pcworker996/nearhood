-- A contributor moves their own Report between connected Happenings (ADR 0008).
-- An emptied Happening redirects to where its last Report went; IDs are never reused.
ALTER TABLE nearhood.happenings
  ADD COLUMN redirect_to text REFERENCES nearhood.happenings(id);

CREATE TABLE nearhood.membership_changes (
  id text PRIMARY KEY,
  report_id text NOT NULL REFERENCES nearhood.reports(id),
  from_happening_id text NOT NULL REFERENCES nearhood.happenings(id),
  to_happening_id text NOT NULL REFERENCES nearhood.happenings(id),
  actor_id text NOT NULL REFERENCES nearhood.contributors(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE nearhood.membership_changes ENABLE ROW LEVEL SECURITY;

ALTER TABLE nearhood.shared_accounts
  DROP CONSTRAINT shared_accounts_origin_check,
  ADD CONSTRAINT shared_accounts_origin_check
    CHECK (origin IN ('seed_fixture', 'model_derived', 'connection_update', 'membership_change'));
