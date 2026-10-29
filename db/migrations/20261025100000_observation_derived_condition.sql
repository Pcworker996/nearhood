-- Observations hold derived interpretation. The original Report stays linked
-- through report_id; a part the Report did not describe has no condition.
ALTER TABLE nearhood.observations
  ALTER COLUMN described_state DROP NOT NULL,
  ADD COLUMN uncertainty text;

-- Earlier publications copied the whole Report into described_state. Restore
-- the saved extraction's condition only where that copy is exact and the
-- Observation matches one extracted item. Account history is left unchanged.
WITH extracted AS (
  SELECT o.id, item->>'describedCondition' AS condition,
    item->>'uncertainty' AS uncertainty,
    COUNT(*) OVER (PARTITION BY o.id) AS matches
  FROM nearhood.observations o
  JOIN nearhood.reports r ON r.id=o.report_id
  JOIN nearhood.report_processing p ON p.report_id=o.report_id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(p.extraction->'observations')='array'
      THEN p.extraction->'observations' ELSE '[]'::jsonb END) AS item
  WHERE o.described_state=r.original_text
    AND item->>'subject'=o.subject
    AND (item->>'spatialScope') IS NOT DISTINCT FROM o.spatial_scope
)
UPDATE nearhood.observations o
SET described_state=e.condition, uncertainty=e.uncertainty
FROM extracted e WHERE e.id=o.id AND e.matches=1;
