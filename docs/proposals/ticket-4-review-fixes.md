# Proposal: Fix evidence integrity, unresolvable coverage, and processing loops found in the #4 review

**Status:** Decisions R1 to R4 agreed 2026-10-25 (all as recommended). Phases A to E implemented and locally verified on `fix/issue-4-processing` (`npm run verify`: 82 browser tests pass), not committed or pushed. Ticket text updated (D3); paged matching filed as [#19](../issues/19.md).
**Author / date:** Agent draft for Maoyuan Wang, 2026-10-25.
**Related issues:** [#4](../issues/4.md). It builds on the [#4 fix plan](report-processing-fixes.md) (D1 to D5 agreed). Marker overlap is [#17](../issues/17.md) and is out of scope.
**Decision requested:** None outstanding. R1 to R4 and phases A to E were accepted 2026-10-25.

Labels: **Proposed** means a contract to accept or change. **Illustrative** means wording or a value that can change without changing behavior. **Undecided** means a product call that blocks the work that depends on it.

## Problem and evidence

These findings come from the two-axis review of `010ebaa...HEAD` (standards and spec) on 2026-10-25, plus the earlier branch review of `fix/issue-4-processing`. "Checked" means the reviewer re-read the code. "Reported" means only a sub-agent found it.

| ID | Who is affected | What happens today | Evidence | Status |
| --- | --- | --- | --- | --- |
| F1 | Readers of any Happening created from a Report | The published Observation's `described_state` holds the whole original Report. The UI labels it "Derived Observation" and then quotes the same text again below it. The validated `describedCondition` and per-Observation `uncertainty` are never stored. | `report-model.ts:407` (`excerpt: report.originalText`); `report-processing.ts:546`; `report-card.tsx:41-58` | Checked |
| F2 | Same | The first Shared Account's only claim is the original Report text, so derived and original words cannot be told apart. This goes against #3's "Keep derived interpretation distinguishable" and ADR 0001. | `report-model.ts:421` | Checked |
| F3 | Same | A first account never says it rests on one contributor. The default caveat is added and then filtered straight back out. | `report-processing.ts:578-588` | Checked |
| F4 | Contributors reporting near a long-lived Happening | Any candidate with more than 3 **Observations** sets `omittedEvidence`. The cap counts Observations, so one Report with 4 Observations is enough. The result is `uncertain`, and create-new is refused. Refreshing can never clear it. The seeded `bridge` Happening has 3 Observations, so one more matched Report there blocks new Happenings nearby. | `report-matching.ts:96-133`; `report-model.ts:432`; `report-processing.ts:415-428`; `db/seed.sql:38` | Checked |
| F5 | Contributors in dense areas | D2-B removed the time filter, so the pool only grows. Once more than 20 Happenings sit within 1,500 m, `poolTruncated` is always true and create-new is always refused. The refusal message says "refresh the suggestions", which cannot help. | `report-matching.ts:65`; `report-processing.ts:415-428` | Checked |
| F6 | Any contributor during a deploy | A `saved` row holding a newer extraction revision makes `acquireLease` return null, so `savedReport` shows `nextAction: "process"`. The auto-process effect re-fires every time `busy` returns to false, and the browser POSTs in a loop until the deploy settles. This contradicts the #4 fix plan's failure table, which promises `refresh_required`. | `contribution.tsx:137-146`; `report-submission.ts:163-171` | Checked |
| F7 | Same | Matching revisions are not guarded. An older instance's `refresh` can overwrite a newer matcher's review, and each side's confirm then returns 409. | `report-processing.ts` lease; confirm `matching_version` check | Checked |
| F8 | Auditors of matching decisions | #4 criterion 42 says "Persist assessed versus displayed candidate IDs". The displayed IDs are saved only when the contributor decides, and they come from the client. A Report left unassigned records nothing about what was offered. | `report-processing.ts:485` | Reported |
| F9 | Model baselines | The command-line `extractReport` reports `no_match` for separate or unclear occurrences that were never compared, and the baseline expectations encode it. ADR 0004 says uncertainty is never no-match. | `report-model.ts:578`; `scripts/check-report-model.ts:168` | Checked |
| F10 | Ticket readers | Criterion 39 is ticked but still says "symmetric 30 days" (changed by D2-B). Criterion 40 is ticked, but F4 and F5 make its uncertainty unresolvable. | #4 body | Reported |
| F11 | Maintainers | Duplicated rules and loose types: the coverage-incomplete check (3 copies), the occurrence-to-reason mapping (2), the advisory-lock number (2), the review-set size of 5 (`reviewSet` and `match/route.ts:60`), errors recognised by message text (`report-processing.ts:213`), `MatchChoice` defined twice, and `{lat, lng, observedAt, candidateHint}` rebuilt three times. | Standards review | Reported |

Assumption, unverified: hosted production holds few or no contributor-published Happenings, so F1 and F2 data repair is small. This must be counted before phase A ships (open question Q1).

### Reviewed but deliberately not changed

- **A new Happening reuses its Report's ID** (`report-processing.ts:268, :464`). This is intentional: the pending Report pin disappears when the Happening is created "at the same stable identifier" (`database.ts:50-51`). Proposed: record this in ADR 0001's consequences so it is not flagged again.
- **"Candidate" names three things**: the Report's preselected Happening (`candidateId` / `candidateHint`), the chosen candidate, and the glossary's Candidate Happening. Renaming changes the API payload, so it is deferred.
- **Large modules** (`processReport`, `publishEvidence`, the 759-line `contribution.tsx`). Splitting them is a separate refactor issue, not part of this behavior fix.

## Goal and scope

- **Outcome:**
  - Published Observations and claims carry derived interpretation, labelled as derived, with the original Report shown beside them.
  - A first account states that it rests on one contributor.
  - Every uncertain coverage state has a truthful next step.
  - No deploy can make a client request in a loop.
- **Included:** phases A to D, plus the optional cleanup phase E.
- **Explicitly deferred:**
  - Model-extracted claims (criterion 36, which needs extraction v7 and the phase 4 live evaluation).
  - Paged matching (R3 option P1, unless chosen).
  - The renames and module splits above.
  - #5 reconciliation and #6 clarification.
- **Constraints:**
  - Reports stay immutable and remain the authority. Derived records never replace them in the UI ([ADR 0001](../adr/0001-preserve-evidence-separately.md)).
  - The model never writes membership ([ADR 0004](../adr/0004-confirm-matches-before-membership.md)).
  - Use new versioned migrations, with no edits to applied ones and no live-provider backfill (#4 line 52).
  - Tests run through the product boundary with fixture model responses ([ADR 0003](../adr/0003-test-through-the-product-boundary.md)).
- **Conflict with accepted text:** commit `eb39bd8` deliberately attached the full Report to each Observation so that a short quote could never strip a qualification. F1 keeps that protection by linking and showing the original instead of copying it into the derived field. The protection itself is unchanged.

## Decisions

| ID | Question | Options | Recommendation |
| --- | --- | --- | --- |
| R1 | What does an Observation store when the Report gives no condition for a part (for example "north entrance not checked")? | **A.** Make `described_state` nullable and show "No condition described" with the Observation's uncertainty. **B.** Don't publish such Observations. | **A.** The unseen part is evidence of uncertainty. B loses spatial scope, which the guardrails rank above completeness. |
| R2 | What are the first account's claims? | **A.** One deterministic claim per Observation with a condition, built by software from subject, scope and condition, each supported by its Observation. **B.** Keep the original text as the claim and label it "original words". **C.** Add claims to the extraction schema now (v7). | **A** now, with C left to criterion 36. A makes claims derived and traceable without a new model call. B keeps F2. C needs a live evaluation that phase 4 has not done. |
| R3 | How does a contributor get past coverage that can never be complete (F4 after A1's fix, and F5)? | **P1.** Paged matching: further matching passes over the next slice of candidates or evidence (one provider call per POST), up to a cap. **P2.** Let the contributor create a new Happening despite truncation, recorded as its own decision source with a visible coverage caveat. This needs criterion 43 amended. **P3.** Keep the refusal, but give the true reason and stop suggesting refresh. File P1 as a follow-up. | **P3 now, P1 as a follow-up.** It is honest and small, and together with B1 it clears the demo-area case. P2 lets a human decide past unassessed candidates, which criterion 43 forbids. |
| R4 | Should data published with the old `described_state` be repaired? | **A.** Repair deterministically from `report_processing.extraction`, matching by `(report_id, subject)` where that pair is unique, and list the rest. **B.** Leave history and only fix new publications. | **A** if Q1 finds real hosted data, otherwise **B**. Account history must not be rewritten in either case; only Observation fields change. |

## Implementation contract

### Phase A — evidence integrity (F1, F2, F3)

**A1. Observation stores the derived condition (Proposed).**
- **Migration** `<timestamp>_observation_derived_condition.sql`: `ALTER COLUMN described_state DROP NOT NULL` (R1-A) and `ADD COLUMN uncertainty text`.
- **Write path:** `publishEvidence` writes `observation.describedCondition` and `observation.uncertainty`.
- **Remove the copied text:** delete `Extraction.observations[].excerpt` (`report-model.ts:65, 407, 458`). The original is already reachable through `observations.report_id`, and `source_support` keeps the cited passages and offsets.
- **Types:** `describedState: string | null` in `happenings.ts:52, 76`.
- **UI:** `report-card.tsx` shows "No condition described" (Illustrative) for null and adds the uncertainty line. The original `<blockquote>` stays in the same card.
- **Matching input is unaffected.** Call 2 already strips `describedState` and sends each original Report once (`report-model.ts:473`).

**A2. Derived claims (Proposed, R2-A).**
- Build one claim per Observation that has a condition. Statement: `"{subject}{ at spatialScope}: {describedCondition}"` (Illustrative template). Each claim is supported only by its own Observation.
- If no Observation has a condition, publish no claims and add the account uncertainty "No condition was described in this Report." (Illustrative).
- `Extraction.claims` disappears. The claims are built at publication, and #5's later-version claim copying is unchanged.
- Undecided only if R2 is not A.

**A3. Single-contributor caveat (Proposed).**
- Keep "One contributor's account; not independently verified." while the Happening's member Observations come from exactly one distinct `contributor_id`, and drop it once a second contributor's Report joins.
- The rest of the uncertainty logic is unchanged.

### Phase B — truthful coverage (F4, F5)

**B1. Cap evidence per Report, not per Observation (Proposed).**
- In `nearbyCandidates`, rank each candidate's **Reports** with the current keys moved to Report level: first-submitted Report first, then closest observed time, then most recent.
- Take the top `MATCHING_SCOPE.evidenceReportsPerCandidate` (renamed; value stays 3), and include **all** Observations of the chosen Reports.
- `evidenceCount` and `omittedEvidence` count Reports.
- `MATCHING_INPUT_BYTES` still bounds the packet, and exceeding it still gives the `evidence_budget` clarification.
- Bump `MATCHING_VERSION` to `report-matching-v4`, because the packet shape changes. Saved reviews then return the existing 409 "need to be refreshed".

**B2. Coverage limit reason and copy (Proposed, R3-P3).**
- Keep the existing `incomplete_coverage` reason. Pool truncation and evidence omission both follow deterministically from stored data, so a refresh can never clear either one. A separate `coverage_limit` value would only rename the same state. (Amended 2026-10-25 during implementation.)
- The matching question and the create-new refusal say: "There are too many nearby Happenings or Reports to check automatically. Choose a shown Happening or leave this Report unassigned." (Illustrative). Neither mentions refresh.
- For `incomplete_coverage`, the clarification view hides "None of these describe what I reported", because the server always refuses it. "Refresh nearby suggestions" stays: it is still how a contributor recovers when a shown Happening's account changes before they choose.
- Create-new stays refused. File the P1 follow-up issue when this ships.

### Phase C — version skew (F6, F7)

**C1. No loop on a newer checkpoint (Proposed).**
- Add an exported `extractionRevision(version)` helper next to `EXTRACTION_REVISION` (shared with the existing regex).
- In `savedReport`, when the stored revision is newer and `state` is `saved`, `match_review` or `clarification`, project `pending` / `refresh_required` / `nextAction: "retry"` and clear the candidates. This is the same projection the incompatible-review case already uses.
- Client guard: the auto-process effect fires at most once per `(id, state, processingStage)` key, held in a ref. A server response that does not change the key cannot trigger another POST.

**C2. Matching revision guard (Proposed).**
- Add `MATCHING_REVISION`, parsed like the extraction revision.
- `acquireLease` refuses to lease (returns null) when the stored `matching_version` revision is newer than ours, in addition to the extraction rule.
- `savedReport` projects `refresh_required` for that row, as in C1.

### Phase D — records and ticket accuracy (F8, F9, F10)

**D1. Offered candidate IDs (Proposed).**
- **Migration:** add `report_processing.offered_candidate_ids text[] NOT NULL DEFAULT '{}'`.
- Write it with the recorded review, as `reviewSet(candidate_packet, assessments)` IDs computed on the server. It is cleared wherever `candidate_packet` is cleared.
- The contributor's decision keeps `decision_candidate_ids`, the client-reported IDs actually seen. Confirmation keeps validating it, now against `offered_candidate_ids`.
- Whether to also track what a contributor saw without deciding: Undecided, and not required by criterion 42.

**D2. Command-line "not compared" result (Proposed).** `extractReport` returns `matching: null` when the extraction is not a single occurrence. `check-report-model.ts` expects `"not_compared"` for those cases. No runtime path changes.

**D3. Ticket text (Proposed; outward-facing, so it happens after acceptance).**
- Change criterion 39's "symmetric 30 days" to "time orders candidates (D2-B)".
- Add to criterion 40: "Coverage that cannot be completed stays unassigned with an `incomplete_coverage` explanation and no refresh advice (R3)".
- Leave criterion 36 unchecked.

### Phase E — standards cleanups (optional, no behavior change)

- **One owner for each repeated rule** in `report-processing.ts`:
  - `coverageIncomplete(coverage)`, with `CandidateSearch["coverage"]` as its type
  - `occurrenceReason(extraction)`
  - a named `MATCHING_LOCK` constant
  - `candidateSearch(report)` for the repeated `{lat, lng, observedAt, candidateHint}`
- `REVIEW_SET_SIZE` is exported beside `reviewSet` and imported by `match/route.ts`.
- `EvidenceBudgetError` replaces the comparison against message text.
- `MatchChoice` is exported once and imported as a type by `contribution.tsx`.

## Failure and recovery

| Case | What stays saved | What the contributor sees | How to resume |
| --- | --- | --- | --- |
| Report gives no condition for a part (R1-A) | Observation with scope, null condition and uncertainty | "No condition described" beside the original words | Nothing to do |
| No Observation has a condition (A2) | Happening, an account with no claims, and an uncertainty line | The account says no condition was described | A later Report (#5) |
| Coverage cannot be completed (B2) | Report, the review and its offered set | `clarification` with an `incomplete_coverage` explanation and no refresh advice | Choose a shown Happening, or leave the Report unassigned |
| Older instance meets a newer extraction or matching checkpoint (C1, C2) | Newer checkpoint unchanged | `pending` / `refresh_required`, with one retry offered and no loop | Retry after the deploy finishes |
| Matching v4 rollout (B1) | Old v3 reviews | The existing "need to be refreshed" 409 on confirm | Refresh |
| R4-A repair cannot match an Observation uniquely | That Observation unchanged | Unchanged | It is listed in the migration output for manual review |

## Verification and acceptance

Every phase ends with `npm run verify` passing. Each new browser test adds two to the count (mobile and desktop). Fixture results never count as live evidence.

**Phase A:**
- [ ] A fixture Report with a stated condition publishes an Observation whose `describedState` is the extracted condition, not the original text. The card shows both the derived line and the original quote.
- [ ] Fixture mode `unseen-part` (Illustrative name) returns one Observation with `describedCondition: null` and an uncertainty. It publishes with null state, the card shows "No condition described" and the uncertainty, and the Observation's `source_support` passages are unchanged.
- [ ] The first account has one claim per conditioned Observation. Each claim's support set is exactly its own Observation, and none equals the original text.
- [ ] The first account's uncertainty includes "One contributor's account; not independently verified.". A second contributor's confirmed match removes it, while a second Report from the same contributor keeps it.

**Phase B:**
- [ ] A Happening with one Report holding 4 Observations is compared with all 4, and `omittedEvidence` is empty.
- [ ] A Happening with 4 Reports gives `omittedEvidence = {id: 1}` and `incomplete_coverage`. The question and the create-new refusal text do not contain "refresh".
- [ ] Demo-area regression, at isolated coordinates because the shared test database accumulates bridge Reports: a Happening built from one Report with 4 Observations, then a new unrelated Report nearby, yields a fixture `no_match` that creates a Happening.
- [ ] 21 Happenings within 1,500 m give `poolTruncated` and `incomplete_coverage`, and no Happening is created.
- [ ] Mutation check: count Observations instead of Reports again, and the 4-Observation test fails.

**Phase C:**
- [ ] Lease table gains rows: a newer `matching_version` with `refresh=true` returns null, and the row is unchanged.
- [ ] A `saved` row with `report-extraction-v99` shows `GET` → `pending` / `refresh_required` / `retry`. In the browser, the process route is called exactly once after load (fixture call count, or a request counter on the route).

**Phase D:**
- [ ] After review is recorded, `offered_candidate_ids` equals the IDs on the displayed cards. A Report left unassigned keeps them.
- [ ] `npm run model:check` in fixture mode reports `not_compared` for the separate-occurrence case.

**Phase E:** behavior-neutral, so the suite passes unchanged and `grep` finds a single definition of each extracted rule.

## Delivery and open decisions

| Order | Unit | Depends on | Rollback |
| --- | --- | --- | --- |
| 1 | Phase C PR | — | Revert. No migration. |
| 2 | Phase A PR | R1, R2, R4, Q1 | Revert code. The migration only relaxes a constraint and adds a column, so it can stay. |
| 3 | Phase B PR | R3 | Revert. Matching v4 → v3 makes reviews refresh again. |
| 4 | Phase D PR | — | Revert code. The column can stay. |
| 5 | Phase E PR | 1 to 4 merged | Revert |
| 6 | Ticket text (D3) and the P1 follow-up issue | 3 merged | — |

Phase C goes first because it is the only one that can harm a running deploy, and it needs no decision.

Open questions:
- **Q1. Hosted data.** How many Observations in hosted production were published by `publishEvidence` (not seed)? That decides R4. Evidence: a read-only count on the hosted database, run with your approval.
- **Q2. Claim template wording (A2).** Resolved: the account section says claims are derived interpretations, not the contributors' words. The label sits on the section, not on each claim, so claim buttons keep the statement as their accessible name.
- **Q3. P1 cap.** If paged matching is chosen later, how many passes are allowed? 3 passes (60 candidates) is Illustrative. Hosted latency from phase 4 should decide.

## Decision record

**Outcome / date:** Agreed 2026-10-25.
**Agreed scope and rationale:**
- R1-A: Observations may have no condition, and show the qualification instead.
- R2-A: software builds one claim per conditioned Observation. Model-extracted claims stay with criterion 36.
- R3-P3: create-new stays refused under incomplete coverage, with truthful copy. Paged matching (P1) becomes a follow-up issue.
- R4: the repair migration only touches rows whose `described_state` equals their Report's original text, so it is safe on any database. The hosted count (Q1) was not run.
- Phases A to E accepted, plus the ticket-text update (D3).
**Issue / ADR / implementation reference:** [#4](../issues/4.md); builds on [report-processing-fixes.md](report-processing-fixes.md).
