# Domain docs

This repo uses a single-context layout:

- CONTEXT.md at the repo root for domain terminology.
- docs/adr/ for architectural decisions.

## Before exploring

Read CONTEXT.md and ADRs relevant to the area being explored.

If these files do not exist, proceed silently. Do not flag their absence
or suggest creating them upfront. The domain-modeling skill creates
them as terminology and decisions are resolved.

If CONTEXT-MAP.md is introduced later, follow its pointers and read
the context documents relevant to the task.

## Use the glossary’s vocabulary

Use terms defined in CONTEXT.md in issue titles, proposals, hypotheses,
and tests. Avoid synonyms the glossary explicitly excludes.

If a needed concept is missing, reconsider the term or note the gap
for domain-modeling.

## Flag ADR conflicts

Explicitly identify any proposal that contradicts an existing ADR,
including which ADR it conflicts with and why reopening it is warranted.

## Connect concepts to implementation

When a product or engineering idea is introduced, document how its higher-level
purpose maps to a concrete implementation before coding. Include the parts that
apply to the idea:

- The user-visible flow and system behavior.
- The domain entities, relationships, ownership, and lifecycle changes.
- The persistence, API, UI, and deterministic or model-assisted responsibilities.
- Permissions, data boundaries, and relevant failure, ambiguity, or uncertainty
  behavior.
- Acceptance criteria that make the expected result reviewable.

Keep agreed decisions separate from examples and unresolved questions. If a
choice materially changes the domain model or system boundaries, record the
decision in `docs/adr/` and link it from the relevant issue. Keep the approach
proportional to the scope; the purpose is to remove consequential guesswork,
not to prescribe code prematurely.
