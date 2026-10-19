ALTER TABLE nearhood.report_processing
  DROP CONSTRAINT report_processing_state_check;

ALTER TABLE nearhood.report_processing
  ADD CONSTRAINT report_processing_state_check
    CHECK (state IN ('saved', 'processing', 'pending', 'match_review', 'clarification', 'published')),
  ADD COLUMN candidate_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN candidate_packet jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN recommendation jsonb,
  ADD COLUMN extraction jsonb,
  ADD COLUMN matching_outcome text,
  ADD COLUMN decision_source text,
  ADD COLUMN decision_actor text REFERENCES nearhood.contributors(id),
  ADD COLUMN decision_at timestamptz,
  DROP COLUMN clearly_new;

ALTER TABLE nearhood.report_processing
  ADD CONSTRAINT report_processing_matching_outcome_check
    CHECK (matching_outcome IS NULL OR matching_outcome IN ('matched', 'create_new')),
  ADD CONSTRAINT report_processing_decision_source_check
    CHECK (decision_source IS NULL OR decision_source IN ('model_no_match', 'contributor_confirmed', 'contributor_rejected_candidates')),
  ADD CONSTRAINT report_processing_decision_consistency_check
    CHECK (
      (matching_outcome IS NULL AND decision_source IS NULL AND decision_actor IS NULL AND decision_at IS NULL)
      OR
      (matching_outcome IS NOT NULL AND decision_source IS NOT NULL AND decision_at IS NOT NULL
        AND ((decision_source = 'model_no_match' AND decision_actor IS NULL)
          OR (decision_source <> 'model_no_match' AND decision_actor IS NOT NULL)))
    );
