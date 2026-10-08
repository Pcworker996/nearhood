-- Fixed, fictional fixtures. These accounts were written for the demo, not by a live model.
INSERT INTO nearhood.contributors VALUES ('mara', 'Mara L.'), ('market', 'Riverside market team'), ('jules', 'Jules R.'), ('organizer', 'Canal Green organizers') ON CONFLICT DO NOTHING;
INSERT INTO nearhood.reports VALUES
 ('bridge-mara', 'mara', 'Both entrances have orange barriers across the path. I had to turn back.', '2026-10-08T19:12:00Z', '2026-10-08T19:20:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0457,42.3328),4326)::extensions.geography),
 ('bridge-market', 'market', 'We saw the closure from the south entrance. No posted reopening time yet.', '2026-10-08T19:18:00Z', '2026-10-08T19:22:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0457,42.3328),4326)::extensions.geography),
 ('lamp-jules', 'jules', 'Last night the lamp on the northwest corner was dark. I do not know when it stopped working.', '2026-10-08T01:30:00Z', '2026-10-08T18:48:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.052,42.3298),4326)::extensions.geography),
 ('picnic-organizer', 'organizer', 'Open-air stretch at 4:30 pm on October 8, followed by a picnic. Meet by the west gate. Bring a mat or towel; all levels welcome.', NULL, '2026-10-08T14:05:00Z', 'source_based', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0513,42.3352),4326)::extensions.geography)
ON CONFLICT DO NOTHING;
INSERT INTO nearhood.observations VALUES
 ('bridge-both', 'bridge-mara', 'Bridge entrances', 'Barriers across the path', 'Both entrances', '2026-10-08T19:12:00Z'),
 ('bridge-south', 'bridge-market', 'Bridge entrance', 'Closure observed', 'South entrance', '2026-10-08T19:18:00Z'),
 ('bridge-no-time', 'bridge-market', 'Reopening information', 'No posted reopening time observed', 'South entrance', '2026-10-08T19:18:00Z'),
 ('lamp-dark', 'lamp-jules', 'Streetlamp', 'Dark after nightfall', 'Northwest corner', '2026-10-08T01:30:00Z'),
 ('picnic-plan', 'picnic-organizer', 'Scheduled activity', 'Stretch and picnic announced for October 8, 4:30 pm Detroit time; end time unknown', 'West gate', NULL)
ON CONFLICT DO NOTHING;
INSERT INTO nearhood.happenings VALUES
 ('bridge', 'Eastbank footbridge closure', 'disruption', 'Eastbank footbridge', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0457,42.3328),4326)::extensions.geography, 'Reports received', true, NULL, NULL),
 ('lamp', 'Streetlamp outage on Alder at 3rd', 'safety', 'Alder St & 3rd Ave', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.052,42.3298),4326)::extensions.geography, 'Reports received', true, NULL, NULL),
 ('picnic', 'Canal Green stretch & picnic', 'activity', 'Canal Green · west gate', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0513,42.3352),4326)::extensions.geography, 'Reports received', true, '2026-10-08T20:30:00Z', NULL)
ON CONFLICT DO NOTHING;
INSERT INTO nearhood.observation_memberships VALUES ('bridge','bridge-both'),('bridge','bridge-south'),('bridge','bridge-no-time'),('lamp','lamp-dark'),('picnic','picnic-plan') ON CONFLICT DO NOTHING;
INSERT INTO nearhood.shared_accounts VALUES
 ('bridge-v1','bridge',1,'2026-10-08T19:23:00Z','seed_fixture',ARRAY['The cause and reopening time are unknown.','These October 8 observations do not establish current conditions.']),
 ('lamp-v1','lamp',1,'2026-10-08T18:49:00Z','seed_fixture',ARRAY['The cause and repair timing are unknown.','One dated after-dark observation does not establish today’s condition.']),
 ('picnic-v1','picnic',1,'2026-10-08T14:06:00Z','seed_fixture',ARRAY['This is an announced plan, not evidence that the activity occurred.','Observation time unknown for the source-based announcement.'])
ON CONFLICT DO NOTHING;
INSERT INTO nearhood.claims VALUES
 ('bridge-barriers','bridge-v1','Barriers were observed at both bridge entrances.',1),
 ('bridge-reopening','bridge-v1','No reopening time was posted at the south entrance.',2),
 ('lamp-claim','lamp-v1','One streetlamp was reported dark after nightfall at the northwest corner.',1),
 ('picnic-claim','picnic-v1','A stretch-and-picnic activity was announced for October 8 at 4:30 pm.',1)
ON CONFLICT DO NOTHING;
INSERT INTO nearhood.claim_supports VALUES ('bridge-barriers','bridge-both'),('bridge-reopening','bridge-no-time'),('lamp-claim','lamp-dark'),('picnic-claim','picnic-plan') ON CONFLICT DO NOTHING;
