# Proposal: Revise matching as `report-matching-v6` after the 2026-10-27 live run

**Status:** Draft, not accepted or implemented.
**Author / date:** Agent draft for Maoyuan Wang, 2026-10-27.
**Related issues:** [#4](https://github.com/Pcworker996/nebius-hack/issues/4) (matching stage). Evidence: [live matching record](../reviews/2026-10-27-issue-4-live-matching.md) and its [artifacts](../reviews/artifacts/2026-10-27-issue-4-matching/). Companion: [complete matching output](ticket-4-complete-matching-output.md), which owns the exact-count schema fix.
**Decision requested:** Answer U1 to U4, and agree to R1 to R5 below, before `report-matching-v6` is implemented and evaluated.

> **Renumbered (2026-10-28):** this revision was drafted as v5. The exact-count schema fix from the companion proposal shipped alone as `report-matching-v5`, so this revision is `report-matching-v6` and its baseline is v5. References to the 2026-10-27 v4 run remain historical.

> **Superseded in part (2026-10-28):** the [Happening identity proposal](happening-identity-recurrence.md) changes what `same` means. R1's continuity rules and "link" concept, the S03 label reasoning, and the U-family expectations are replaced by its H1/H2 rules. R2, R3, R5, the chronology definitions and the verification order still apply.

Labels: **Proposed** is a contract to accept or change. **Illustrative** is wording or a value that can change without changing behavior. **Undecided** blocks the work that depends on it.

## Problem and evidence

The live run (48 development packets × 3 runs, `nvidia/Nemotron-3-Ultra-550b-a55b`, `report-matching-v4`) passed model assertions in 122 of 144 calls. Seven cases failed in all three repeats. Labels are agent drafts that have not been independently reviewed.

| Case | What happens today | Probable cause | Confidence |
| --- | --- | --- | --- |
| U04 | Lamp dark again after a "reported resolved" note, repair history unknown → `same`. Three unsupported match recommendations. | The prompt says recurrence is separate "only with supporting evidence; … provisional resolution alone is insufficient". It argues only against `separate`, and the model reads "not separate" as `same`. | High |
| D03, T02 | Same-closure disagreement or partial reopening → `unknown` with chronology `conflict`. | The prompt says "disagreement or lack of proof of continuity alone calls for unknown". The reporter's explicit "same closure" is not named as evidence. | High |
| S03 | "The same lamp … is still dark. I don't know when I saw it." → `unknown`. | Probably a label problem, not a model failure. Without any time or starting Happening, nothing ties "same/still" to this candidate. See [S03 label reasoning](#s03-label-reasoning). | Medium-high |
| P03 | 19 explicitly unrelated distractors → `unknown`. The reasons say "unrelated". | Likely the schema order: `continuity` comes before `reason` and thinking is disabled, so labels are committed before the reason. `unknown` is plausible, so software returns `uncertain`. **Confounded:** P03's distractors also carry bridge-themed padding and triplicated evidence that P02 (which passes) lacks. See the [case review](../reviews/2026-10-28-issue-4-matching-case-review.md#p03). | Medium |
| T04, D04 | Correct `same` and correct recommendation; chronology `consistent` instead of `change`. | Chronology values are never defined in the prompt. | High that the definition is missing; the label itself is undecided (U2) |
| (41 reasons) | Reasons stop mid-sentence at 320 characters. | Constrained decoding enforces `maxLength: 320`. The prompt says only "short". | High |

A02-remove-identity (one of two assessments returned) is covered by the [complete matching output](ticket-4-complete-matching-output.md) proposal and is not repeated here.

**Production gap, observed in code.** `reportContext()` (`src/lib/report-model.ts:45`) omits the new Report's `submittedAt`. Candidate evidence includes `submittedAt`, but the incoming Report does not. `observed_at` is optional on the form, while `submitted_at` is `NOT NULL` (`db/migrations/001_browsing.sql`). When a contributor leaves the observation time blank, the model has no bound on when the Report was observed. This affects the live app, not only the fixture.

## Goal and scope

- **Outcome:**
  - Matching never claims `same` when the evidence leaves the occurrence unresolved.
  - An explicitly unrelated candidate is `separate`, so the contributor is not asked an unnecessary question.
  - A reporter's explicit continuity wording counts as evidence.
  - Reasons are complete sentences.
- **Included:** R1 to R5, shipped together as `report-matching-v6`, plus fixture and label revisions.
- **Deferred:**
  - Enabling thinking for matching. This is a fallback if R1 to R5 fail; it needs a latency/cost decision.
  - Deterministic overrides of model continuity. Rejected for now: software cannot judge subject identity.
  - Changes to `isPlausible` or the "ask when unsure" rule. These stay unchanged as the safety guard.
- **Constraints:**
  - Reports stay the authority ([ADR 0001](../adr/0001-preserve-evidence-separately.md)).
  - Chronology and uncertainty rank above convenience ([guardrails](../product-guardrails.md)).
  - Model wording never replaces explicit form time ([processing stages](../implementation/report-processing-stages.md)).
  - Do not tune against these 48 cases and then call them held out.

## Options and recommendation

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Keep v5 | No work | Unsafe `same` in U04; unnecessary questions; truncated reasons |
| **R1 to R5 (prompt, schema order, submission time, starting Happening)** | Targets each observed cause; small, attributable changes | Prompt behavior must be re-measured; still one model call |
| Enable thinking | Probably better judgement without prompt tuning | More tokens and latency against the 25 s budget; does not fix undefined labels or missing time |
| Software override (`unknown` → `separate` on a differing subject) | Removes P03-style questions deterministically | Software would be judging identity; risks hiding real overlaps |

**Recommendation:** R1 to R5. Measure R2 alone first (see Verification) so the effect of the schema order is known separately from the prompt rewrite.

## Concrete behavior

### R1. Define every label and make the continuity rules balanced (Proposed; wording Illustrative)

Replace the one-sided rules in the `compareReport` instruction with definitions, and include each in the prompt:

- **Link to the candidate:** observation or submission times that overlap or closely follow the candidate's evidence; the contributor started from this candidate (R5); or details specific to this candidate's evidence ("these same orange barriers"). Same object, category or place alone is not a link.
- **"Same" or "still" from the reporter** shows that the condition is ongoing from the reporter's own viewpoint. It may refer to their own earlier sighting, not to this candidate, so it supports `same` only together with a link.
- `continuity=same`: there is a link, and no evidence that the occurrence ended (repair, resolution, removal) between the candidate's evidence and the Report.
- `continuity=separate`: the evidence shows a distinct occurrence, **or** the candidate's subject is plainly unrelated (a different object, place or problem).
- `continuity=unknown`: there is no link, or an ending is reported in between and the Report does not show the problem continued (the U04 pattern).
- `chronology=consistent`: the states agree and need no development to reconcile.
- `chronology=change`: the state or extent differs, explained as the occurrence developing over time (spreading, partial reopening, removal).
- `chronology=conflict`: the accounts disagree about the same scope at overlapping times. Same-occurrence disagreement is `same` with `conflict`, not `unknown`.
- `chronology=unknown`: the times cannot be ordered.

The definitions must match the answer key (U2).

### R2. Reason before labels (Proposed)

In `matchingSchema`, order the item properties as `candidateId`, `reason`, `evidenceIds`, `continuity`, `chronology`, `scope`, and list `required` in the same order. Ask for a reason of about 200 characters (Illustrative) and keep the 320 cap. The validator and the stored assessment shape are unchanged.

### R3. Send the new Report's submission time to matching only (Proposed)

`compareReport` adds `submittedAt` to `input.report` for matching. `reportContext()` stays unchanged, because it feeds the extraction fingerprint (`extractionInput`), and changing it would invalidate every saved extraction.

The prompt states that `submittedAt` is the latest possible observation time, not the observation time. `observedAt` stays `null` when the contributor gave none. `submittedAt` enters the matching fingerprint through the input.

`compareReport`'s report parameter type widens to include `submittedAt`. The processing caller (`report-processing.ts:158`) already passes the Report loaded by `savedReport()`, which selects `submitted_at` (`report-submission.ts:118`). The evaluation runner and `check-report-model.ts` must supply it too.

### R5. Tell matching which Happening the contributor started from (Proposed)

When a contributor presses Contribute on a Happening page, its ID is saved as `candidateId` (`report-submission.ts:113`). Today it only moves that Happening to the front of the candidate list (`report-matching.ts:53`). `compareReport` sends no `candidateId` (`reportContext()` omits it), so the model cannot tell that the first candidate was the contributor's choice.

R5 adds `startedFromCandidateId` (Illustrative name) to the matching input when it is set, and the prompt treats it as a link, not an instruction. Contributors can press Contribute on the wrong Happening, so a contradicting Report still overrides it. Like R3, this is matching-only; `reportContext()` and extraction fingerprints are unchanged.

### R4. Revise fixtures and labels before inference (Proposed)

- An independent reviewer confirms S03 (see [S03 label reasoning](#s03-label-reasoning)), and decides T04 and D04 (U2). Each decision is recorded in the case's `review` option.
- Fixture `ReportContext` gains `submittedAt`, and optionally the R5 starting Happening.
- Add S03a, S03b and S03c, as described in the S03 section.
- No label changes based on v6 answers.

### S03 label reasoning

**Superseded 2026-10-28** by [H1](happening-identity-recurrence.md#h1-identity-rule-for-disruptions-and-safety-concerns-agreed-direction-wording-proposed): S03 stays `same`. Kept as a record of the reasoning.

**Status (historical):** Proposed label change, agreed in discussion with the user on 2026-10-28, pending reviewer confirmation. This change was made **after** seeing the v4 results. It must be recorded as such, not presented as the original label.

**The case as built.** New Report: "The same lamp at Alder and Third is still dark. I don't know when I saw it." Observation time is `null`. The model receives no submission time (R3 gap) and no starting Happening (R5 gap). One candidate: "The streetlamp at Alder and Third is dark at 22:00", observed 2026-10-27 22:00. There is no repair or resolution evidence. The current label is `same` / chronology `unknown` → `match`. The v4 model returned `unknown` / `unknown` → `uncertain` in 3 of 3 runs.

**Original intent** ([evaluation design](ticket-4-matching-evaluation.md), S03): a missing observation time alone must not force abstention.

**Why `same` is not supported by this input:**

1. "Same" and "still" show that the condition is ongoing *from the reporter's viewpoint*. The reporter may mean their own earlier sighting, not the app's Happening. They may never have seen the existing Report.
2. Nothing else links the Report to the 22:00 observation: no observation time, no submission time, no starting Happening, and no details specific to the candidate's evidence.
3. Without a link, what remains is the same object, place and condition. The prompt's own rule says that alone does not establish identity.
4. A repair and a new failure could have happened between 22:00 and the unknown sighting, and nothing in the input excludes it.

**Why `unknown` is acceptable for the contributor.** `uncertain` shows "Could you clarify?" with the lamp listed. A `match` would show it as the suggested Happening, still subject to the contributor's confirmation (`match_review`). The contributor sees the same Happening either way, so the cost of `unknown` is one extra choice.

**Arguments considered and rejected:**

- *"Same/still" is direct evidence of continuity, so keep `same`.* Rejected because the referent of "same" is unknown (point 1).
- *Changing the label after seeing the model's answer inflates the score.* This is a real risk. It is mitigated by recording the change here and by adding S03a and S03c, which keep the original intent under test with labels that require `same`.

**Proposed cases:**

| Case | Change from S03 | Expected | Tests |
| --- | --- | --- | --- |
| S03 | None | `unknown` / `unknown` → `uncertain` | No link means no identity, even with "same/still" |
| S03a | `submittedAt` 22:30 (R3) | `same` / `unknown` → `match` | The original intent: a blank observation time alone does not force abstention when a link exists |
| S03b | `submittedAt` three days later, no repair evidence | Undecided (U1) | Whether a long gap is still a link |
| S03c | Started from the lamp's Happening (R5), no time | `same` / `unknown` → `match` | The starting Happening as a link |

**Effect on the v4 score.** If adopted, S03 becomes a v4 pass. The v4 record keeps its frozen score; any rescoring is reported separately and labelled as a post-hoc label change.

### Example: U04 under v6

The "reported resolved" note sits between the two dark observations, and the reporter says "I don't know whether it was ever repaired". The R1 rule requires `unknown`. Software returns `uncertain`, and the contributor is asked.

## Implementation boundaries

| Area | Proposed responsibility / change |
| --- | --- |
| Model / tools | `src/lib/report-model.ts`: `MATCHING_VERSION = "report-matching-v6"`; `compareReport` instruction (R1); `matchingSchema` property order and length guidance (R2); `input.report.submittedAt` (R3); the starting Happening, when set (R5). The exact-count change already shipped as v5 (companion proposal). |
| Data and relationships | No schema change. Stored assessments keep the same fields. `submitted_at` is already stored. |
| Lifecycle | Checkpoints compared under v5 are re-compared on their next processing request, per the existing version-revision rule. Confirm before shipping that a pending v5 comparison is not reused. |
| Storage / API / UI | No change. |
| Fixture model (`tests/external-services.ts`) | Accept the new property order, and assert that a matching request's `report` contains `submittedAt`. |
| Evaluation | `scripts/matching-fixtures.ts`: `submittedAt`, the S03 label change and S03a to S03c (R4). The scorer is unchanged. |
| Docs | `docs/implementation/report-processing-stages.md`: add a v6 entry describing R1 to R3. |

## Failure and recovery

- An invalid or incomplete model output is still rejected whole. The Report stays saved and retryable, as today.
- If v6 increases unsafe `same` on any case, do not ship. v5 remains the deployed version.
- If `submittedAt` is missing for a Report (not expected, since the column is `NOT NULL`), the matching request fails validation rather than sending `null`.

## Verification and acceptance

**Order of runs (Proposed):**

1. Label review (S03 confirmation, U1, U2) is complete and recorded before any v6 inference.
2. Run v5 + R2 only on the 48 development packets × 3. This isolates the schema-order effect.
3. Run full v6 on the same 48 × 3. Compare each case with the v5 suite run (companion proposal) and the v4 record; any of the 40 previously passing cases that now fails is a regression.
4. Qualification uses only the 24 independently authored held-out cases. The development results are not qualification evidence.

**Targets (Proposed; values Undecided until agreed):**

- [ ] Expected `unknown` → actual `same`: **0** on development and held-out sets.
- [ ] P03 distractors: `separate` in every repeat.
- [ ] No regression among the 40 cases that passed every v4 repeat.
- [ ] Complete validated responses: 100%.
- [ ] Reasons reaching 320 characters: 0. Sampled reasons contain no unsupported time or place claims (manual grounding review).
- [ ] Latency p95 stays well inside the 25 s budget. Report token usage against v4 (296k prompt / 40k completion).
- [ ] Fixture-model test: a matching request includes `report.submittedAt`, and `reportContext()` output and extraction fingerprints are unchanged.

## Delivery and open decisions

The smallest useful slice is R4 label review plus the R2-only run: no prompt change, and it shows how much of P03 and the truncation comes from the schema order. Then R1, R3 and R5 as v6. Rollback means reverting `MATCHING_VERSION`; stored assessments remain readable.

| ID | Question | Impact | Evidence to decide |
| --- | --- | --- | --- |
| U1 | How long a gap between the candidate's evidence and `submittedAt` still counts as a link, when there is no repair evidence? | S03b label; R1 wording | Product judgement against the guardrails; reviewer decision |
| U2 | Are T04 (scope spreads) and D04 (earlier blockage, later removed) `change` or `consistent`? | Chronology definitions in R1 and the answer key | Reviewer decision using R1 definitions |
| U3 | Is a reason target of about 200 characters enough for inspectable explanations? | R2 guidance | Grounding review of the R2-only run |
| U4 | Who authors the 24 held-out cases, and when? | Qualification cannot happen without them | Assign an author who has not seen these results |

## Decision record

**Outcome / date:** Pending.
**Agreed scope and rationale:** …
**Issue / ADR / implementation reference:** …
