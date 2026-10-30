# Proposal: Fix stale processing, matching rules, and verification gaps for #4

**Status:** Decisions D1 to D5 agreed 2026-10-23. Phases 0 to 3 implemented and locally verified on branch `fix/issue-4-processing` (`7b2eb7b`, `64d746e`, `462fa41`, `9e9fcfd`), not pushed. Phase 4 pending.
**Author / date:** Agent draft for Maoyuan Wang, 2026-10-23.
**Related issues:** [#4](../issues/4.md). Evidence: [acceptance audit](../reviews/2026-10-23-issue-4-acceptance-audit.md).
**Decision requested:** Agree the implementation contract in phases 1 to 3. Decisions D1 to D5 are answered.

Labels used below: **Proposed** means a contract to accept or change. **Illustrative** means a value or wording that can change without changing behavior. **Undecided** means a product call that blocks the phase that depends on it.

## Problem and evidence

The audit of local `2d08682` plus the uncommitted v6 edits found that criteria 4 and 10 are contradicted by code, and that several "done" criteria have untested parts. Defect numbers refer to the audit record.

| Defect | Who is affected | What happens today | Evidence |
| --- | --- | --- | --- |
| 1 | A contributor whose Report is being processed when a delayed request arrives | The delayed request leases the Report using a stage it read before the lease, re-runs extraction and clears the finished review | `processReport` takes `stage` and `$4` from `savedReport` before the lease `UPDATE` (`src/lib/report-processing.ts:26-44`) |
| 2 | Same, during a deploy where two code versions run | Each version treats the other's checkpoint as incompatible and re-extracts over it | Equality-only version checks (`report-processing.ts:43,80`; `report-submission.ts:153`) |
| 3 | A contributor confirming while a refresh completes | The choice is validated against the candidate list read before the transaction | `confirmReportMatch` checks `report.candidates` (`report-processing.ts:360-378`); the locked `SELECT` omits `candidate_packet` (`:294-301`) |
| 4 | Readers of an old Happening; contributors reporting a recurrence | A Happening whose observations are all older than 30 days is excluded before comparison, and the empty pool creates a new Happening | `src/lib/report-matching.ts:54-56`; `report-model.ts:547` |
| 5 | Same | An assessment of `separate` with `chronology: conflict` takes the no-match path and creates a new Happening | `report-model.ts:526-547` |
| 7 | A contributor whose request was cut off | An expired lease shows `pending` with no reason | Lease sets `pending_reason=NULL` (`report-processing.ts:38`); projection `report-submission.ts:118` |
| 8 | A contributor whose Report described separate situations | Status says "matching needs clarification" although matching never ran | `src/components/contribution.tsx:325-326` |
| Marker | Readers | Two published Happenings at the same coordinates: the top marker covers the other, which cannot be clicked. The browser test fails once old test runs leave such a Happening. | Audit test results |

Observed: defects 1, 3 and 4 were confirmed by reading code. Not observed: no interleaving for defects 1 to 3 was reproduced at runtime. They follow from the code order.

## Goal and scope

- **Outcome:** a Report's saved checkpoint and review can only be replaced by work that is current. A contributor's decision is validated against the review set that is actually saved. A new Happening is never created from elapsed time or contradiction alone.
- **Included:** phases 0 to 3 below, and the post-implementation verification plan.
- **Explicitly deferred:**
  - Extraction semantics for criterion 2: non-temporal `timeWording`, disclaimed conditions, and prompt-version hashing. These need the live evaluation in phase 4 to judge.
  - A request-wide deadline for criterion 11 (D5).
  - Showing assessed chronology on the review card.
  - Tests for untested clauses that guard no defect.
  - #5 account reconciliation and #6 richer clarification.
- **Constraints:**
  - Keep Reports and derived extraction separate.
  - The model never writes membership.
  - Uncertainty stays visible rather than becoming a new pin ([product guardrails](../product-guardrails.md); ADRs [0004](../adr/0004-confirm-matches-before-membership.md), [0005](../adr/0005-separate-extraction-from-matching.md)).
  - Tests run through the product boundary, with controlled model responses ([ADR 0003](../adr/0003-test-through-the-product-boundary.md)).
- **Conflict with accepted text:** D2 option B changes criterion 5's "symmetric 30 days" from a filter into an ordering preference.

## Decisions

| ID | Question | Options | Recommendation |
| --- | --- | --- | --- |
| D1 | Guard against version skew (defect 2)? | **A.** Add a numeric revision check to the lease. **B.** Defer, and accept the risk during deploys. | **A.** It is one predicate and one constant, and criterion 4 requires it. |
| D2 | What happens to a nearby Happening outside ±30 days (defect 4)? | **A.** Keep the filter and narrow criterion 10 to "within the comparison window". **B.** Keep radius and cap; time becomes ordering only, so old Happenings reach comparison and elapsed time is context. | **B.** It deletes one predicate and meets criterion 10. Cost: dense areas fill the 20-candidate pool sooner, so more Reports end as `incomplete_coverage` and wait for refresh. |
| D3 | May `separate` with `chronology: conflict` create a Happening (defect 5)? | **A.** Yes, the model's continuity label wins. **B.** No, treat it as plausible but unresolved, so it goes to clarification. | **B.** Criterion 7 forbids treating contradiction as proof of separation, and the two labels contradict each other. |
| D4 | Overlapping markers? | **A.** In #4, isolate test data and add a reproduction marked as a known failure; file a new issue for marker overlap. **B.** Fix overlap in #4, for example a chooser when markers share a position. | **A.** Overlap is a browsing problem from #3 and is not specific to Report processing. |
| D5 | Request-wide deadline (criterion 11)? | **A.** Defer; measure hosted margin in phase 4. **B.** Add a deadline now. | **A.** The typical worst case is about 26 s against 60 s. The risk is pathological database waits, which hosted measurement will show. |

**Agreed 2026-10-23:** D1-A, D2-B, D3-B, D4-A, D5-A.

## Implementation contract

### Phase 0 — baseline (no behavior change)

- **Proposed:** commit the current v6 work, `scripts/verify-local.sh`, the `verify` npm script and the audit record on a branch. This is the starting point for every later diff.
- **Gate:** `npm run verify` passes (60/60 browser tests).

### Phase 1 — processing races (defects 1, 2, 3, 7)

**Data and lifecycle.** No schema change. States stay `saved`, `processing`, `pending`, `match_review`, `clarification` and `published`. The change is who may move a Report into `processing`, and from which data that decision is made.

**Lease contract (Proposed).** The lease decision is made only from the row being updated. The pre-lease `savedReport` read may supply only immutable Report fields, such as the original text, location and times, used to compute `extractionInput`.

```ts
type Stage = "extraction" | "matching";

// Returns the leased stage, or null when the row is not leasable for this request.
async function acquireLease(input: {
  id: string;
  contributorId: string;
  attempt: string;
  refresh: boolean;
  extractionInput: string;
}): Promise<Stage | null>;
```

In SQL, the `UPDATE` computes `compatible = extraction_version = EXTRACTION_VERSION AND extraction_input = $input`. It sets `processing_stage = CASE WHEN compatible THEN 'matching' ELSE 'extraction' END` and returns `processing_stage`. PostgreSQL evaluates `SET` and `WHERE` against the locked row, so no other request's earlier view can influence it. `newer` (D1-A) means the stored version's revision is greater than this code's `EXTRACTION_REVISION`.

| Row state | Lease | Compatible | Newer | `refresh` | Result |
| --- | --- | --- | --- | --- | --- |
| `published` | any | any | any | any | null |
| `processing` | unexpired | any | any | any | null |
| `saved`, `pending`, or `processing` with expired lease | — | yes | — | any | `matching` |
| same | — | no | no | any | `extraction` |
| same | — | no | yes | any | null (D1-A) |
| `match_review` or `clarification` | — | yes | — | false | null |
| same | — | yes | — | true | `matching` |
| same | — | no | no | any | `extraction` |
| same | — | no | yes | any | null (D1-A) |

`processReport` drops its early-return shortcut and branches on the returned stage. On null it returns the current `savedReport`.

**Confirmation contract (Proposed).**
- `confirmReportMatch` selects `candidate_packet` with `FOR UPDATE`. It validates `candidateId` and `candidateIdsShown` against `reviewSet(candidate_packet, assessments)`.
- `reviewSet` is the pure function that `savedReport` already uses to order and slice to five (`report-submission.ts:139-152`). It moves there and becomes shared.
- After the move, the pre-transaction read supplies only immutable Report fields, which `ReportContext` types. `report.candidates` is unreachable from the confirmation logic.

**Interrupted work (Proposed).** The owner projection reports `pendingReason = processing_stage || '_interrupted'` when `state='processing'` and the lease has expired. The values are `extraction_interrupted` and `matching_interrupted`, and nothing new is written.

**Test seams (Proposed; values Illustrative).** These are read once at module load. They are honored only when `NODE_ENV !== "production"`.

| Env | Default | Test value | Purpose |
| --- | --- | --- | --- |
| `NEARHOOD_LEASE_SECONDS` | 60 | 6 | Reach lease expiry within a test |
| `NEARHOOD_MODEL_TIMEOUT_MS` | 25000 | 10000 | Reach the provider abort within a test. It must exceed the test lease, so a held call can outlive its lease. |

The fixture at `tests/external-services.ts` gains three controls:
- **Hold:** `POST /control { text, mode, hold: n }` holds the n-th model call for that text until `POST /release { text }`.
- **Call count:** `GET /calls?text=` returns the number of calls per stage.
- **Call marker:** each extraction response carries the call ordinal in its `subject`, so a test can tell which attempt's checkpoint was stored.

**API.** No route changes. `pendingReason` gains two values, and the API still exposes no lease or attempt fields.

### Phase 2 — matching decisions (defects 4 and 5)

**D3-B.** One exported predicate replaces the three separate `continuity !== "separate"` checks: the decision derivation (`report-model.ts:526`), the create-new guard (`report-processing.ts:386`) and review ordering (`report-submission.ts:143`).

```ts
export const isPlausible = (a: CandidateAssessment) =>
  a.continuity !== "separate" || a.chronology === "conflict";
```

The recommendation is `match` only when exactly one assessment is plausible and its continuity is `same`. Any plausible assessment whose continuity is not `same` gives `uncertain`. Stored assessments keep the model's raw labels, so they stay inspectable.

**D2-B.** Remove the time predicate from the `HAVING` clause in `nearbyCandidates`, and keep ordering by time distance. `MATCHING_SCOPE.temporalWindowDays` becomes an ordering note in docs and is no longer a parameter. Criterion 5's wording changes in the ticket.

### Phase 3 — copy, docs and marker reproduction

- **Status copy (Illustrative wording, Proposed rule).** When `state = 'clarification'` and `pendingReason` is `separate_occurrences` or `unclear_occurrence`, the status line reads "Report saved · not added to a Happening".
- **Docs.** ADR 0005 says 25 s, not 35 s, and its front matter is repaired. The stages implementation doc and the ticket describe v6 as unevaluated, with v5 numbers labelled historical.
- **Test isolation.** Mobile and desktop runs must not draw overlapping random coordinates, so one project's Reports never enter the other's candidate pool. "an oversized evidence packet stays unassigned" failed once on desktop for this reason during phase 1.
- **Marker (D4-A).** A `browse.spec.ts` test creates a second published Happening at the seeded footbridge coordinates, then selects the seeded marker. It is marked `test.fail()` with a link to a new issue. The existing marker test stays isolated through `npm run verify`.

## Failure and recovery

| Case | What stays saved | What the contributor sees | How to resume |
| --- | --- | --- | --- |
| A late request arrives after review is ready | Review, recommendation and candidates are unchanged | Same review | Nothing to do |
| An older code version meets a newer checkpoint (D1-A) | Newer checkpoint is unchanged | `pending` with `refresh_required` from that instance | Retry after deploy completes |
| Lease expires mid-stage | Original Report and any earlier checkpoint | `pending` with `*_interrupted`, retry offered | Retry leases again; the old attempt's writes match zero rows |
| Provider timeout | Same | `pending` with `extraction_failed` or `matching_failed` | Retry |
| Refresh lands while confirming | New review set | 400 or 409 asking to choose again | Choose from the refreshed set |
| Old nearby Happening (D2-B) | Report unassigned | Clarification listing the old Happening | Choose it, choose none, or leave unassigned |

## Verification and acceptance

Every phase ends with `npm run verify` passing. The browser count rises from 60 by two for each new test, because every test runs on mobile and desktop. Fixture results never count as live evidence.

**Phase 1:**
- [ ] **Lease table.** A supplementary database test (`scripts/report-lease.test.ts`, run by `verify-local.sh` against its disposable database) inserts one row per table line and calls `acquireLease`. The returned stage matches every line. Remove the stage computation from the `UPDATE` and the test fails.
- [ ] **No stale input.** `acquireLease` accepts no stage or readiness argument, so passing a stale stage does not compile. Reviewers confirm this from the signature.
- [ ] **Late completion.** Lease is 6 s and the fixture holds extraction call 1. POST A is held. After 7 s, POST B leases and finishes. Then A is released. The stored checkpoint carries call 2's marker, A's POST returns the current state, and the call count shows 2 extraction calls with no third.
- [ ] **One call per POST.** A full journey's call count equals the number of process POSTs.
- [ ] **Interrupted reason.** Lease is 6 s and the fixture holds and never releases. After 7 s, `GET` shows `pending` with `extraction_interrupted` and `nextAction: retry`.
- [ ] **Provider timeout.** The model timeout is 10 s and the fixture holds. The POST returns within 15 s with `pending` and `extraction_failed`.
- [ ] **Version skew (D1-A).** The lease test includes a row whose stored version is `report-extraction-v99`. `acquireLease` returns null and the row is unchanged.
- [ ] **Confirmation set.** A unit test checks `reviewSet` ordering and the five-card cap. In `confirmReportMatch`, the only Report fields used come from `ReportContext`, which the type system enforces. The existing "not-supplied" 400 test still passes.
- [ ] **Concurrent confirmation.** Two identical `/match` POSTs both return 200 and the account version rises by 1. A different choice afterwards returns 409. A second signed-in user's `/match` returns 404.

**Phase 2:**
- [ ] **Conflict (D3-B).** The fixture returns one candidate as `separate` with `conflict`. The Report goes to `clarification`, the candidate's Happening gets no new membership, no new Happening is created, and create-new is allowed only after that candidate is shown.
- [ ] **Old Happening (D2-B).** A seeded Happening sits at the Report's coordinates, observed 31 days earlier. Its ID appears in `candidateIds`. With fixture continuity `unknown`, the result is `clarification` with `happeningId` null.
**Phase 3:**
- [ ] The separate-situations test asserts the new status line and that "Could you clarify?" is absent.
- [ ] The marker reproduction runs as an expected failure and links the new issue.

**Phase 4 (no code; from the audit's levels 3 and 4):**
- [ ] Run the live model checks on v6 for both arms and both splits. Scores are written to a new review record, with a new held-out set.
- [ ] Real Google sign-in, hosted migrations, the Vercel database target and hosted timing are captured as the audit lists them.
- [ ] Update the ticket's checkboxes only from these records.

## Delivery and open decisions

| Order | Unit | Depends on | Rollback |
| --- | --- | --- | --- |
| 0 | Baseline commit | — | — |
| 1 | Phase 1 PR | 0, D1 | Revert. No migration. |
| 2 | Phase 2 PR | 1, D2, D3 | Revert. No migration. |
| 3 | Phase 3 PR | 0, D4 | Revert |
| 4 | Live and hosted checks | 1 and 2 deployed | — |

Phases 1 and 3 can proceed in parallel once D1 and D4 are answered.

Open questions beyond D1 to D5:
- **D2-B interactions.** Does removing the time filter interact with seed data in the demo area? Phase 2 checks the seeded candidate counts before merging.
- **Production guard for the test seams.** Is `NODE_ENV !== "production"` enough? Vercel preview builds run in production mode, so the seams stay off there.

## Decision record

**Outcome / date:** Decisions agreed 2026-10-23. The implementation contract awaits sign-off.
**Agreed scope and rationale:**
- D1-A: guard version skew in the lease.
- D2-B: time orders candidates and no longer filters them.
- D3-B: `separate` with `conflict` is still plausible.
- D4-A: reproduce marker overlap here and fix it in a new issue.
- D5-A: defer the request-wide deadline to hosted measurement.

**Issue / ADR / implementation reference:** [#4](../issues/4.md). D2-B amends criterion 5's 30-day wording.
