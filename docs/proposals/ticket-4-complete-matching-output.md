# Proposal: Stop matching from failing when the model assesses too few candidates

**Status:** M1 and M2 accepted 2026-10-28 and implemented locally (uncommitted). Live checks not run yet; they need separate approval.
**Author / date:** Agent draft for Maoyuan Wang, 2026-10-27.
**Related issues:** [#4](../issues/4.md) (matching stage). Evidence: the diagnosis below and the [live matching record](../reviews/2026-10-27-issue-4-live-matching.md) (case A02-remove-identity).
**Decision requested:** Agree to M1 and M2 below, and answer U1 to U4, before `report-matching-v5` is implemented.

Labels: **Proposed** is a contract to accept or change. **Illustrative** is wording or a value that can change without changing behavior. **Undecided** blocks the work that depends on it.

## Problem and evidence

**Observed, 2026-10-27.** A Report submitted through the app at 15:41 (`79ce9248…`, "The orange barriers are still across both ends of the footbridge. Same ones as before, nobody working on it.", pinned on the Eastbank footbridge) never reached the map:

1. Extraction (`report-extraction-v7`) succeeded.
2. Retrieval found 6 Happenings within 1,500 m: `bridge`, `crossing-signal`, `path-water`, `lamp`, `garden-cleanup` and `picnic`.
3. The model (`nvidia/Nemotron-3-Ultra-550b-a55b`) returned **one** assessment, for `bridge`, with finish reason `stop`. Its `reason` was exactly 320 characters, the schema maximum, and ended mid-sentence.
4. `compareReport` requires one assessment per candidate (`report-model.ts`, "Incomplete candidate assessment") and threw.
5. `processReport` saved the Report as `pending` with `pending_reason = matching_failed` and no matching outcome.
6. The map shows a pending Report only when its outcome is `create_new` (`database.ts`, `pendingReports`), so this Report appears nowhere except the contributor's saved-Report page.

**Retrying does not help.** At `temperature: 0`, the same packet replayed 5 times gave the same single assessment every time. Each Retry is another paid call that fails the same way.

**Why the schema allows it.** The provider schema for `assessments` sets `maxItems: 20` and no `minItems` (`matchingSchema` in `report-model.ts`). Constrained decoding therefore allows the array to close after one item, although software requires exactly one assessment per candidate.

**Exposure.** All six seeded Happenings lie within 1,500 m of one another, so any demo Report in that area receives about six candidates. Of the two `matching_failed` Reports in the shared database, one is the Report above. The other (`159d1e98…`) has a stale v5 extraction and was not replayed. The live matching evaluation saw this failure once in 144 calls (A02-remove-identity, 1 of 2 candidates returned). The demo packet fails every time, so the evaluation rate understates the risk for this neighborhood.

**Hypothesis, unverified.** The early stop follows a `reason` cut off at its 320-character limit: the decoder forces the string closed, and the model then closes the array. In every failing replay, the single reason was exactly 320 characters. The evaluation record also notes 41 reasons at the limit. The experiment below is consistent with this but does not establish it.

### Experiment: schema variants on the failing packet

The same saved extraction and candidate set were sent 3 times per variant. Only the outgoing provider schema was edited in memory; no code or data changed. Raw responses were printed to the console, not archived.

| Variant | Complete arrays (6 of 6) | Accepted by the current validator | Notes |
| --- | --- | --- | --- |
| Current schema | 0/3 | 0/3 | One assessment, reason at 320 characters |
| **M1: `minItems = maxItems = 6`** | **3/3** | **3/3** | First reason still hits 320; about 2.2 s per call vs 1.3 s for the failing call |
| `reason.maxLength` raised to 1,000 only | 3/3 | 0/3 | Reasons of 349 to 358 characters fail the software limit of 320 |
| Both | 3/3 | 1/3 | Same software limit |

This is one packet, so it shows that M1 can work with this provider. It does not establish a general rate.

### What the contributor would see after M1

With complete output, the footbridge Report becomes a **clarification**, not an automatic match suggestion, for two reasons that M1 does not change:

- The model assessed `bridge` as `same / consistent / same`, but assessed the five unrelated Happenings as `unknown` rather than `separate`, with reasons such as "No evidence in the new report relates to the lamp outage." This is the P03 pattern from the evaluation record. Six plausible candidates produce `uncertain`.
- `bridge` has four Reports and the packet includes at most three, so coverage is incomplete. The question shown is the coverage message, and creating a new Happening is blocked.

The contributor can still choose "Eastbank footbridge closure" from the shown candidates, and the Report then joins that Happening's evidence. It does not create its own pin, because it describes an existing Happening.

## Goal and scope

- **Outcome:** a Report near several Happenings is never left `matching_failed` because the model stopped early. It reaches match review or clarification, where the contributor can act.
- **Included:**
  - M1, the exact assessment count in the provider schema.
  - M2, the matching version bump.
  - Tests and documentation.
- **Deferred:**
  - Unrelated candidates assessed `unknown` (P03, U3). This is a prompt change that needs evaluation.
  - Reasons cut off at 320 characters (U2).
  - Automatic retries.
  - Showing failed Reports on the map (U4).
- **Constraints:**
  - The validator still rejects incomplete output. Software never invents a missing assessment, because an omitted candidate could be the correct Happening ([ADR 0004](../adr/0004-confirm-matches-before-membership.md): confirm before membership).
  - Matching stays separate from extraction ([ADR 0005](../adr/0005-separate-extraction-from-matching.md)).
  - Tests run through the product boundary ([ADR 0003](../adr/0003-test-through-the-product-boundary.md)).

## Options and recommendation

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| A. Keep the current schema | No change | Reports near several Happenings stay `matching_failed`; each Retry repeats a paid failure |
| **B. Exact count in the schema (M1)** | Fixes the cause at the provider boundary; 3/3 on the failing packet; validator unchanged | Relies on the provider honoring `minItems`; it did here, which needs confirming across the evaluation suite. Slightly more output tokens |
| C. Software fills missing candidates as `unknown` | Never fails | Fabricates an assessment with no evidence or reason, contradicting the evidence contract; hides model omissions |
| D. Automatic retry on incomplete output | No contract change | At temperature 0 the output repeated 5 of 5 times, so a retry only adds cost |
| E. Raise the `reason` limit in the schema and validator | Also gave complete arrays in the experiment; reasons stop being cut off | Changes the inspectable reason contract and its display; 1/3 accepted even then, because 320 is also enforced in software; needs its own evaluation (U2) |
| F. One call per candidate | Each call has one item, so it cannot stop early | Up to 20 calls per Report; loses the single ranked comparison |

**Recommendation: B.** It is the smallest change, keeps the "complete or rejected" rule, and was the only variant accepted on every try. C is rejected because it invents evidence. D does not help at temperature 0. E stays open as a separate decision.

## Concrete behavior

**Current:** the footbridge Report shows "Report saved · account update pending" with a Retry action. It does not appear on the map, and Retry fails again.

**Proposed:**

- Processing records `state = clarification` and `pending_reason = incomplete_coverage`, with six offered candidates.
- The contributor sees the coverage question and the candidate list, and chooses "Eastbank footbridge closure".
- Publication adds the Report's Observations to `bridge` and writes a new Shared Account version. The bridge pin's detail now lists this Report.
- If coverage were complete and only `bridge` were plausible (after U3), the contributor would see a match suggestion instead.

**With no nearby Happenings:** the schema becomes `minItems = maxItems = 0`. The model returns `{"assessments": []}`, which yields no match and creates a Happening and pin, as today. Today's schema passed this case 3 of 3; the `0 / 0` form is untested.

**If the provider ignores the constraint:** the validator rejects the output as today, and the Report stays `pending / matching_failed` and retryable. Nothing worse than the current behavior.

## Implementation boundaries

| Area | Proposed change |
| --- | --- |
| Model / tools | **M1, Proposed.** `matchingSchema(candidates)` sets `minItems: candidates.length` and `maxItems: candidates.length` on `assessments`. Retrieval already caps candidates at 20. The prompt, the `reason` limit and the validator are unchanged. |
| Version | **M2, Proposed (U1).** `MATCHING_VERSION` becomes `report-matching-v5`, because the provider output contract changes and evaluation records are keyed by version. Saved v4 match reviews and clarifications already ask for a refresh before confirmation (`confirmReportMatch`). `matching_failed` Reports have no matching version, so their next Retry simply runs v5. `EXTRACTION_VERSION` is unchanged. |
| Data / storage / API / UI | No change and no migration. |
| Fixture model (`tests/external-services.ts`) | Reject a matching request whose `assessments` schema does not have `minItems = maxItems =` the number of supplied candidates. This proves the request shape at the product boundary. The existing `matchingReplay` can return a one-item array to cover the rejection path. |
| Docs | `docs/implementation/report-processing-stages.md`: the matching bullet states that the provider schema enforces exactly one assessment per candidate, under `report-matching-v5`. |

Affected modules: `src/lib/report-model.ts`, `tests/external-services.ts`, the browser tests that use it, and `docs/implementation/report-processing-stages.md`.

## Failure and recovery

| Case | Saved | Contributor sees | Resume |
| --- | --- | --- | --- |
| Complete output, one plausible `same` | `match_review` | Match suggestion | Confirm or choose another |
| Complete output, several plausible or incomplete coverage | `clarification` | Candidate list and question | Choose a Happening or leave unassigned |
| Provider ignores the count, or another validation failure | `pending / matching_failed`, extraction kept; the server log records the cause and the output's shape | "Account update pending" and Retry | Retry; unchanged from today |
| Provider outage or timeout | As today | As today | Retry |
| Instance rolled back to v4 after v5 checkpoints exist | v5 checkpoints are "newer" | `refresh_required`, no loop | Redeploy v5 |

## Verification and acceptance

**Deterministic (no provider):**
- [x] For 0, 1, 6 and 20 candidates, the matching request schema has `minItems` and `maxItems` equal to that count. (0, 1 and 2 through the fixture model's check on every browser request; 1, 6 and 20 in `scripts/matching-evaluation.test.ts`.)
- [x] A one-item response is still rejected, and the Report is `pending / matching_failed` with its extraction kept. (Recorded A02-remove-identity response: one item for two candidates.)
- [x] `npm run typecheck`, `npm run test:matching` and the existing browser report-stage specs pass with the fixture model asserting the schema.
- [x] A model that stops after one assessment unless the schema demands more (fixture mode `stops-early`) gets every candidate assessed and the Report is published. This test failed with `matching_failed` before M1.

**Live (needs approval; sends synthetic evidence to Nebius). Not run as of 2026-10-28:**
- [ ] The footbridge packet replayed 3 times gives 3 of 3 complete, validated responses.
- [ ] A re-run of the 2026-10-27 matching suite (48 packets × 3) gives 144 of 144 complete responses (baseline 143 of 144). Gates are no worse than the record: at most 3 unsupported `same` assessments, every call under 25 s. Latency and token totals are reported against the baseline. These comparisons are Proposed targets.
- [ ] In the running app, Retry on the footbridge Report reaches clarification. Choosing the bridge publishes it into the bridge Happening, which then lists the Report.

These are development checks with agent-authored labels, not a qualification result.

## Delivery and open decisions

One small slice: M1 and M2 together. Rollback: revert; see the last row of the failure table.

- **U1. Bump to `report-matching-v5`?** Recommended yes, so results and checkpoints trace to the changed contract. The alternative keeps v4, because the software-side rule (exactly one per candidate) is unchanged.
- **U2. The 320-character reason limit.** Reasons are cut off mid-sentence, which hurts inspectability and may trigger the early stop. Recommended: decide separately, after the M1 suite run. If incomplete responses remain, raise the limit in both the schema and the validator as its own versioned change.
- **U3. Unrelated candidates assessed `unknown`.** This turns clear single matches into clarifications whenever unrelated Happenings are nearby (P03). Recommended: a separate prompt proposal, evaluated against the preserved cases. It does not block M1.
- **U4. Show `matching_failed` Reports on the map?** Recommended no. They have no matching decision yet, and a "pending" pin beside a Happening the Report probably belongs to would be misleading. The contributor already sees them on the saved-Report page.

## Decision record

**Outcome / date:** Accepted, 2026-10-28. M1 and M2 implemented locally; live checks pending approval.
**Agreed scope and rationale:** M1 and M2 ship alone as `report-matching-v5` (U1: yes), so the evaluation can attribute any change to the exact-count schema. The prompt revision moves to `report-matching-v6` ([proposal](ticket-4-matching-v6-revision.md)). U2 to U4 are unchanged.

Added in the same change, agreed with the product owner:

- **Failure cause in the server log.** Processing failures used to be saved only as `matching_failed`, so the cause of the footbridge failure could not be confirmed afterwards. Each stage failure now logs `Report <id> <stage> failed: <message>`. When the model's output was refused (unparseable, cut off, or rejected by the validator), the line adds the output's shape: its character count, or its number of assessments and each reason's length. The incomplete-assessment message names the counts, for example `(1 of 2)`.
- **Contributor words stay out of production logs.** The full refused output is appended only outside production, because model reasons can quote Reports. No retention policy for these logs has been decided.
- **No storage change.** Nothing new is saved in the database, and the API is unchanged.

Code: `src/lib/report-model.ts` (`matchingSchema`, `RejectedOutputError`, `checkedAssessments`), `src/lib/report-processing.ts` (failure log), `tests/external-services.ts` (schema check, `stops-early`), `tests/report-matching-state.spec.ts`, `scripts/matching-evaluation.test.ts`, `playwright.config.ts` (test server output copied to `.local/browser-server.log`).
**Issue / ADR / implementation reference:** #4; [live matching record](../reviews/2026-10-27-issue-4-live-matching.md).
