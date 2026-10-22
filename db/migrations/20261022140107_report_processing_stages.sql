-- Derived checkpoints stay in the existing private, RLS-enabled processing table.
-- Published evidence and old checkpoints are retained; old reviews require reprocessing.
ALTER TABLE nearhood.report_processing
  ADD COLUMN processing_stage text NOT NULL DEFAULT 'extraction'
    CHECK (processing_stage IN ('extraction', 'matching')),
  ADD COLUMN extraction_version text,
  ADD COLUMN extraction_input text,
  ADD COLUMN extraction_model text,
  ADD COLUMN pending_reason text,
  ADD COLUMN stage_runs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN assessments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN snapshot_fingerprint text,
  ADD COLUMN matching_version text;

UPDATE nearhood.report_processing SET state='pending', pending_reason='refresh_required',
  attempt=NULL, lease_until=NULL
WHERE state <> 'published';
