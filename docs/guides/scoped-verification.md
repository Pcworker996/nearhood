# Verification within a defined scope

Status: proposed reusable workflow, October 22, 2026. This guide adds no product requirements or mandatory repository gates. Requirements and current results belong in the project's issue tracker. In Nearhood, use [GitHub Issues](https://github.com/Pcworker996/nebius-hack/issues), the [product guardrails](../product-guardrails.md), and accepted ADRs. For background, see [Software quality](software-quality.md).

Use this workflow for a project milestone, feature, bug fix or release. Choose one unit of work per record. It covers both verification (does the implementation meet its contract?) and validation (does that contract and experience serve the intended outcome?).

The trace is:

> Outcome → scope → observable claims → design responsibilities → checks → evidence → decision.

## 1. Write the scope before selecting checks

Record these in the originating issue or a linked design document:

- **Outcome:** who needs to accomplish what, and why?
- **In scope:** the user journey, system behavior and boundaries this work delivers.
- **Excluded:** adjacent capabilities deliberately deferred, with their issue links when available.
- **Completion level:** design accepted, locally verified, integrated with real dependencies, or released and checked in the target environment. These are distinct claims.
- **Standing constraints:** existing data, privacy, security, compatibility and product rules that must continue to hold.
- **Unknowns:** consequential decisions or assumptions, with an owner and a way to resolve them.

Separate agreed requirements, proposed choices and illustrative examples. An example becomes a requirement only through an explicit scope decision. A local milestone may finish while deployment remains another milestone; it cannot close a ticket whose acceptance requires deployment.

Scope changes require an explicit update to the issue and verification record. Do not silently drop a failed criterion or add a new feature to make a check pass.

## 2. Make a small set of observable claims

Start with the central journey and the rules whose violation would defeat it. Each claim needs an expected result that someone can assess without reading the implementation. “Uses two services” describes structure; “a failed second stage resumes without repeating a compatible first stage” describes verifiable behavior.

For each claim, specify the applicable parts:

- Trigger, actor and preconditions; visible success and failure behavior.
- Affected entities, relationships, ownership and state transitions.
- Storage, API, UI and external-service responsibilities.
- Authorization, retries, ambiguity, stale results and concurrency boundaries.
- Constraints such as latency, cost or scale, with an agreed target and rationale.

Use this matrix as the central record:

| ID / requirement link | Scenario and expected result | Design responsibility | Failure consequence / priority | Check and evidence needed | Result / evidence link |
| --- | --- | --- | --- | --- | --- |
| C1 | Given … when … then … | Storage/API/UI/service boundary | Why this matters; blocker or follow-up | Review, test, evaluation or walkthrough; environment | Unverified / pass / fail / inconclusive |

Define expected outcomes and thresholds before evaluating. When judgment is involved, describe acceptable alternatives and unacceptable results. “Uncertain” can be correct for an ambiguous input and inadequate for a clear input.

## 3. Challenge the design before coding

Walk through one normal journey and the highest-consequence applicable failures. Trace actions across boundaries and inspect what is saved, who can act and what the user sees.

Ask:

1. Would satisfying these claims actually accomplish the user's outcome?
2. Is each important decision owned by a specific component or person?
3. Can the representation preserve the information the outcome requires?
4. Are allowed states, transitions and recovery paths defined?
5. Which assumptions depend on a provider, environment or uncertain judgment?
6. Could a simpler design satisfy the same claims and constraints?

Choose only relevant failure scenarios: interruption, duplicate delivery, concurrent updates, stale results, unknown inputs, unauthorized access or dependency failure. Do not demand every category for every change.

**Exit:** important claims have buildable contracts and feasible checks; consequential unknowns are resolved or explicitly become a bounded experiment. A design review can accept an approach for implementation while model quality or operational feasibility remains unproven. Record that distinction.

## 4. Choose evidence proportional to the consequence

Every check must map to a scope claim, standing constraint or credible regression risk. Every release-blocking claim must have a check. Remove checks that provide no useful additional evidence.

| Question | Useful evidence | Limit |
| --- | --- | --- |
| Is the goal translated into a coherent contract? | Scenario walkthrough and design review | Does not establish implemented behavior |
| Does the changed code follow standards and implement the contract? | Code review: Standards and Spec axes | Can share mistaken requirements; does not prove runtime results |
| Does a deterministic rule hold? | Focused behavioral test at the enforcing boundary | Selected inputs and boundary only |
| Do components preserve the rule together? | Integration or browser/API/persistence journey | Controlled dependencies leave integration assumptions |
| Does a model or heuristic make adequate decisions? | Reviewed cases, baseline comparison and error analysis | Sampled performance; no guarantee for unseen cases |
| Can a person complete and understand the journey? | Task walkthrough with observable success criteria | One reviewer is weaker evidence than representative users |
| Does the actual deployment work? | Real dependency checks and target-environment journey | Narrow smoke checks do not establish broad correctness |

For judgment-heavy systems, use representative cases, difficult boundaries and fresh held-out cases. Record who set expected outcomes, disagreements, per-case errors, sample size, versions, latency and cost when relevant. Define acceptance thresholds from the product's consequences; a single accuracy average can hide unacceptable errors.

Scale down for small changes. A copy correction may need a diff review and rendered inspection. A stateful external-service workflow needs persistence, authorization, recovery and integration evidence. Avoid duplicating every check at every testing layer.

## 5. Execute and keep evidence tied to the revision

For each result, record:

- Code revision and applicable schema/configuration/model/prompt versions.
- Environment and data setup; which dependencies were real or controlled.
- Expected result, observed result, command or reproducible steps, and artifact link.
- Remaining limitations and the person responsible for the next decision.

Use four results: **pass**, **fail**, **unverified**, **inconclusive**. Missing credentials means unverified, not pass. A flaky or uninterpretable run is inconclusive until investigated. A valid model response is not necessarily a correct decision.

Re-run affected checks after a relevant change. Reuse evidence only when its revision, environment and assumptions still apply. Broaden verification when a failure exposes a wider risk; stop repeating checks that add no new evidence.

## 6. Make separate acceptance decisions

| Decision | Required conclusion |
| --- | --- |
| Design accepted | The scoped outcome, contracts, ownership and verification plan are coherent; unresolved assumptions have explicit treatment. |
| Implementation verified | Required behavior and regression checks pass for the named revision and environment; code review findings are resolved or explicitly accepted. |
| Release accepted | Required real dependencies, deployment, operational budgets and recovery arrangements have evidence appropriate to this release. |

Name who can accept product tradeoffs and who owns technical evidence. One person may fill both roles on a small project. A reviewer who did not author the implementation is useful for consequential changes.

**Stop rule:** the selected completion level is met, all its blocking claims have adequate current evidence, and remaining gaps have explicit disposition. Report only that completion level.

A gap can be fixed, remain blocking, or be accepted by the responsible owner with rationale and a linked follow-up. An accepted limitation remains a limitation. Standing constraints cannot be waived implicitly by changing a test expectation.

Classify discoveries to protect scope:

- **Blocks the current outcome or violates a standing constraint:** resolve here or leave the milestone incomplete.
- **Exposes a dependency necessary for this outcome:** make it an explicit prerequisite or revise scope with the owner.
- **Improves an adjacent capability:** create a follow-up; do not expand this work automatically.

## Copyable verification record

```markdown
# Verification: <project / milestone / issue>

Status: draft / ready to implement / verifying / accepted / blocked
Requirement source:
Product decision owner:
Technical evidence owner:
Revision / environment:

## Scope
Outcome:
In scope:
Excluded / follow-up links:
Required completion level:
Standing constraints:
Agreed decisions:
Proposed choices / illustrative examples:
Unknowns, owner and resolution method:

## Claims and evidence
| ID / requirement | Scenario → expected result | Responsibility | Consequence / blocker? | Check / environment | Result / evidence |
| --- | --- | --- | --- | --- | --- |

## Design review
Normal journey and important failure walkthroughs:
Boundary/state/data decisions:
Alternatives and rationale:
Assumptions requiring experiments:

## Decision
Design: accepted / pending; reason and owner
Implementation: verified / pending; revision and environment
Release: accepted / pending / outside this milestone
Failures, unverified claims and inconclusive results:
Accepted limitations, owner, rationale and follow-up:
What this evidence does and does not establish:
```

## Nearhood ticket #4: illustrative application

Source: [ticket #4](https://github.com/Pcworker996/nebius-hack/issues/4). These examples explain the workflow; they are not a fresh assessment or new acceptance criteria. Use the issue for current scope and results.

**Outcome:** a contributor can submit a Report, retain its original evidence, and reach a supported first publication or an understandable saved/unassigned state.

**Boundary:** intake, extraction, retrieval, matching, contributor confirmation and first publication. Later reconciliation of evidence into an existing Shared Account is #5; richer clarification/repair is #6. Existing-Happening matching still needs verification within #4 even though later reconciliation is separate.

| Claim | Evidence to seek | Scope implication |
| --- | --- | --- |
| Original Report survives interrupted processing | Save, interrupt, reload and retry through the real application and isolated database | Required integrity behavior |
| Uncertain matching cannot produce unsupported membership or creation | Controlled failure/coverage cases plus reviewed live-model cases | Application safeguards and model quality are separate claims |
| Confirmation cannot publish stale or foreign choices | Authorization and concurrent evidence-change journeys | Required boundary protection |
| Real sign-in preserves the draft | Actual Google sign-in and recovery in the required environment | Fixtures cannot satisfy this integration claim |
| The account later explains partial improvement | Verify matching in #4; verify later reconciliation/account change under #5 | Cross-ticket milestone; neither ticket silently absorbs the other |

The existing `code-review` skill supplies Standards/Spec evidence for a pinned diff. This workflow also challenges the scope and contract, selects runtime/evaluation evidence, and makes an explicit completion decision.
