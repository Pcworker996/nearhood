-- Exact, software-owned source offsets; old evidence remains explicitly unlocalized.
ALTER TABLE nearhood.observations
  ADD COLUMN source_support jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(source_support)='array');
