---
status: accepted
date: 2026-10-28
---

# Happening identity follows the situation, not the occurrence

Until now, a Happening was one *occurrence* of a condition. [CONTEXT.md](../../CONTEXT.md) separated occurrences "by evidence about continuity of the condition". Spec [#1](https://github.com/Pcworker996/nebius-hack/issues/1) left a Report with "unclear continuity" unassigned and asked the contributor a focused question.

A common case defeats that rule. A lamp is reported dark, then reported resolved without anyone verifying a repair, then reported dark again. Nobody can say whether it was repaired in between, so the contributor is asked a question nobody can answer. In the [2026-10-27 live matching run](../reviews/2026-10-27-issue-4-live-matching.md), this judgement produced the only unsafe model errors (U04), and it drives most of the unknown-history cases ([case review](../reviews/2026-10-28-issue-4-matching-case-review.md)). Readers need the current state and its history, not a decision about where one occurrence ended.

Source: discussion with the product owner, Maoyuan Wang, on 2026-10-28, recorded in the [Happening identity proposal](../proposals/happening-identity-recurrence.md).

## Decision

- **Disruptions and safety concerns:** a Happening is one problem at one place or object, followed over time. A later Report about the same problem at the same place belongs to it unless evidence shows a **different situation**: a different problem or object, an explicitly new object, cause or event, or a statement that it is different or unrelated.
- **Unknown history does not separate.** Elapsed time, unknown repair history, an intervening resolution report and Reported resolved status are not, by themselves, evidence of a different situation.
- **Activities:** a Happening is one scheduled instance. The same market on a different day is a different Happening.
- **The account carries the history.** The account orders Observations by observation time and shows gaps. It never claims the condition was continuous across an unknown gap: "reported dark on 27 Oct and again on 28 Oct", not "dark since 27 Oct". A recurrence after Reported resolved triggers reassessment, which can withdraw the status (#9).
- **Contributor confirmation is unchanged.** Joining an existing Happening still requires the contributor's confirmation ([ADR 0004](0004-confirm-matches-before-membership.md)). The review shows any resolution history on the suggested Happening.
- **Matching still asks the contributor** when it can't tell *which* Happening a Report is about. A Report describing separate situations still stays unassigned.

## Consequences

- **Matching labels keep their names; their meanings change.** `same` is the same situation; `separate` is evidence of a different situation; `unknown` means the Happening can't be identified. The schema, validator, stored assessments and recommendation rules are unchanged; the prompt and evaluation labels change.
- **The main matching safety target changes.** It becomes "never merge different situations" (expected `separate`, actual `same`), alongside "never create a duplicate Happening without review" (expected `same`, actual `separate`).
- **Fewer clarification questions** for unknown-history Reports. More Reports are suggested as matches, and contributors confirm them.
- **The Shared Account must represent gaps and reopening.** A synthesis that implies continuity across a gap is a defect.
- **A long-dormant Happening could absorb an unrelated recurrence.** Decided 2026-10-29: no time limit (proposal Q1). A stated different cause is a different situation (proposal Q2). Contributor review and #6 rematching are the safeguards until then.
- Spec #1's "Unclear continuity stays unassigned and prompts a focused question" no longer applies to unknown history. It still applies when the Happening itself can't be identified.

## Alternatives

- **Keep occurrence identity.** The account never spans an unknown gap, but contributors are asked unanswerable questions, one problem is split across pins, and the model's hardest judgement remains.
- **Always attach to the nearest Happening of the same category.** Simplest, but it merges different situations and treats category and place as identity, which the guardrails reject.

## Implementation and verification status

**Not implemented.**

**Open questions:**
- Q1: a dormancy limit.
- Q2: whether a stated different cause without a stated ending is a different situation.

**Pending updates:**
- Spec #1 wording.
- A note on #9.
- The v6 matching prompt.
- The relabelled evaluation fixtures, with new recurrence cases.

These are listed in the [proposal](../proposals/happening-identity-recurrence.md). The v4 evaluation record keeps its frozen score under the old rule.
