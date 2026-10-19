ALTER TABLE nearhood.report_processing
  ADD COLUMN decision_candidate_ids text[] NOT NULL DEFAULT ARRAY[]::text[];
