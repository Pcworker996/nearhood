# Ticket #4 implementation checkpoint

Source: [ticket #4](https://github.com/Pcworker996/nebius-hack/issues/4). Review comparison: `git diff ee04cd6b23418db8a12511c625ea0f395acb4f94...eb39bd8`. Local implementation commits: `9357db4`, `77afcb6`, `eb39bd8`.

## Standards

No documented-standard breaches found. The shared `ReportProcessingState` and `SavedReport` types resolve the earlier lifecycle-contract concern. Full-context claims preserve contributor qualifications, and pending Reports are distinguished from Happenings.

One optional possible Divergent Change remains in `src/components/contribution.tsx`: draft persistence, request recovery, polling, authentication initialization, and form presentation share one component. Extracting recovery behavior could improve maintainability later; deferring that refactor is reasonable for this ticket.

Standards total: **0 hard breaches; 1 optional maintainability finding**.

## Spec

All concrete Spec review findings are resolved in `eb39bd8`:

- Software preserves complete original context in published claims and Observations. The original sentence splitter could lose qualification across an abbreviation; the controlled-model regression reproduced that failure before the correction.
- Model output contains bounded metadata, removing repeated-text output limits for longer multi-scope Reports.
- Saved drafts clear correctly, allowing subsequent contributions at newly selected locations.
- Regression coverage addresses qualification stripping, long multi-scope Reports, supporting references, and successive contributions.

No further concrete issues found in the final re-review. Ticket #4 remains incomplete pending live Google/Nebius verification, exact model selection, and confirmation and implementation of the clarification-answer flow. These outstanding requirements are not waived by the passing tests.

Spec total: **3 implementation findings fixed; 0 remaining concrete bugs found; live integration and clarification requirements incomplete**.

## Verification

- TypeScript passes.
- Production build passes with all new HTTP/auth routes compiled.
- Full suite: **32 passed**, mobile and desktop Chromium, real application HTTP API and PostgreSQL/PostGIS. External Google/Supabase Auth and Nebius responses are controlled HTTP fixtures; the auth fixture verifies the PKCE challenge. There is no application auth bypass or mocked application repository.
- Saved/processing/failure/reload/retry and duplicate/concurrent requests pass. Tests also cover unknown and explicit observation times, chosen public name/private email, cancelled sign-in, source-based reports, multiple scoped Observations, invalid supports, qualification stripping, candidate isolation and cross-contributor authorization.
- Saved-Report failure layouts visually inspected at mobile and desktop widths.
- Direct local catalog checks show RLS enabled on all evidence/processing tables and the migration ledger. Supabase's full advisor cannot run on this standalone PostgreSQL installation without Supabase roles/internal schemas.
- `npm run model:check` correctly stops because `NEBIUS_API_KEY` is absent. No live runtime check, exact model selection or real Google login is claimed. No production migration or deployment was performed.

Setup, endpoint behavior, lifecycle and remaining decisions are in [the implementation document](../implementation-issue-4.md). Existing uncommitted README, ADR, journal and quality-guide changes were left untouched.
