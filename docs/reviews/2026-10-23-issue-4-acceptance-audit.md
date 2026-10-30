# Acceptance audit — Report intake and matching (#4)

Issue: [#4](../issues/4.md), revised acceptance criteria of October 21.
Baseline: local `main` at `2d08682` plus uncommitted edits, including `report-extraction-v6` in `src/lib/report-model.ts`. Not pushed; `origin/main` is `ee04cd6` and does not contain #4.
Providers: controlled fixtures only. No Nebius, Google, hosted database or Vercel call was made for this record.

## Commands and results

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run test:model` | 3/3 |
| `npm run test:extraction` | 1/1 |
| `npx playwright test` against the long-lived `nearhood_test` database | 58/60. Both failures are `selecting a map marker opens its preview even when highlights are collapsed`: a published "Report near Eastbank footbridge" Happening, created by an earlier run's empty-search test at the same coordinates, intercepts the click. |
| Same suite against a new empty database, then again on that database | 60/60, then 60/60 |
| `npm run verify` | typecheck, both unit suites and 60/60 browser tests on a disposable database |

`npm run verify` (`scripts/verify-local.sh`) is the rerunnable local gate. It creates and drops its own database, so results do not depend on data accumulated in `nearhood_test`. `next dev` 16.4.0 exits on alternate launches to print a security advisory; the script retries only that case.

## Verdict per criterion

Verdicts: **met** means code implements it and a test asserts it. **Gaps** means implemented with untested or missing sub-clauses. **Not met** means code contradicts the criterion or the behavior is absent. **Live** means only a real provider or hosted run can close it.

| # | Criterion (short) | Ticket | Audit | Main gap |
| --- | --- | --- | --- | --- |
| 1 | Freeze versioned schemas, payloads, bounds | done | gaps | Prompt text is not versioned separately from the schema name. Size limits are not asserted. |
| 2 | Call 1 extraction semantics | open | not met | `timeWording` accepts any substring of the Report. Disclaimed conditions are rejected only by prompt text. v6 is unevaluated. |
| 3 | Private checkpoint before matching | done | met | Negative UI checks and "no attachment to the suggested candidate" are untested. |
| 4 | Separate resumable stages | done | not met | Defect 1 and Defect 2. Lease expiry and late completion are untested. |
| 5 | Larger deterministic pool | done | gaps | 1,500 m, ±30 days and hint-as-context are untested at their boundaries. Omitted-candidate coverage is not asserted. |
| 6 | Bounded, deduplicated evidence | done | gaps | Deduplication and identity-evidence selection are untested. |
| 7 | Call 2 contract | done | gaps | No test sends an invented candidate ID from call 2. Conflict handling is live-only. |
| 8 | Review and confirmation | done | gaps | Place, the "view more" alternatives, decision actor and time are untested. Assessed chronology is never shown. |
| 9 | When a first Happening may be created | done | met | Search failure and `unclear_occurrence` have no test. |
| 10 | Disagreement, recurrence, unclear continuity | open | not met | Defect 4 and Defect 5. Partial improvement still fails live. |
| 11 | Provider calls outside transactions, time budget | open | gaps / live | No request-wide deadline. The 25 s abort is untested. The hosted margin is unmeasured. |
| 12 | Real Google, live model, hosted schema, Vercel target | open | live | No captured proof for any live clause. |
| 13 | Baseline versus staged comparison | open | not met | Recall, baseline tokens and end-to-end latency are not recorded. The cited run is v5; a v6 run on disk (7/8, 3/4) is unreviewed. |
| 14 | Browser/API/database journey | open | not met | Missing: partial improvement, genuine conflict, separate problem on one object, injected instructions, lease expiry, obsolete completion. Weak: paraphrases, recurrence, browser reload between stages, cross-owner `/match`, marker selection. `npm run verify` isolates the database; the suite itself does not. |

## Defects

1. **A stale request can erase a newer review.** `processReport` chooses the stage and the `$4` takeover flag from a read made before the lease update (`src/lib/report-processing.ts:26,35,43`). If extraction and matching finish while that request waits for a connection, it leases `match_review` as extraction, makes a second provider call and clears `recommendation`, `candidate_ids` and `assessments`. Fix: derive the stage inside the lease `UPDATE` and return it.
2. **Version skew can overwrite a newer checkpoint.** Versions are compared for equality only (`report-processing.ts:43,80`; `report-submission.ts:153`). During a v5→v6 deploy each version treats the other's checkpoint as not ready and re-extracts over it.
3. **Confirmation validates the choice against a packet read before its transaction** (`report-processing.ts:257,362,374`). A refresh that lands while confirmation waits for the advisory lock lets membership be written to a Happening that is no longer in the current snapshot.
4. **Elapsed time alone creates a Happening.** Retrieval drops a nearby Happening whose observations are all outside ±30 days (`src/lib/report-matching.ts:54-56`). The empty pool becomes `no_match` and publishes. This conflicts with criterion 10.
5. **`separate` with `chronology: conflict` creates a Happening.** The decision reads only continuity (`src/lib/report-model.ts:526-547`).
6. **Non-temporal time wording is accepted** (`report-model.ts:362-380`). For example, `timeWording: "orange barriers"` validates.
7. **A lease that expires leaves no retry reason** (`report-processing.ts:38` sets `pending_reason=NULL`).
8. **The separate-occurrence status line says "matching needs clarification"** although matching never ran (`src/components/contribution.tsx:325-326`).
9. **Docs drift.** ADR 0005 still says 35 s provider timeout while code uses 25 s. The ticket and the stages review report v5 results as current.

## How to verify

Work through the levels in order. Each level assumes the one before it passes.

### Level 1 — local gate, every change

Run `npm run verify`. Pass means four `PASS` lines and `60 passed`. This proves the controlled-service behavior only.

### Level 2 — tests to add, local and deterministic

Each entry names the criterion it closes, the fixture or setup, and the observable assertion.

| Criterion | File | Scenario | Assert |
| --- | --- | --- | --- |
| 4, 14 | `tests/report-stages.spec.ts` | Configurable short lease plus a slow fixture; a second request takes over and finishes before the first returns | Stored extraction and recommendation belong to the second attempt; account version is 1 |
| 4 | same | Defect 1 interleaving: extraction finishes, matching stores `match_review`, then a delayed process request arrives | `recommendation` is unchanged and the fixture saw one extraction call |
| 4 | same | Fixture counts `/chat/completions` per Report | Exactly one provider call per process POST |
| 4 | same | Matching failure | `pendingReason` is `matching_failed` |
| 11 | same | Fixture `hang` with a short configured timeout | Response within timeout + 5 s; `pending` with `extraction_failed` |
| 11 | `tests/contribute.spec.ts` | Two identical `/match` POSTs in parallel; then a second signed-in user posts `/match` | Both 200 and version +1; the stranger gets 404 |
| 2 | `scripts/fixtures/extraction/` | `timeWording: "orange barriers"`; `describedCondition` on a disclaimed part; unsupported `subject` | Each throws a validation error (fails today) |
| 3 | `tests/report-stages.spec.ts` | Separate-situations case | No "Could you clarify?"; `/api/happenings/bridge` unchanged |
| 5 | same | Pins at 1,400 m and 1,600 m; times at ±29 and ±31 days; a farther in-radius hint | Inclusion and exclusion at each edge; hint ordered first |
| 6 | same | Three observations sharing one long Report; early identity Report plus later Reports | Under budget; packet keeps the identity observation and one per Report |
| 7 | same | Call 2 returns an invented candidate ID | `pending`, no Happening |
| 8 | `tests/contribute.spec.ts` | Match review | Location name and distance shown; "View N more" reveals four cards; `decision_actor` and `decision_at` stored |
| 9 | `tests/report-stages.spec.ts` | `occurrenceGroup: null`; retrieval error | `unclear_occurrence` or `pending`; no Happening |
| 10 | same | Defect 4 repro (old Happening at the same spot, observed 31 days ago) | Decide the intended outcome first (see open decisions) |
| 10 | same | `continuity: same, chronology: conflict`, confirm | Both originals on one Happening; no second pin |
| 14 | same | Partial improvement; genuine conflict; separate problem on the same object; injected instructions in candidate evidence; browser reload after `processingStage` becomes `matching` | One Happening or unassigned as specified; injected text is not followed |
| 14 | `tests/browse.spec.ts` | Create an overlapping pending pin, then select the seeded marker | Preview opens (proves the marker fix rather than relying on a clean database) |

### Level 3 — live model, needs `NEBIUS_API_KEY` and `NEBIUS_MODEL`

```sh
npm run model:check
npm run model:check -- --held-out
npm run model:check -- --baseline
npm run model:check -- --baseline --held-out
npm run extraction:live
```

Copy the four `.local/report-model-*.json` files aside before rerunning, because each run overwrites them. A non-zero exit is expected while any case fails. Score from the JSON, per arm and split: candidate recall, wrong merges, misses, unnecessary uncertainty, scope preservation, stage failures, per-call and checker latency, and tokens. Criterion 13 also needs a new held-out set nobody has inspected, and retrieval recall, which the checker does not measure because it supplies the candidate directly.

### Level 4 — hosted and manual

| Criterion | Step | Proof to capture |
| --- | --- | --- |
| 12 | Real Google sign-in from the deployed origin with a typed public name different from the Google profile name | `GET /api/session` shows `signedIn: true` and the typed name, with no email; draft text survives the redirect |
| 12 | Two real Google users | User B gets 404 on `GET` and `POST /api/reports/<A's id>` |
| 12 | Hosted schema: `npm run db:setup` without `--seed` against the hosted `DATABASE_URL` | `SELECT name FROM public.nearhood_migrations ORDER BY 1` lists both 2026-10-22 migrations; `report_processing` and `observations` have RLS and no `anon` grants |
| 12 | Vercel target | Production `DATABASE_URL` host matches the host above; a Report submitted through the deployment is found by ID in that database |
| 11 | 20 hosted process calls with timing logs; one forced provider hang | Longest route under 45 s; the hang returns 504 near 60 s and a retry publishes once |

The deployment must be built from a commit containing #4. Today `origin/main` does not.

## Open product decisions

- **Criterion 5 versus criterion 10.** The ±30-day window excludes old Happenings before comparison, so elapsed time alone creates a new one. Either treat window exclusion as coverage uncertainty, or accept it and narrow criterion 10.
- **Conflict as separation.** Decide whether `separate` with `chronology: conflict` may publish a new Happening or must go to review.
