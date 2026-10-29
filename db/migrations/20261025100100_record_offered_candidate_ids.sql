-- The review set the server offered, recorded with the review itself; a
-- contributor's decision still records the IDs they saw.
ALTER TABLE nearhood.report_processing
  ADD COLUMN offered_candidate_ids text[] NOT NULL DEFAULT ARRAY[]::text[];
