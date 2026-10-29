---
status: accepted
date: 2026-10-29
---

# Uncertain matches never block a Report; possible duplicates are shown as attributed connections

When matching couldn't tell which nearby Happening a Report describes, [ADR 0004](0004-confirm-matches-before-membership.md) left the Report unassigned until its contributor answered a question. In practice the Report disappeared: it stayed unpublished, the question could not always be answered (more than five possible matches, or one Happening's evidence cut short), and the contributor often never came back ([#20](https://github.com/Pcworker996/nebius-hack/issues/20)). Publishing every uncertain Report as new was rejected because it would split Reports that belong together, including the V1 demo's partial-reopening step.

Source: discussion with the product owner, Maoyuan Wang, on 2026-10-29, recorded in the [possible-duplicate connections proposal](../proposals/possible-duplicate-links.md). Research: [duplicate report handling](../research/duplicate-report-handling.md), [uncertain match handling](../research/uncertain-match-handling.md).

## Decision

- **Fewer questions.** Software maps each assessment to an effective grade (`separate` with chronology `conflict` counts as `unknown`). Exactly one `same` gives a suggestion even when other candidates are `unknown`.
- **The question never blocks.** When no candidate is `same` but some are `unknown`, the contributor can add the Report to a shown Happening, say it describes a different situation, or say they can't tell and publish it on its own. Every possible match is offered (five shown, the rest behind "Show more").
- **Left-out evidence is disclosed, not blocking.** Reports cut from one Happening's evidence are noted on that Happening; only a truncated pool of Happenings still prevents automatic publication as new.
- **Any suggested connection is shown.** When a person or automatic matching suggests two Happenings may describe the same situation, a connection is displayed on both Happening pages and as one uncertainty item in each Shared Account, whether or not it is accurate. It is a list of immutable, attributed statements tied to Reports: automatic "possibly same", a contributor's "couldn't tell", a contributor's "different". A "different" never hides it.
- **People add statements only through their own Report's matching question.** There is no button on a Happening page.
- **Repair is moving your own Report.** Only a Report's contributor moves it between connected Happenings. An emptied Happening becomes a redirect; its ID is never reused. No one merges whole Happenings; a steward role is deferred.
- **Unchanged:** a Report joins an existing Happening only with its contributor's confirmation; nothing is merged automatically; a connection never changes membership or claims; map pins are unchanged.

## Consequences

- New records: Happening connections and connection statements; later, a redirect field and membership-change history.
- A connection creates a new Shared Account version for both Happenings. That changes their fingerprints, so a contributor reviewing a nearby Report at the same moment is asked to refresh.
- Until grading improves ([v6 contract](../proposals/ticket-4-matching-v6-revision.md#consolidated-v6-contract-2026-10-29)), automatic statements would connect many unrelated demo Happenings. Connections ship only after the v6 grading is measured.
- Duplicate pins will exist, visibly connected. Without a steward role, a Happening joined by several contributors can only be emptied by each moving their own Report.
- Reports whose contributor never answers are still unpublished; [#20](https://github.com/Pcworker996/nebius-hack/issues/20) owns that.

## Alternatives

- **Keep asking and blocking (ADR 0004 as written).** Nothing is guessed, but Reports disappear and the question can be unanswerable.
- **Publish every uncertain Report as new, flagged.** Nothing waits, but Reports that belong to an existing Happening are split, including the demo's core step.
- **Let a "different" answer dismiss the connection.** Fewer notices, but one person's view would hide another's suggestion; rejected because disagreement is evidence.

## Implementation and verification status

**Not implemented.** Delivery slices and acceptance criteria are in the [proposal](../proposals/possible-duplicate-links.md#delivery-and-open-decisions).
