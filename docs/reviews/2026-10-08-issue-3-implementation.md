# Issue #3 implementation review

Reviewed the implementation from baseline `010ebaa14b8d953ce18f053f33a1bcd7c5186af4` through `6beee29`, against issues #1–#3, the product guardrails and repository standards. Standards and Spec were reviewed independently by parallel agents, then rechecked after fixes.

## Standards

The initial review found one actionable guardrail violation: the picnic's original Report supplied a 4:30 pm start but no end, while derived information asserted a 5:30 pm ending. The implementation now preserves the original words and explicitly leaves the end unknown. A narrowly targeted migration corrects the earlier fixture without overwriting its Report. A browser regression verifies the unknown ending.

A possible duplicated evidence-pair lookup was considered and retained: the database response and client timeline have separate responsibilities. No broader refactor is required for this slice.

The follow-up review confirmed the fix and found no remaining actionable Standards findings.

## Spec

The initial review found two actionable issues: the unsupported picnic ending, and participation labeled as distinct people even though contributors can include organizations. The ending is now unknown and participation is labeled distinct contributors. The follow-up review confirmed both fixes and found no further introduced implementation issues or scope creep.

One acceptance gap remains: hosted Supabase persistence, configured MapTiler street tiles and attribution, and deployment have not been verified. Local PostgreSQL/PostGIS persistence is working; Vercel with Supabase is documented as the hosting plan. Issue #3 remains open with `needs-info`, and later implementation tickets remain blocked by it.

## Verification

`npm run typecheck`, `npm run build` and the full `npm test` suite passed. All 12 browser tests passed across mobile and desktop Chromium, using a real API and an isolated PostgreSQL/PostGIS database. Mobile and desktop layouts were visually inspected; provided SVG assets retain their intrinsic dimensions. Street-map visual verification remains pending a MapTiler key.

Final counts: Standards — 0 actionable findings; Spec — 1 known acceptance gap, hosted database/map/deployment verification. Initial findings were resolved in `6beee29`.
