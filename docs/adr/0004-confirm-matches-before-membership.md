---
status: accepted
date: 2026-10-19
---

# Confirm matches before adding a Report to an existing Happening

Nearhood must avoid duplicate Happenings without treating proximity, category, wording similarity, or a preselected detail as proof that two Reports describe the same occurrence. For the initial Report flow, use deterministic location/time retrieval, model-assisted semantic ranking over a bounded packet of inspectable evidence, and contributor confirmation before adding the Report to an existing Happening.

Source: the product owner's October 19 revision in [ticket #4](../issues/4.md), [product guardrails](../product-guardrails.md), and [domain glossary](../../CONTEXT.md).

**October 21 revision:** [ADR 0005](0005-separate-extraction-from-matching.md) partially supersedes this record's five-candidate pre-comparison cutoff and combined-call architecture. It also resolves the hackathon boundary for separate-occurrence Reports: save them unassigned and explain why; guided answers are deferred. Contributor confirmation remains required and now explicitly covers later “Add an update” Reports. The sections below retain the October 19 decision and implementation history, not the new target contract.

**October 28 revision:** [ADR 0007](0007-happening-identity-follows-the-situation.md) changes what counts as the same Happening: unknown history (elapsed time, unknown repair, a resolution report or Reported resolved) no longer counts as uncertainty, so such Reports are suggested as matches for confirmation. "Uncertainty" below now means the Happening itself can't be identified. The confirmation boundary is unchanged.

**October 29 revision:** [ADR 0008](0008-uncertain-matches-publish-with-connections.md) changes what uncertainty does. The focused question no longer blocks: the contributor can also say the Report describes a different situation, or that they can't tell, and publish it as its own Happening with a displayed connection to the possible matches. Every possible match is offered, not five. "Uncertainty leaves the Report unassigned" below now holds only until the contributor answers. The confirmation boundary for joining an existing Happening is unchanged.

## Decision and responsibilities

- Save the immutable Report before processing. Keep submission and observation times distinct, and retain the contributor's original words, location, and provenance.
- Deterministic server code uses PostGIS to retrieve at most five evidence-bearing nearby Happenings. The current implementation default is a 1,500 m radius. Observation time orders candidates but no longer excludes them, so elapsed time alone cannot create a new Happening ([fix plan D2-B](../proposals/report-processing-fixes.md), 2026-10-23). These defaults are reviewable implementation choices, not validated product constants.
- Provide the model the saved Report's original words, observation time, contributor-described location and pin coordinates, provenance and cited URL, plus the retrieved candidates and bounded original Report/Observation evidence. The model may recommend a supplied candidate with evidence references, no plausible candidate, or uncertainty. Application code validates every candidate/evidence reference; the model cannot write memberships or create Happenings.
- Show the best recommendation first with its source evidence, place, and chronology. The contributor may confirm it, inspect more candidates, or say the shown candidates describe a different situation. Do not ask whether the situation is "new."
- A confirmed match atomically adds the Report's Observations to that Happening and publishes the next provisional Shared Account. A successful semantic no-match may create a new Happening only when the Report describes one coherent occurrence. Uncertainty leaves the Report unassigned and asks a focused question. Search/model/database failures leave the saved Report retryable and never mean no match.
- Persist candidate IDs and their evidence packet, recommendation, matching outcome, user decision, candidate IDs the contributor reports seeing, actor, and time in the private processing record. Keep this decision history separate from the immutable Report.
- Do not distribute one Report across multiple Happenings automatically. The product owner has not confirmed how to clarify a Report that describes separate occurrences; that flow remains an explicit unresolved boundary for ticket #4.

The simpler alternative—automatically attach the nearest or preselected Happening—would reduce interaction but can merge distinct occurrences and alter an existing Shared Account without the contributor's confirmation. Asking the contributor to label a Report new would transfer the system's identity-matching work to the person submitting evidence. Progressive evidence review costs an extra interaction and additional processing states, but preserves evidence, uncertainty, and contributor agency.

## Consequences

- `nearhood.report_processing` stores the candidate snapshot, recommendation, outcome, and attributed decision; its lifecycle includes `match_review` and `clarification`.
- `POST /api/reports/:id/process` performs search and model comparison. `POST /api/reports/:id/match` validates an owner-authorized decision and performs the membership/account transaction. The read API returns the saved review so it survives reload.
- Candidate retrieval does not hard-filter by category. It considers spatial distance and observation chronology; evidence-less Happenings cannot be recommended. A preselected Happening only affects candidate ordering when it is within the bounded search.
- Rejected candidates create a new Happening only after the candidate search and semantic comparison succeeded. A model, database, or search failure never creates a Report-only pin as a substitute for matching.
- Radius, time window, candidate/evidence limits, and display details may change after review of actual local evidence and live model behavior. Changing the membership-confirmation boundary requires revisiting this ADR and ticket #4.

## Implementation and verification status

The implementation is in [ticket #4](../issues/4.md), [the implementation spec](../implementation/report-submission.md), and the matching migrations and server/UI paths linked there. Local browser tests use the real application APIs and PostgreSQL with controlled external auth/model HTTP services, following [ADR 0003](0003-test-through-the-product-boundary.md). Live Google configuration, hosted migration state, exact Nebius model selection, and separate-occurrence clarification remain unverified or unresolved and must not be presented as complete.
