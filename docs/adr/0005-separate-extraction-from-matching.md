---
status: accepted
date: 2026-10-21
---

# Separate extraction from matching in a durable fixed workflow

Nearhood needs to distinguish what a contributor reports from which evolving occurrence it describes. Use one software-controlled workflow with a dedicated Report-to-JSON LLM call, a validated persistent extraction checkpoint, deterministic nearby retrieval, and a second LLM call comparing the JSON and original evidence with candidate Happenings. Require contributor confirmation before existing-Happening membership for initial Reports and “Add an update” alike. Models cannot choose tools, write membership or run an open-ended loop.

Sources: the product owner's October 21 decisions in [spec #1](https://github.com/Pcworker996/nebius-hack/issues/1), [plan #2](https://github.com/Pcworker996/nebius-hack/issues/2), and [the revised matching contract](../proposals/report-matching-strategy.md). Implementation belongs to [#4](https://github.com/Pcworker996/nebius-hack/issues/4) and [#5](https://github.com/Pcworker996/nebius-hack/issues/5).

## Relationship to ADR 0004

This partially supersedes [ADR 0004](0004-confirm-matches-before-membership.md): the pre-comparison five-candidate cutoff and combined extraction/matching call are replaced. Compare a larger bounded pool, initially evaluating 20, before selecting the best suggestion and at most four alternatives for review. ADR 0004's immutable Reports, deterministic retrieval, validated evidence, contributor confirmation, attribution and atomic publication remain in force.

## Consequences and tradeoffs

- Two bounded model tasks and a saved checkpoint make stage inspection and retry easier, at the cost of sequential latency, more provider failure points and checkpoint/version complexity. Better accuracy is unproven until evaluated against the combined-call baseline.
- Original Reports accompany JSON during matching; neither extraction nor a valid citation establishes truth. Separate occurrence identity from agreement: genuine conflict can belong to the same Happening; later recurrence needs evidence of a distinct occurrence.
- Keep multiple separate occurrences unassigned and explain why for the hackathon. Guided answers, automatic distribution, embeddings, physical-object identity registries and automatic merging are deferred. Do not erase their Reports or publish unrelated claims into one Happening.
- Save each validated stage separately from the original Report. Matching retry reuses only compatible extraction and refreshes candidate evidence. Run at most one provider stage per processing request; the existing 35-second provider timeout cannot simply be doubled inside the current 60-second route/lease. Validate actual stage budgets before release.
- Bound the total evidence packet, preserve relevant source context, and record omitted coverage. A truncated pool, uncertainty or failure is not evidence of no match. Contributor rejection applies only to displayed candidates, not unshown plausible ones.
- Keep provider work outside transactions and use short authorized, version-checked publication transactions. Account reconciliation/synthesis remains a subsequent validated responsibility in #5; the two matching calls do not replace it.

The alternative combined call saves one round trip and avoids a checkpoint but couples extraction, matching and recovery. Autonomous tool selection adds operational freedom without a demonstrated need in this milestone. The accepted fixed workflow prioritizes inspectable stages and recovery; evaluation must measure its costs as well as correctness.

## Implementation status

The staged intake and matching foundation is implemented locally in #4; its versioned schemas, storage, recovery API, source supports and publication boundary are specified in the [processing contract](../implementation/report-processing-stages.md). The [verification record](../reviews/2026-10-22-issue-4-stages.md) distinguishes controlled-service checks from live provider checks. Hosted migration, real Google draft recovery, Vercel database targeting and model qualification remain release gates. #5 still owns account reconciliation and the hosted evidence-change demonstration.
