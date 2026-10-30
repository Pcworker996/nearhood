---
status: accepted
date: 2026-10-16
---

# Preserve original evidence separately from derived accounts

Nearhood must explain what supports a local account even when observations disagree or the interpretation changes. Preserve Reports, derived Observations, Happenings, and versioned provisional Shared accounts as distinct records, with claim-specific links through Observations to original Reports. This supports inspection and reinterpretation without silently replacing a contributor's words with generated text.

Sources: [spec #1](../issues/1.md), [browsing slice #3](../issues/3.md), [product guardrails](../product-guardrails.md), and [domain glossary](../../CONTEXT.md).

## Consequences and responsibilities

- Storage retains original words, provenance, separate submission/observation times, membership relationships, account versions, and claim supports. Unknown observation times remain nullable.
- The read API returns account claims and evidence scoped to the selected Happening; the UI distinguishes derived interpretation from original words and offers a timeline.
- Chronology and spatial scope inform interpretation. A newer submission is not necessarily a newer observation; improvement at one entrance does not establish full reopening.
- Models assist interpretation and synthesis. Deterministic software owns identifiers, persistence, timestamps, relationships, and validation. A valid citation alone does not prove the claim's scope is supported.
- A derived Observation stores its interpretation (a described condition, or none, plus its uncertainty), never a copy of the Report. The original stays linked through the Observation and is shown beside it, so a qualification cannot be lost.
- A Happening created from a Report reuses that Report's identifier. This is deliberate: the owner's pending Report pin is replaced in place when publication creates the Happening. The records stay distinct; only the identifier value is shared.

The simpler alternative—one editable summary attached to a map pin—would lose the distinction between evidence and interpretation. Keeping separate entities and relationships costs schema, query, and UI complexity, but that complexity serves the core product goal. This decision does not require a complete event-sourcing architecture.

## Implementation and verification status

[Migration 001](../../db/migrations/001_browsing.sql), the [read repository](../../src/lib/database.ts), and [browser tests](../../tests/browse.spec.ts) implement and verify the seeded browsing/claim-inspection path. Tests cover original evidence after reload, unknown times, and cross-Happening claim isolation.

Live extraction, matching, account publication, correction history, and obsolete-result protection remain later-ticket work. Existing tables and fixture account versions do not demonstrate those lifecycles. Their detailed transitions and acceptance cases belong in the applicable issues before implementation.
