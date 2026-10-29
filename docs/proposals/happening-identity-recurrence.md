# Proposal: A recurrence with unknown history joins the same Happening

**Status:** Direction agreed in discussion with Maoyuan Wang on 2026-10-28. Details are a draft, not accepted or implemented.
**Author / date:** Agent draft for Maoyuan Wang, 2026-10-28.
**Related issues:** [#1](https://github.com/Pcworker996/nebius-hack/issues/1) (spec), [#4](https://github.com/Pcworker996/nebius-hack/issues/4) (matching), [#9](https://github.com/Pcworker996/nebius-hack/issues/9) (provisional resolution and reassessment). Evidence: [case review](../reviews/2026-10-28-issue-4-matching-case-review.md), [live matching record](../reviews/2026-10-27-issue-4-live-matching.md). Affects: [v6 revision proposal](ticket-4-matching-v6-revision.md), [ADR 0004](../adr/0004-confirm-matches-before-membership.md), [CONTEXT.md](../../CONTEXT.md).
**Decision requested:** Accept the identity rule in H1 and the activity rule in H2, and answer Q1 to Q4, before the v6 prompt and labels are written.

Labels: **Agreed** was decided in discussion. **Proposed** is a contract to accept or change. **Illustrative** can change without changing behavior. **Undecided** blocks the work that depends on it.

## Problem and evidence

**The current rule.** CONTEXT.md defines a Happening as an occurrence: "Separate occurrences are distinguished by evidence about continuity of the condition." Spec #1 adds: "A later recurrence requires evidence of a distinct occurrence; elapsed time or Reported resolved alone is insufficient. **Unclear continuity stays unassigned and prompts a focused question.**"

So a lamp that is dark, reported resolved, and dark again the next day, with nobody knowing whether it was repaired, has *unclear continuity*. The Report stays unassigned, and the contributor is asked to choose.

**Why this is a problem (observed):**

- **It asks a question nobody can answer.** Neither the contributor nor the evidence knows whether a repair happened. In the 2026-10-27 run, the U family (U01–U04, U01-duplicate-source) and S03 all turn on this question.
- **It is the hardest judgement for the model.** U04 produced the run's only unsafe errors, and S03's label needed a long discussion to settle.
- **It doesn't help readers.** A reader asking "is the lamp working?" needs the current state and its history, not a decision about where one occurrence ends.

**Why the history isn't lost (reasoning, agreed in discussion).** If the Report joins the existing Happening, the timeline still shows: dark (27 Oct 22:00) → reported resolved, unverified (28 Oct 12:00) → dark (28 Oct 22:00), repair unknown. The possible repair, the doubtful resolution and the recurrence all stay inspectable. A false resolution report is visibly contradicted rather than hidden.

**Where separation still matters (reasoning, agreed in discussion).** Merging is harmful when it creates a false claim:

- A closure for new works this week is not "closed since last month".
- Today's market is not yesterday's.
- A newly fallen tree is not the earlier branch.

These are different situations, and the evidence shows them to be different.

## Goal and scope

- **Outcome:**
  - A Report about the same problem at the same place joins that Happening unless evidence shows a different situation.
  - Unknown history is recorded inside the Happening's account, not settled by splitting.
  - Contributors are asked only when it's unclear *which* Happening the Report is about.
- **Included:** the identity rule (H1, H2), its effect on matching labels and fixtures, the account's handling of recurrence and gaps (H3), and the contributor's review (H4).
- **Deferred:** the full Reported resolved assessment and withdrawal (#9). This proposal only states what #9 must handle.
- **Unchanged:**
  - Contributor confirmation before joining an existing Happening ([ADR 0004](../adr/0004-confirm-matches-before-membership.md)). A recurrence is still a *suggested* match.
  - Reports describing separate situations stay unassigned (spec #1).
  - Candidate retrieval (radius, limits).
- **Constraints from the [guardrails](../product-guardrails.md):**
  - Do not fill gaps with plausible details.
  - Submission time is not observation time.
  - The account is provisional.
  - Avoid a binary active/resolved model.

## Options and recommendation

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| A. Keep "occurrence" identity (today) | The account never spans an unknown gap | Asks unanswerable questions; the hardest model judgement; one problem split across pins |
| **B. Same situation unless there is evidence of a different one (H1)** | Matches what readers need; simpler judgement; history preserved in the timeline | The account must represent gaps and reopening (H3); a long-dormant Happening could absorb an unrelated recurrence (Q1) |
| C. Always attach to the nearest same-category Happening | Simplest | Merges different situations; contradicts the guardrail that category and place alone don't establish identity |

**Recommendation: B (Agreed direction).**

## Concrete behavior

### H1. Identity rule for disruptions and safety concerns (Agreed direction; wording Proposed)

A Happening is **one problem at one place or object**, followed over time. It may stop, possibly stop, and recur.

For each candidate, matching answers: *Is this Report about this Happening's situation?*

| Label | New meaning | Examples |
| --- | --- | --- |
| `same` | Same problem at the same place or object, with no evidence of a different situation. Unknown repair history, elapsed time, an intervening resolution report or Reported resolved status **do not** prevent `same`. | U01, U02, U04 (lamp dark again); S03 ("same lamp still dark", no time); D03 and T02 (unchanged) |
| `separate` | Evidence of a **different situation**: a different object or problem (N01 sticker, N02 pothole); an explicitly new cause or object at the same place (N04 "a different tree"); explicitly new works or event; or the Report says it is different or unrelated | N01–N04, P distractors |
| `unknown` | It can't be told **which** Happening the Report is about, or whether the Report is about this problem at all | A03 (one of two lamps), A02-remove-identity, P01-remove-identity |

The label names stay the same, so the schema, validator, stored assessments and decision code don't change. Only the definitions change.

**What counts as a different cause (Decided 2026-10-29, Q2).** "Path blocked; I didn't see what blocks it" (U03) is the same situation under H1: the cause is unknown, not shown to be different. "Path blocked by a new fallen tree" after "branch removed" (N04) is separate. A *stated* different cause without a stated ending ("the road is closed again, this time for a parade") is also separate.

### H2. Activities keep instance identity (Agreed)

For activities, a Happening is **one scheduled instance**. A market on 26 October and a market on 27 October are separate Happenings (N03), even at the same place with the same organizer. Within one instance, reports about queues, a changed location or wrapping up are `same` (S04).

### H3. The account across a recurrence (Proposed)

When a confirmed Report joins a Happening after a gap or a resolution report:

- **The timeline orders all Observations by observation time** and shows the gap. Wording such as "No observations between 27 Oct 22:00 and 28 Oct 22:00; unknown whether it was repaired" is Illustrative.
- **The account never claims continuity across an unknown gap.** It must not say "dark since 27 Oct" or "dark for 24 hours". It may say "reported dark on 27 Oct and again on 28 Oct".
- **A resolution report followed by a contradicting Report** is shown as disagreement or change, not as an error in either Report.
- **Reported resolved status (#9):** a later Report of the condition triggers reassessment. Under #9's existing acceptance criteria, that can withdraw Reported resolved, and the status history stays visible. Until #9 is built, the account in #4 simply adds the new claim with its supporting Observation, as today.

### H4. Contributor review (Proposed)

The recommendation is still `match` → `match_review`, and the contributor confirms (ADR 0004). If the suggested Happening has a resolution report or Reported resolved status, the review card shows it, for example "Reported resolved on 28 Oct 12:00", so the contributor confirms knowing the history. The contributor can still decline and leave the Report unassigned.

### Example: U04

New Report "The Alder and Third lamp is dark now; I don't know whether it was ever repaired." (28 Oct 22:00). Candidate: dark at 22:00 on 27 Oct, plus "reported resolved, not verified" at 12:00 on 28 Oct.

| | Before | After |
| --- | --- | --- |
| Expected label | `unknown` → contributor asks/chooses | `same` → suggested match |
| Contributor sees | "Could you clarify?" | "Suggested Happening: Alder and Third lamp (reported resolved 28 Oct 12:00)" |
| After confirmation | n/a | The account lists dark (27 Oct), resolution report (28 Oct 12:00), dark (28 Oct 22:00), and that the repair is unknown. Under #9, Reported resolved is reassessed. |

### Example: a stated new cause (depends on Q2)

"The Main Street closure is back, this time for a parade." Candidate: Main Street closed for roadworks last week, reported reopened. If Q2 says a stated new cause is a different situation, the label is `separate` → a new Happening. Otherwise it is `same`, and the account shows the new cause.

## Implementation boundaries

| Area | Proposed responsibility / change |
| --- | --- |
| Domain docs | `CONTEXT.md`: redefine **Happening** (one problem at one place, followed over time; activities are one scheduled instance) and add **Recurrence** (a later Report of the same problem after it stopped or may have stopped; it belongs to the same Happening unless evidence shows a different situation). Spec #1: replace "Unclear continuity stays unassigned" with the H1 rule, keeping "elapsed time or Reported resolved alone is insufficient" as a reason to attach. |
| ADR | New ADR 0007, "Happening identity follows the situation, not the occurrence". It links ADR 0004, whose confirmation boundary is unchanged, and records the alternatives above. |
| Model / tools | v6 matching prompt: replace R1's continuity rules and "link" concept with H1 and H2 definitions. R2 (reason first), R3 (`submittedAt`), R5 (starting Happening) and the exact-count fix remain useful. `submittedAt` and the starting Happening now help ordering and grounding rather than deciding identity. |
| Matching code / schema | No change. Same enum; `isPlausible` and the decision rules unchanged. |
| Evaluation | Relabel per the table below before any v6 run. Add recurrence cases (see Verification). |
| Account synthesis | #4's software-derived claims: no change beyond ordering. Any model-written account must follow H3's no-continuity-across-gaps rule. |
| UI | H4: show resolution history on the review card. |
| #9 | Note in the issue that a recurrence joins the same Happening and triggers reassessment; withdrawal is the expected path. |

**Fixture labels under H1 and H2 (Proposed; each needs reviewer confirmation):**

| Case | Old | New | Reason |
| --- | --- | --- | --- |
| U01, U01-duplicate-source | `unknown` | `same` | Same lamp, dark again; unknown repair doesn't separate |
| U02 | `unknown` | `same` | Same barriers a week later; unknown reopening doesn't separate (but see Q1) |
| U03 | `unknown` | `same` | Same path blocked; cause unknown, not shown different (Q2) |
| U04 | `unknown` | `same` | An intervening resolution report doesn't separate |
| S03 | `same` (proposed `unknown` on 2026-10-28) | `same` | Same lamp still dark; the "link" requirement is withdrawn. The [S03 label reasoning](ticket-4-matching-v6-revision.md#s03-label-reasoning) is superseded. |
| N03 | `separate` | `separate` | H2: a different activity instance |
| N04 | `separate` | `separate` | Explicitly new object (a different tree) after a stated ending |
| N01, N02, P distractors | `separate` | `separate` | Different problem |
| A03, remove-identity variants | `unknown` | `unknown` | Can't tell which Happening |
| S, T, D, A, E (others) | unchanged | unchanged | Already same-situation cases |

With these labels, the v4 run's U04 errors become correct answers, and U01–U03's `unknown` answers become errors. **This is a change of rule, not a fix of the model.** The v4 record keeps its frozen score.

## Failure and recovery

- **Wrong attachment** (a different situation joined): the contributor declines at review; after confirmation, repair is #6 (rematching), which already reassesses both Happenings.
- **Dormant Happening absorbs an unrelated recurrence** (for example, the same lamp dark a year later): mitigated by the contributor's review and by Q1.
- **The account overstates continuity:** this is a synthesis defect under H3. Add a test case.
- **Retrieval misses the old Happening** (beyond 1,500 m, or more than 20 candidates): unchanged; incomplete coverage still blocks create-new.

## Verification and acceptance

- [ ] CONTEXT.md, spec #1 and ADR 0007 state H1 and H2 before any v6 inference.
- [ ] Fixture labels are updated per the table, and each change is recorded in the case's `review` note with this proposal's link.
- [ ] New cases (development material), each with an agreed label before inference:
  - **R1:** "dark again" after Reported resolved → `same`.
  - **R2:** a stated new cause after a stated reopening (Q2).
  - **R3:** the same object after a long dormancy (Q1).
  - **R4:** a recurring weekly activity, next week → `separate`.
  - **R5:** "dark again" with no resolution report and no time → `same`.
- [ ] Expected `separate` → actual `same` (merging different situations): 0 on development and held-out sets. This replaces "expected `unknown` → actual `same`" as the main safety target.
- [ ] Expected `same` → actual `separate` (a duplicate Happening is created without review): 0.
- [ ] Given a confirmed recurrence, the account lists both observations with their times and states the gap. It contains no duration or "since" claim across the gap.
- [ ] Given a Happening with a resolution report, the review card shows that history before confirmation.
- [ ] The held-out set includes recurrence and different-situation cases written against H1/H2 by someone who hasn't seen the development results.

## Delivery and open decisions

**Smallest useful slice:** the docs (CONTEXT.md, spec #1, ADR 0007), then relabelled fixtures plus R1–R5, then the v6 prompt. The review-card history (H4) and the #9 note can follow. The identity rule must be written down before any v6 run, so the prompt and labels follow one rulebook.

| ID | Question | Impact | Evidence to decide |
| --- | --- | --- | --- |
| Q1 | ~~Should a long-dormant Happening still absorb a recurrence?~~ | **Decided 2026-10-29:** yes, no time limit; the account shows the gap and the contributor still confirms the match. Recorded with v6 U1. | — |
| Q2 | ~~Is a stated different cause, without a stated ending, a different situation?~~ | **Decided 2026-10-29:** yes. A stated different cause is evidence of a different situation (`separate`), consistent with ADR 0007's "explicitly new … cause". | — |
| Q3 | ~~Should the matching reason say when it attaches across a resolution report?~~ | **Decided 2026-10-29:** yes; the reason must state it (e.g. "dark again after a reported repair on 15 Oct"). | — |
| Q4 | ~~Do the v6 R3/R5 inputs stay in scope?~~ | **Decided 2026-10-29:** yes, both: submission time and the starting Happening. | — |

## Decision record

**Outcome / date:** Direction agreed 2026-10-28: attach unless evidence shows a different situation (H1); activities keep instance identity (H2). Q1 to Q4 decided 2026-10-29 (see table).
**Agreed scope and rationale:** See Problem and evidence.
**Issue / ADR / implementation reference:** [ADR 0007](../adr/0007-happening-identity-follows-the-situation.md) and CONTEXT.md (Happening, Recurrence) drafted 2026-10-28. Pending: spec #1 wording, #9 note, v6 prompt, fixture relabelling.
