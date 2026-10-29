# Agent evaluation: source notes

Accessed **2026-10-20**. Supporting research for the [architecture and evaluation guide](../guides/agent-architecture-and-evaluation.md). These notes summarize source guidance; Nearhood applications below are our recommendations, not vendor claims or implemented features.

## Anthropic: evaluation design

Published January 9, 2026; the original `/engineering/` address redirects to `/research/`.

An eval grades a task’s trials using traces and outcomes. Combine code, model, and human graders; calibrate model judges against people. Capability suites expose limitations; regression suites preserve established behavior. Repeat trials, isolate environments, inspect failures, and avoid overly rigid path checks. `pass@k` measures at least one success; `pass^k` measures consistent success across all attempts. Start with 20–50 realistic tasks, then maintain them. [Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/research/demystifying-evals-for-ai-agents)

## NVIDIA: framework scope and versions

The reviewed documentation identifies itself as **nightly**, not a pinned stable release. Its index describes benchmark environments, pluggable solvers, reporting, comparison, and gates. Follow the version index and pin a compatible package revision before adopting examples. [NeMo Evaluator home](https://docs.nvidia.com/nemo/evaluator), [nightly documentation index](https://docs.nvidia.com/nemo/evaluator/nightly/llms.txt)

The quickstart accepts a model endpoint, model ID, repeats, and problem limits. It produces per-problem results, trajectories, configuration/score bundles, runtime statistics, and failure analysis. The documented current CLI is `nel`; its example endpoints are NVIDIA-hosted examples, not a requirement to replace an existing provider. [Quickstart](https://docs.nvidia.com/nemo/evaluator/get-started/quickstart)

Custom single-turn benchmarks use `@benchmark` and `@scorer`, with local JSONL, Hugging Face, or callable datasets. A custom seed can construct messages. Stateful and multi-turn cases can subclass `EvalEnvironment`; benchmark declarations alone do not supply an application’s execution logic. [Write Your Own Benchmark](https://docs.nvidia.com/nemo/evaluator/tutorials/byob)

The architecture separates environment, solver, execution backend, and model deployment. `ChatSolver` calls chat completions; other solvers integrate tool loops and agent systems. External API deployment does not manage a model server. [Architecture](https://docs.nvidia.com/nemo/evaluator/architecture)

Scoring supports text/pattern checks, JSON schema validation, sandboxed code, and a configured model-judge stage. Metrics include `pass@k`, confidence intervals, and category breakdowns. JSON schema validation checks structure; it does not establish domain correctness. [Scoring](https://docs.nvidia.com/nemo/evaluator/evaluation/scoring)

Comparison pairs individual problems and repeats, inspects correct-to-incorrect flips, and uses McNemar’s exact test. Aggregate averages can conceal changed failures. A passing comparison means no detected meaningful regression, not proof of equivalence. [Comparing Evaluation Runs](https://docs.nvidia.com/nemo/evaluator/tutorials/compare)

Quality gates apply explicit multi-benchmark policies and require paired per-item data. Outcomes distinguish release approval, rejection, and insufficient evidence. Critical and supporting tiers both block; advisory does not. Its documented minimum paired-item rule is a tool policy, not a universal sample-size guarantee. [Implementing Quality Gates](https://docs.nvidia.com/nemo/evaluator/tutorials/quality-gate)

## Nearhood implications and open integration work

These are **our recommendations**:

- Keep three evaluation boundaries: raw provider compatibility, semantic decisions with fixed evidence packets, and the complete application workflow with controlled database state.
- A raw chat benchmark cannot establish that PostGIS found the right candidates, user confirmation protected membership, or retries preserved immutable Reports. Those require running our application and checking its outcomes.
- Begin with the existing TypeScript runner and reviewed fixtures. If adopting NeMo Evaluator, first build and verify a small adapter that invokes the same application orchestration and records its outcome; choose a custom environment/solver boundary based on that experiment. No drop-in TypeScript integration was established by this research.
- Freeze case IDs, evidence snapshots, prompt/model settings, validator versions, and grading rules per comparison. Treat authentication failures separately from semantic failures.
- Keep integration with NeMo Evaluator, release thresholds, and richer Shared Account reconciliation as proposals until implemented and verified. These notes install nothing and make no live provider calls.

No vendor commands or code were copied into this note. Recheck nightly documentation before using concrete APIs or flags.
