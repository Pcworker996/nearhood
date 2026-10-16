-- Fixed, fictional fixtures. These accounts were written for the demo, not by a live model.
INSERT INTO nearhood.contributors VALUES
 ('mara', 'Mara L.'), ('market', 'Riverside market team'), ('jules', 'Jules R.'), ('organizer', 'Canal Green organizers'),
 ('rhea', 'Rhea M.'), ('omar', 'Omar T.'), ('imani', 'Imani S.'), ('garden-organizer', 'Mina K.')
ON CONFLICT DO NOTHING;
INSERT INTO nearhood.reports VALUES
 ('bridge-mara', 'mara', 'Both entrances have orange barriers across the path. I had to turn back.', '2026-10-08T19:12:00Z', '2026-10-08T19:20:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0457,42.3328),4326)::extensions.geography),
 ('bridge-market', 'market', 'We saw the closure from the south entrance. No posted reopening time yet.', '2026-10-08T19:18:00Z', '2026-10-08T19:22:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0457,42.3328),4326)::extensions.geography),
 ('lamp-jules', 'jules', 'Last night the lamp on the northwest corner was dark. I do not know when it stopped working.', '2026-10-08T01:30:00Z', '2026-10-08T18:48:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.052,42.3298),4326)::extensions.geography),
 ('picnic-organizer', 'organizer', 'Open-air stretch at 4:30 pm on October 8, followed by a picnic. Meet by the west gate. Bring a mat or towel; all levels welcome.', NULL, '2026-10-08T14:05:00Z', 'source_based', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0513,42.3352),4326)::extensions.geography),
 ('path-north-rhea', 'rhea', 'Water covered the curb-level route across the north ramp around 8:20 am. I could step around along the grass edge, but I cannot say whether the full path is passable for everyone.', '2026-10-12T12:20:00Z', '2026-10-12T13:03:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0501,42.3330),4326)::extensions.geography),
 ('path-south-omar', 'omar', 'I used the south entrance around 11:10 am and the pavement there looked dry. I did not check the north ramp.', '2026-10-12T15:10:00Z', '2026-10-12T15:18:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0498,42.3326),4326)::extensions.geography),
 ('signal-rhea', 'rhea', 'At the east crossing, the walk indication did not come on until the second cycle around 8:10 am.', '2026-10-12T12:10:00Z', '2026-10-12T12:16:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0540,42.3338),4326)::extensions.geography),
 ('signal-imani', 'imani', 'At noon, I used the same east crossing and the walk indication came on in the next cycle.', '2026-10-12T16:00:00Z', '2026-10-12T16:08:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0540,42.3338),4326)::extensions.geography),
 ('garden-plan', 'garden-organizer', 'I am planning a volunteer garden cleanup at the west beds on Tuesday, October 13, from 5:30 to 7:00 pm. This is a plan; it has not happened yet.', NULL, '2026-10-12T15:00:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0480,42.3294),4326)::extensions.geography)
ON CONFLICT DO NOTHING;
INSERT INTO nearhood.observations VALUES
 ('bridge-both', 'bridge-mara', 'Bridge entrances', 'Barriers across the path', 'Both entrances', '2026-10-08T19:12:00Z'),
 ('bridge-south', 'bridge-market', 'Bridge entrance', 'Closure observed', 'South entrance', '2026-10-08T19:18:00Z'),
 ('bridge-no-time', 'bridge-market', 'Reopening information', 'No posted reopening time observed', 'South entrance', '2026-10-08T19:18:00Z'),
 ('lamp-dark', 'lamp-jules', 'Streetlamp', 'Dark after nightfall', 'Northwest corner', '2026-10-08T01:30:00Z'),
 ('picnic-plan', 'picnic-organizer', 'Scheduled activity', 'Stretch and picnic announced for October 8, 4:30 pm Detroit time; end time unknown', 'West gate', NULL),
 ('path-north-water', 'path-north-rhea', 'North ramp surface', 'Standing water crossed the curb-level route', 'North ramp', '2026-10-12T12:20:00Z'),
 ('path-south-dry', 'path-south-omar', 'South entrance surface', 'Pavement appeared dry', 'South entrance', '2026-10-12T15:10:00Z'),
 ('signal-delayed', 'signal-rhea', 'Walk signal', 'Walk indication appeared on the second cycle', 'East crossing', '2026-10-12T12:10:00Z'),
 ('signal-normal', 'signal-imani', 'Walk signal', 'Walk indication appeared on the next cycle', 'East crossing', '2026-10-12T16:00:00Z'),
 ('garden-scheduled', 'garden-plan', 'Volunteer garden cleanup', 'Scheduled for October 13, 5:30–7:00 pm Detroit time', 'West beds', NULL)
ON CONFLICT DO NOTHING;
INSERT INTO nearhood.happenings VALUES
 ('bridge', 'Eastbank footbridge closure', 'disruption', 'Eastbank footbridge', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0457,42.3328),4326)::extensions.geography, 'Reports received', true, NULL, NULL),
 ('lamp', 'Streetlamp outage on Alder at 3rd', 'safety', 'Alder St & 3rd Ave', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.052,42.3298),4326)::extensions.geography, 'Reports received', true, NULL, NULL),
 ('picnic', 'Canal Green stretch & picnic', 'activity', 'Canal Green · west gate', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0513,42.3352),4326)::extensions.geography, 'Reports received', true, '2026-10-08T20:30:00Z', NULL),
 ('path-water', 'Water reported at one riverside path ramp', 'disruption', 'Northbank riverside path', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0500,42.3328),4326)::extensions.geography, 'Reports received', true, NULL, NULL),
 ('crossing-signal', 'Walk signal timing at east crossing', 'safety', 'Northbank · east crossing', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0540,42.3338),4326)::extensions.geography, 'Reports received', true, NULL, NULL),
 ('garden-cleanup', 'Volunteer garden cleanup scheduled', 'activity', 'Northbank garden · west beds', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0480,42.3294),4326)::extensions.geography, 'Reports received', true, '2026-10-13T21:30:00Z', '2026-10-13T23:00:00Z')
ON CONFLICT DO NOTHING;
INSERT INTO nearhood.observation_memberships VALUES
 ('bridge','bridge-both'),('bridge','bridge-south'),('bridge','bridge-no-time'),('lamp','lamp-dark'),('picnic','picnic-plan'),
 ('path-water','path-north-water'),('path-water','path-south-dry'),
 ('crossing-signal','signal-delayed'),('crossing-signal','signal-normal'),
 ('garden-cleanup','garden-scheduled')
ON CONFLICT DO NOTHING;
INSERT INTO nearhood.shared_accounts VALUES
 ('bridge-v1','bridge',1,'2026-10-08T19:23:00Z','seed_fixture',ARRAY['The cause and reopening time are unknown.','These October 8 observations do not establish current conditions.']),
 ('lamp-v1','lamp',1,'2026-10-08T18:49:00Z','seed_fixture',ARRAY['The cause and repair timing are unknown.','One dated after-dark observation does not establish today’s condition.']),
 ('picnic-v1','picnic',1,'2026-10-08T14:06:00Z','seed_fixture',ARRAY['This is an announced plan, not evidence that the activity occurred.','Observation time unknown for the source-based announcement.']),
 ('path-water-v1','path-water',1,'2026-10-12T15:20:00Z','seed_fixture',ARRAY['The later report covers the south entrance only. Whether the north ramp is clear or the entire path is accessible now remains unknown.']),
 ('crossing-signal-v1','crossing-signal',1,'2026-10-12T16:10:00Z','seed_fixture',ARRAY['These two observations do not establish whether the signal is consistently delayed or what its current timing is.']),
 ('garden-cleanup-v1','garden-cleanup',1,'2026-10-12T15:01:00Z','seed_fixture',ARRAY['The schedule does not establish that the activity will take place.'])
ON CONFLICT DO NOTHING;
INSERT INTO nearhood.claims VALUES
 ('bridge-barriers','bridge-v1','Barriers were observed at both bridge entrances.',1),
 ('bridge-reopening','bridge-v1','No reopening time was posted at the south entrance.',2),
 ('lamp-claim','lamp-v1','One streetlamp was reported dark after nightfall at the northwest corner.',1),
 ('picnic-claim','picnic-v1','A stretch-and-picnic activity was announced for October 8 at 4:30 pm.',1),
 ('path-water-north-claim','path-water-v1','Standing water was reported across the north ramp curb-level route at 8:20 am.',1),
 ('path-water-south-claim','path-water-v1','The south entrance pavement was reported dry at 11:10 am.',2),
 ('signal-delay-claim','crossing-signal-v1','The walk indication appeared on the second cycle at 8:10 am.',1),
 ('signal-normal-claim','crossing-signal-v1','The walk indication appeared on the next cycle at noon.',2),
 ('garden-plan-claim','garden-cleanup-v1','A volunteer garden cleanup was scheduled for October 13, 5:30–7:00 pm.',1)
ON CONFLICT DO NOTHING;
INSERT INTO nearhood.claim_supports VALUES
 ('bridge-barriers','bridge-both'),('bridge-reopening','bridge-no-time'),('lamp-claim','lamp-dark'),('picnic-claim','picnic-plan'),
 ('path-water-north-claim','path-north-water'),('path-water-south-claim','path-south-dry'),
 ('signal-delay-claim','signal-delayed'),('signal-normal-claim','signal-normal'),
 ('garden-plan-claim','garden-scheduled')
ON CONFLICT DO NOTHING;
