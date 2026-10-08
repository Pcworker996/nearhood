-- Correct the original demo fixture's unsupported derived end time.
-- Preserve the contributor's original Report; only known fixture interpretations change.
UPDATE nearhood.happenings h SET ends_at = NULL
WHERE h.id = 'picnic' AND h.demo AND h.ends_at = '2026-10-08T21:30:00Z'
  AND (SELECT origin FROM nearhood.shared_accounts WHERE happening_id=h.id ORDER BY version DESC LIMIT 1) = 'seed_fixture';

UPDATE nearhood.observations SET described_state = 'Stretch and picnic announced for October 8, 4:30 pm Detroit time; end time unknown'
WHERE id = 'picnic-plan' AND report_id = 'picnic-organizer'
  AND described_state = 'Stretch and picnic announced for October 8, 4:30–5:30 pm Detroit time';

UPDATE nearhood.claims SET statement = 'A stretch-and-picnic activity was announced for October 8 at 4:30 pm.'
WHERE id = 'picnic-claim' AND account_id = 'picnic-v1'
  AND statement = 'A stretch-and-picnic activity was announced for October 8, 4:30–5:30 pm.'
  AND EXISTS (SELECT 1 FROM nearhood.shared_accounts WHERE id='picnic-v1' AND origin='seed_fixture');
