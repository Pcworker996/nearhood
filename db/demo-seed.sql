-- Fictional everyday neighbourhood scenarios for the hosted demo. People, places
-- and events are invented; the accounts were written for the demo, not by a live
-- model. Browser tests use db/seed.sql instead.
INSERT INTO nearhood.contributors (id, display_name) VALUES
 ('demo-noah', 'Noah P.'), ('demo-priya', 'Priya S.'), ('demo-lee', 'Lee K.'),
 ('demo-sam', 'Sam O.'), ('demo-tomas', 'Tomás R.'), ('demo-ana', 'Ana G.'),
 ('demo-grace', 'Grace H.'), ('demo-ken', 'Ken M.'),
 ('demo-maya', 'Maya D.'), ('demo-oscar', 'Oscar B.'),
 ('demo-jo', 'Jo W.'), ('demo-ravi', 'Ravi N.'),
 ('demo-bea', 'Bea F.'), ('demo-elm-hall', 'Elm Hall volunteers')
ON CONFLICT DO NOTHING;

INSERT INTO nearhood.reports (id, contributor_id, original_text, observed_at, submitted_at, provenance, source_url, location) VALUES
 ('demo-dogs-noah', 'demo-noah', 'Two large dogs were running off leash on the Canal Green lawn near the playground around 7:40 this morning. One chased a kid on a scooter. The owner was over on the far path and took a while to call them back.', '2026-10-29T11:40:00Z', '2026-10-29T11:52:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0513,42.3352),4326)::extensions.geography),
 ('demo-dogs-priya', 'demo-priya', 'Around 5:15 pm a brown dog was off leash by the pond. The owner leashed it when I asked. I don''t know if it was one of the dogs from this morning.', '2026-10-29T21:15:00Z', '2026-10-29T21:30:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0506,42.3356),4326)::extensions.geography),
 ('demo-dogs-lee', 'demo-lee', 'Walked through Canal Green at 7:30 this morning. The two dogs near the playground were on long retractable leads, not loose.', '2026-10-30T11:30:00Z', '2026-10-30T11:45:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0513,42.3351),4326)::extensions.geography),
 ('demo-crash-sam', 'demo-sam', 'Two-car crash at Alder and 3rd just now. Both cars are stopped in the northbound lanes and traffic is backing up. Police just arrived. I couldn''t see if anyone was hurt.', '2026-10-30T12:05:00Z', '2026-10-30T12:10:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0520,42.3298),4326)::extensions.geography),
 ('demo-crash-tomas', 'demo-tomas', 'Tow truck is loading one of the cars. One northbound lane is open again, the other is still blocked by a police car.', '2026-10-30T12:40:00Z', '2026-10-30T12:44:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0520,42.3297),4326)::extensions.geography),
 ('demo-crash-ana', 'demo-ana', 'Drove through Alder and 3rd at 9:30, both northbound lanes are open. There''s still glass in the right lane near the curb.', '2026-10-30T13:30:00Z', '2026-10-30T13:35:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0521,42.3298),4326)::extensions.geography),
 ('demo-water-grace', 'demo-grace', 'Water is bubbling up through the pavement on Birch between 4th and 5th and running down the gutter toward 5th. Not sure if it''s a main break.', '2026-10-29T22:20:00Z', '2026-10-29T22:31:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0430,42.3365),4326)::extensions.geography),
 ('demo-water-ken', 'demo-ken', 'There''s a city water department notice taped to the barricade: emergency repair, Birch Ave closed between 4th and 5th, expected through Monday, November 2.', '2026-10-30T13:00:00Z', '2026-10-30T13:10:00Z', 'source_based', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0432,42.3365),4326)::extensions.geography),
 ('demo-power-maya', 'demo-maya', 'Power went out on our side of Linden St around 6:15 pm. The streetlights on the block are dark too.', '2026-10-29T22:15:00Z', '2026-10-29T22:20:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0590,42.3310),4326)::extensions.geography),
 ('demo-power-oscar', 'demo-oscar', 'Our power on the west end of Linden came back at 7:40. I can see houses near 6th Ave still look dark.', '2026-10-29T23:40:00Z', '2026-10-29T23:45:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0598,42.3310),4326)::extensions.geography),
 ('demo-breakin-jo', 'demo-jo', 'Woke up to my car''s passenger window smashed on Oak St near the corner of 2nd. Nothing was taken that I can tell. It was fine when I parked at 10 last night.', NULL, '2026-10-30T11:05:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0395,42.3280),4326)::extensions.geography),
 ('demo-breakin-ravi', 'demo-ravi', 'Same here on Oak St, a few cars down from 2nd. Rear window broken and the glove box was opened. I parked there overnight.', NULL, '2026-10-30T12:20:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0391,42.3281),4326)::extensions.geography),
 ('demo-pothole-bea', 'demo-bea', 'Big pothole in the eastbound lane of Cedar Ave just past the school crossing. Cars are swerving into the bike lane to avoid it.', '2026-10-28T20:30:00Z', '2026-10-28T20:50:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0560,42.3385),4326)::extensions.geography),
 ('demo-halloween-plan', 'demo-elm-hall', 'Trunk-or-treat in the Elm Hall parking lot on Halloween, Saturday October 31, 5 to 7 pm. Families welcome; decorated cars hand out candy. If it rains we move into the hall gym.', NULL, '2026-10-27T16:00:00Z', 'firsthand', NULL, extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0470,42.3250),4326)::extensions.geography)
ON CONFLICT DO NOTHING;

INSERT INTO nearhood.observations (id, report_id, subject, described_state, spatial_scope, observed_at, uncertainty) VALUES
 ('demo-dogs-morning', 'demo-dogs-noah', 'Dogs near the playground', 'Two large dogs off leash; one chased a child on a scooter', 'Lawn near the playground', '2026-10-29T11:40:00Z', NULL),
 ('demo-dogs-evening', 'demo-dogs-priya', 'Dog by the pond', 'Off leash; leashed when the owner was asked', 'Pond edge', '2026-10-29T21:15:00Z', 'Whether this was one of the morning dogs is unknown.'),
 ('demo-dogs-leashed', 'demo-dogs-lee', 'Dogs near the playground', 'Two dogs on long retractable leads, not loose', 'Near the playground', '2026-10-30T11:30:00Z', NULL),
 ('demo-crash-blocked', 'demo-crash-sam', 'Northbound lanes', 'Two stopped cars after a collision; traffic backing up; police on scene', 'Alder St & 3rd Ave, northbound', '2026-10-30T12:05:00Z', 'Whether anyone was hurt could not be seen.'),
 ('demo-crash-one-lane', 'demo-crash-tomas', 'Northbound lanes', 'One lane open; the other blocked by a police car while a tow truck loaded a car', 'Alder St & 3rd Ave, northbound', '2026-10-30T12:40:00Z', NULL),
 ('demo-crash-open', 'demo-crash-ana', 'Northbound lanes', 'Both lanes open', 'Alder St & 3rd Ave, northbound', '2026-10-30T13:30:00Z', NULL),
 ('demo-crash-glass', 'demo-crash-ana', 'Right lane near the curb', 'Broken glass still on the road', 'Northbound right lane', '2026-10-30T13:30:00Z', NULL),
 ('demo-water-bubbling', 'demo-water-grace', 'Pavement on Birch Ave', 'Water rising through the pavement and running down the gutter', 'Between 4th and 5th', '2026-10-29T22:20:00Z', 'The contributor was unsure whether a water main broke.'),
 ('demo-water-notice', 'demo-water-ken', 'Posted city notice', 'Notice says emergency repair; street closed between 4th and 5th; expected through Monday, November 2', 'Barricade on Birch Ave', '2026-10-30T13:00:00Z', NULL),
 ('demo-power-out', 'demo-power-maya', 'Household power and streetlights', 'Out from about 6:15 pm', 'One side of Linden St (side not specified)', '2026-10-29T22:15:00Z', NULL),
 ('demo-power-west-back', 'demo-power-oscar', 'Household power', 'Restored at 7:40 pm', 'West end of Linden St', '2026-10-29T23:40:00Z', NULL),
 ('demo-power-east-dark', 'demo-power-oscar', 'Houses near 6th Ave', 'Appeared dark', 'Linden St near 6th Ave', '2026-10-29T23:40:00Z', 'Seen from a distance, not confirmed with residents.'),
 ('demo-breakin-1', 'demo-breakin-jo', 'Parked car', 'Passenger window smashed; nothing missing as far as the owner can tell', 'Oak St near 2nd Ave', NULL, 'Happened sometime between 10 pm and the morning.'),
 ('demo-breakin-2', 'demo-breakin-ravi', 'Parked car', 'Rear window broken; glove box opened', 'Oak St, a few cars from 2nd Ave', NULL, 'Happened overnight; exact time unknown.'),
 ('demo-pothole', 'demo-pothole-bea', 'Road surface', 'Large pothole; cars swerving into the bike lane', 'Cedar Ave eastbound, past the school crossing', '2026-10-28T20:30:00Z', NULL),
 ('demo-halloween', 'demo-halloween-plan', 'Trunk-or-treat', 'Scheduled for October 31, 5–7 pm Detroit time; rain plan is the hall gym', 'Elm Hall parking lot', NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO nearhood.happenings (id, title, category, location_name, location, status, demo, starts_at, ends_at) VALUES
 ('demo-dogs', 'Dogs off leash at Canal Green playground', 'safety', 'Canal Green · playground lawn', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0513,42.3352),4326)::extensions.geography, 'Reports received', true, NULL, NULL),
 ('demo-crash', 'Two-car collision at Alder & 3rd', 'disruption', 'Alder St & 3rd Ave', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0520,42.3298),4326)::extensions.geography, 'Reports received', true, NULL, NULL),
 ('demo-water', 'Water leak and street closure on Birch Ave', 'disruption', 'Birch Ave · 4th to 5th', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0431,42.3365),4326)::extensions.geography, 'Reports received', true, NULL, NULL),
 ('demo-power', 'Power outage on Linden St', 'disruption', 'Linden St', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0594,42.3310),4326)::extensions.geography, 'Reports received', true, NULL, NULL),
 ('demo-breakins', 'Car windows broken overnight on Oak St', 'safety', 'Oak St near 2nd Ave', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0393,42.3280),4326)::extensions.geography, 'Reports received', true, NULL, NULL),
 ('demo-pothole', 'Pothole on Cedar Ave near the school crossing', 'safety', 'Cedar Ave · school crossing', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0560,42.3385),4326)::extensions.geography, 'Reports received', true, NULL, NULL),
 ('demo-halloween', 'Trunk-or-treat at Elm Hall', 'activity', 'Elm Hall parking lot', extensions.ST_SetSRID(extensions.ST_MakePoint(-83.0470,42.3250),4326)::extensions.geography, 'Reports received', true, '2026-10-31T21:00:00Z', '2026-10-31T23:00:00Z')
ON CONFLICT DO NOTHING;

INSERT INTO nearhood.observation_memberships (happening_id, observation_id) VALUES
 ('demo-dogs','demo-dogs-morning'),('demo-dogs','demo-dogs-evening'),('demo-dogs','demo-dogs-leashed'),
 ('demo-crash','demo-crash-blocked'),('demo-crash','demo-crash-one-lane'),('demo-crash','demo-crash-open'),('demo-crash','demo-crash-glass'),
 ('demo-water','demo-water-bubbling'),('demo-water','demo-water-notice'),
 ('demo-power','demo-power-out'),('demo-power','demo-power-west-back'),('demo-power','demo-power-east-dark'),
 ('demo-breakins','demo-breakin-1'),('demo-breakins','demo-breakin-2'),
 ('demo-pothole','demo-pothole'),
 ('demo-halloween','demo-halloween')
ON CONFLICT DO NOTHING;

INSERT INTO nearhood.shared_accounts (id, happening_id, version, published_at, origin, uncertainty) VALUES
 ('demo-dogs-v1','demo-dogs',1,'2026-10-30T11:46:00Z','seed_fixture',ARRAY['Whether the same dogs or owners were involved each time is unknown.','The October 30 report covers one morning; it does not establish that dogs are now kept on leash.']),
 ('demo-crash-v1','demo-crash',1,'2026-10-30T13:36:00Z','seed_fixture',ARRAY['Injuries and the cause of the collision are unknown.','No Report describes the southbound lanes.']),
 ('demo-water-v1','demo-water',1,'2026-10-30T13:11:00Z','seed_fixture',ARRAY['The notice gives an expected date, not a confirmed reopening.','Whether water service to nearby homes is affected is unknown.']),
 ('demo-power-v1','demo-power',1,'2026-10-29T23:46:00Z','seed_fixture',ARRAY['Whether power is restored near 6th Ave is unknown.','The cause of the outage is unknown.']),
 ('demo-breakins-v1','demo-breakins',1,'2026-10-30T12:21:00Z','seed_fixture',ARRAY['When the windows were broken, and by whom, is unknown.','The Reports do not establish whether both cars were damaged at the same time.']),
 ('demo-pothole-v1','demo-pothole',1,'2026-10-28T20:51:00Z','seed_fixture',ARRAY['Whether it has been repaired since October 28 is unknown.']),
 ('demo-halloween-v1','demo-halloween',1,'2026-10-27T16:01:00Z','seed_fixture',ARRAY['This is an announced plan, not evidence that the activity will take place.'])
ON CONFLICT DO NOTHING;

INSERT INTO nearhood.claims (id, account_id, statement, position) VALUES
 ('demo-dogs-claim-morning','demo-dogs-v1','Two dogs were reported off leash near the playground at 7:40 am on October 29; one chased a child on a scooter.',1),
 ('demo-dogs-claim-evening','demo-dogs-v1','A dog was reported off leash by the pond at 5:15 pm and was leashed when the owner was asked.',2),
 ('demo-dogs-claim-leashed','demo-dogs-v1','At 7:30 am on October 30, two dogs near the playground were reported on long leads, not loose.',3),
 ('demo-crash-claim-blocked','demo-crash-v1','A two-car collision blocked the northbound lanes at 8:05 am; police were on scene.',1),
 ('demo-crash-claim-one-lane','demo-crash-v1','By 8:40 am one northbound lane had reopened while a tow truck cleared a car.',2),
 ('demo-crash-claim-open','demo-crash-v1','Both northbound lanes were reported open at 9:30 am, with glass remaining near the right curb.',3),
 ('demo-water-claim-leak','demo-water-v1','Water was reported rising through the pavement on Birch Ave between 4th and 5th at 6:20 pm on October 29.',1),
 ('demo-water-claim-notice','demo-water-v1','A posted city notice describes an emergency repair, with the street closed between 4th and 5th until an expected Monday, November 2.',2),
 ('demo-power-claim-out','demo-power-v1','Power and streetlights were reported out on part of Linden St from about 6:15 pm on October 29.',1),
 ('demo-power-claim-west','demo-power-v1','Power was reported restored at the west end of Linden St at 7:40 pm.',2),
 ('demo-power-claim-east','demo-power-v1','Houses near 6th Ave still appeared dark at 7:40 pm.',3),
 ('demo-breakins-claim-windows','demo-breakins-v1','Two parked cars on Oak St near 2nd Ave were reported with broken windows on the morning of October 30.',1),
 ('demo-breakins-claim-contents','demo-breakins-v1','One owner reported nothing missing; the other found the glove box opened.',2),
 ('demo-pothole-claim','demo-pothole-v1','A large pothole was reported in the eastbound lane past the school crossing on October 28, with cars swerving into the bike lane.',1),
 ('demo-halloween-claim','demo-halloween-v1','A trunk-or-treat was announced for October 31, 5–7 pm, in the Elm Hall parking lot.',1)
ON CONFLICT DO NOTHING;

INSERT INTO nearhood.claim_supports (claim_id, observation_id) VALUES
 ('demo-dogs-claim-morning','demo-dogs-morning'),('demo-dogs-claim-evening','demo-dogs-evening'),('demo-dogs-claim-leashed','demo-dogs-leashed'),
 ('demo-crash-claim-blocked','demo-crash-blocked'),('demo-crash-claim-one-lane','demo-crash-one-lane'),
 ('demo-crash-claim-open','demo-crash-open'),('demo-crash-claim-open','demo-crash-glass'),
 ('demo-water-claim-leak','demo-water-bubbling'),('demo-water-claim-notice','demo-water-notice'),
 ('demo-power-claim-out','demo-power-out'),('demo-power-claim-west','demo-power-west-back'),('demo-power-claim-east','demo-power-east-dark'),
 ('demo-breakins-claim-windows','demo-breakin-1'),('demo-breakins-claim-windows','demo-breakin-2'),
 ('demo-breakins-claim-contents','demo-breakin-1'),('demo-breakins-claim-contents','demo-breakin-2'),
 ('demo-pothole-claim','demo-pothole'),
 ('demo-halloween-claim','demo-halloween')
ON CONFLICT DO NOTHING;
