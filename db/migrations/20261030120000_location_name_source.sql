-- Where a Report's location name came from: typed by the contributor, or a
-- map lookup (pin suggestion or place search) they kept unchanged (#27).
ALTER TABLE nearhood.report_processing
  ADD COLUMN location_name_source text NOT NULL DEFAULT 'contributor'
  CHECK (location_name_source IN ('contributor', 'geocoder'));
