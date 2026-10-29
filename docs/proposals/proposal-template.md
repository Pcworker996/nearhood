# Proposal: Short description of the change

<!-- Copy to a descriptive kebab-case filename in this folder. Scale the detail
with the change; omit sections that do not apply. Replace prompts with concrete
behavior before asking someone to review or implement it. -->

**Status:** Draft — not accepted or implemented.  
**Author / date:** …  
**Related issues:** #…  
**Decision requested:** One sentence identifying what needs agreement.

## Problem and evidence

Who is affected, under which conditions, and what happens today?
Include a concrete example and links to evidence. Separate observations,
assumptions, and unverified hypotheses.

## Goal and scope

- Intended user or system outcome: …
- Included in this proposal: …
- Explicitly deferred: …
- Constraints from the [domain glossary](../../CONTEXT.md), [product guardrails](../product-guardrails.md), and [ADRs](../adr/README.md): …

Identify any conflict with an accepted ADR and why reconsidering it is warranted.

## Options and recommendation

| Option                       | Benefit | Cost / limitation |
| ---------------------------- | ------- | ----------------- |
| Keep the current behavior    | …       | …                 |
| Proposed approach            | …       | …                 |
| Relevant alternative, if any | …       | …                 |

Recommend an option and explain the tradeoff. Mark illustrative values and
unresolved choices explicitly; a proposal is not evidence of agreement.

## Concrete behavior

Describe a representative input, what the user sees or does, the system's
response, and the resulting state. Include a meaningful failure or uncertainty
example. Distinguish current behavior from the proposed change.

## Implementation boundaries

| Area                         | Proposed responsibility / change                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Data and relationships       | Affected entities, ownership, evidence references, and invariants.                                                   |
| Lifecycle                    | Starting state, permitted transitions, actors, and terminal/retry states.                                            |
| Storage                      | New or changed records; migration/backfill and historical-data handling if applicable.                               |
| API                          | Input/output contract, validation, authorization, idempotency, and compatibility.                                    |
| UI                           | Actions, feedback, evidence inspection, and uncertainty presentation.                                                |
| Model / tools, if applicable | Supplied context, permitted decisions/actions, output contract, deterministic validation, and call/deadline budgets. |

Link to affected modules. Avoid repeating a full schema or API specification if
an authoritative document already owns it.

## Failure and recovery

Explain missing evidence, invalid output, partial failure, timeout, retry,
concurrency, and stale-result handling where relevant. State what remains saved,
what may change, and how the user resumes. Include data/permission boundaries.

## Verification and acceptance

- [ ] Given …, when …, the user observes … and the saved state is …
- [ ] On … failure or ambiguity, … is preserved and … remains unassigned/retryable.
- [ ] Repeating … does not duplicate … or overwrite …

For model changes, identify reviewed evaluation cases, the baseline, grading
criteria, important failure rates, and latency/cost targets. Mark target values
as proposed until agreed. Specify which checks use fixtures versus live services.
Use the [evaluation guide](../guides/agent-architecture-and-evaluation.md).

## Delivery and open decisions

Describe the smallest useful slice, dependencies, and migration/rollback or
version-recovery needs. Keep the delivery checklist and current task status in
the linked GitHub issue.

List unresolved questions with their impact and the evidence needed to decide.

## Decision record

**Outcome / date:** Pending.  
**Agreed scope and rationale:** …  
**Issue / ADR / implementation reference:** …

After a decision, retain this proposal as context and point readers to the
accepted issue/ADR. Acceptance, implementation, verification, and deployment
are separate milestones.
`