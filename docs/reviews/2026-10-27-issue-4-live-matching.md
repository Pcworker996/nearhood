# Ticket #4: matching-only live development evaluation

October 27, 2026. **The model is not qualified.** Automated assessment assertions passed in 122 of 144 trials. Forty of 48 development cases passed all three repeats. There are unsafe same-occurrence assessments, unnecessary uncertainty, one incomplete response, and unresolved label and grounding questions.

Source: [ticket #4](../issues/4.md), [matching suite design](../proposals/ticket-4-matching-evaluation.md), and [processing contract](../implementation/report-processing-stages.md). This record does not close any release checkbox.

Follow-up: [saved Report state after matching](2026-10-27-issue-4-matching-states.md) replays selected recorded outputs through real application APIs and PostgreSQL to verify publication, review, clarification, pending and confirmation. That is separate evidence from the model-quality scores here.

## Scope and provenance

This was live inference through Nebius with exact model `nvidia/Nemotron-3-Ultra-550b-a55b` and `report-matching-v4`. It called production `compareReport` directly with 32 synthetic base packets and 16 controlled variants. Each was attempted three times, without automatic retries, in a recorded seeded order.

The extraction JSON and candidate evidence were authored and fixed before inference. No extraction model, database retrieval, browser, confirmation, membership publication, account synthesis, or external source fetching was run. These results measure matching with supplied evidence, not retrieval or end-to-end application performance.

The same agent authored the development labels and this review. They have not received independent human sign-off. The 24 proposed independently authored held-out cases were not available and were not fabricated or substituted with development examples. There is no held-out result in this record.

The working tree already contained unrelated changes. This task added evaluation tooling and records without changing the production prompt, adapter, matching rules, or application behavior. Exact production-source and fixture-source fingerprints at the time of inference are recorded in the manifest, together with all materialized input packets. Fixture source was formatted after inference; materialized packet hashes remain the reproduction reference.

Artifacts:

- [Frozen inputs and run manifest](artifacts/2026-10-27-issue-4-matching/manifest.json).
- [Every request, raw response, assessment, score and failed attempt](artifacts/2026-10-27-issue-4-matching/attempts.jsonl).
- [Summary and per-case results](artifacts/2026-10-27-issue-4-matching/summary.json).
- [Agent grounding inspection and its limits](artifacts/2026-10-27-issue-4-matching/grounding-review.json).

Requests contain synthetic Report text and evidence, not authorization headers or keys. The API key is not stored in the artifacts.

## Automated results

An automated model pass requires the expected continuity values, any required chronology and scope, required evidence IDs, and target ranking. It does not establish semantic grounding of the prose reason. Recommendations are derived by software and are scored separately.

| Measure | Base cases | Variants | Total |
| --- | --- | --- | --- |
| Distinct packets | 32 | 16 | 48 |
| Attempted calls | 96 | 48 | 144 |
| Automated model assertions passed | 75/96 | 47/48 | 122/144 |
| Software-derived recommendation matched expectation | 81/96 | 47/48 | 128/144 |
| Cases passing model assertions in every repeat | 25/32 | 15/16 | 40/48 |
| Complete validated responses | 96/96 | 47/48 | 143/144 |

There were zero HTTP/provider failures. One response failed the complete-assessment contract. It remains in the denominator and was not retried.

Across 447 required candidate assessments, the continuity confusion table is:

| Expected continuity | Actual same | Actual separate | Actual unknown | Invalid or missing |
| --- | --- | --- | --- | --- |
| Same | 90 | 0 | 9 | 0 |
| Separate | 0 | 246 | 57 | 0 |
| Unknown | 3 | 0 | 40 | 2 |

The invalid response counts as two invalid assessments because the whole two-candidate output was rejected. Its raw response contains one candidate; no partially validated result was accepted.

Three of 93 predicted-same assessments were unsupported against the provisional gold labels. All three were repeats of U04. They produced three wrong match recommendations among 84 match recommendations. No actual memberships were written.

There were 66 unnecessary unknown assessments among 402 answerable candidate assessments. Fifty-seven came from the nineteen distractors in P03 across three repeats. These are correlated errors from one scenario, not evidence of 57 independent real-world failures.

### Failure cases

| Case | Failed repeats | Observed behavior | Interpretation |
| --- | --- | --- | --- |
| S03 | 3/3 | Same lamp, described as still dark, but unknown observation time leads to unknown continuity | Intended unknown-time regression fails. Independently review whether the wording establishes occurrence continuity strongly enough. |
| T02 | 3/3 | A later usable south entrance with north unobserved becomes unknown continuity and chronology conflict | Partial improvement is confused with conflict and loses the supported match. |
| T04 | 3/3 | Same occurrence and supported scope expansion, but chronology consistent instead of change | Taxonomy mismatch; matching recommendation is correct. Review the boundary between consistent and change before treating this as a substantive reasoning failure. |
| D03 | 3/3 | Same-time disagreement on the south entrance becomes unknown continuity | Correctly sees conflict but fails the intended same-occurrence interpretation. |
| D04 | 3/3 | Earlier blockage and later removal stay the same occurrence, but chronology consistent instead of change | Correct identity and recommendation; another chronology-label question. |
| U04 | 3/3 | Repeated darkness after provisional resolution becomes the same occurrence despite unknown repair history | Unsupported certainty about continuity. This fails the safety boundary. |
| P03 | 3/3 | Correct bridge candidate ranked first and assessed same/change; all nineteen explicitly unrelated distractors assessed unknown | The reasons describe unrelated equipment, yet the assessments retain it as plausible. Software consequently returns uncertainty. |
| A02-remove-identity | 1/3 | Only one of two required candidate assessments returned, with provider finish reason stop | Production validator rejects it. The other two repeats pass automated assertions. |

All remaining forty cases passed every automated assertion in all three repeats. This includes controlled paraphrases, candidate-order and ID changes, category and distance changes, source duplication, instruction injection, and the appropriate candidate in input position twenty. These are narrowly scoped development observations, not general robustness claims.

T04 and D04 account for six assessment-assertion failures with correct recommendations. They remain failures in the original score. No labels were changed after looking at answers, and no adjusted success rate is substituted for the frozen score.

## Grounding review finds issues beyond the automated score

Agent inspection covered every failed case and selected passing target reasons. It was not an exhaustive independent review of every citation and reason. Attempt-level human review remains pending.

Some automated passes contain unsupported time wording:

- A04 trial 1 calls the observations the same location and time, although the candidate observation is 10:00 and the incoming observation is 12:00.
- A02-remove-identity trials 2 and 3 appropriately abstain, but say same coordinates and time. Coordinates match; observation times are 10:00 and 11:00.
- P01-remove-identity trial 3 appropriately abstains but also says same district and time. Observation times are 10:00 and 10:30.

The intended decisions can be right while the reasons overstate their evidence. Valid IDs and automated case success do not resolve these issues.

Forty-one validated assessment reasons reached the 320-character limit. Several inspected examples end mid-sentence or mid-word. This is an inspectability concern even though the JSON validates. The count is a length check, not a claim that all forty-one reasons are incomplete. No prompt or output-limit change was made during this evaluation.

## Operational observations

Calls were sequential using Node 22.19.0, temperature 0, thinking disabled, an 8,192-token output allowance, and the production 25-second matching timeout. There were no automatic retries.

Observed complete-call wall times, including response capture and validation, were:

| Measurement | Result |
| --- | --- |
| Sample count | 144 attempted calls |
| Minimum | 649 ms |
| Median | 1,012 ms |
| p95, nearest rank | 3,511 ms |
| Maximum | 4,735 ms |
| Calls exceeding 25 seconds | 0/144 |
| Largest serialized matching input | 57,331 UTF-8 bytes, P03 |
| Provider-reported prompt tokens | 296,280 |
| Provider-reported completion tokens | 39,611 |
| Total reported tokens | 335,891 |

The input size is the serialized user evidence packet, excluding the system prompt and response schema. The largest packet is within the configured 65,536-byte limit. Timing includes a remote service and this runner's capture overhead; there is no performance comparison or hosted-latency guarantee. No monetary price is inferred from token usage.

The first runner summary counted usage only for responses accepted by the production validator. Post-processing recovered the rejected response's 1,327 prompt and 115 completion tokens from the preserved raw response. The archived summary includes all 144 provider usage records and records this correction. Scores, labels and timings were not changed. The runner now preserves and totals that usage on validation failures, with a local regression check. No extra inference was needed.

## Reproduce and verify the tooling

Use Node 22.19.0 and configured `NEBIUS_API_KEY` and exact `NEBIUS_MODEL`. The live command sends synthetic evidence to Nebius and incurs provider usage.

```sh
npm run test:matching
npm run matching:live -- --dry-run --output .local/matching-evals/new-preflight
npm run matching:live -- --output .local/matching-evals/new-live-run
```

The default live run executes all 48 development packets three times. Use a new output directory; the manifest uses exclusive creation to prevent accidental mixing with an earlier run. The fixed manifest in this record is the source for reproducing these exact inputs if the fixture builder changes later.

Verification completed:

- TypeScript check passes.
- Seven matching scorer, fixture and runner checks pass, including a 48-request local HTTP stub run.
- Three existing model-checker tests pass. Combined final focused run: 10/10.
- The stub confirms one matching request per attempt, no extraction request, no leaked expected labels, exact large-packet limits, preserved rejected outputs, and usage accounting on validation rejection. These are software checks, not live quality results.
- A localhost stub initially hit sandbox `EPERM`. The default Node 26 runtime also aborted in its native callback handling. The focused tests then passed under Node 22.19.0 with localhost access. Live inference also used Node 22.19.0.

The live command exits 1 because evaluation cases failed. That exit is the expected evaluation verdict, not an unrecorded runner crash. No browser suite was required for these script-only additions; this record makes no new application-verification claim.

## Limitations and next decisions

The labels and extraction remain agent-authored development material. The suite uses many explicit same/unrelated cues and is not sampled from natural Report traffic. Repeats and transformed cases are correlated. Some unscored chronology and scope fields vary between repeats even when required continuity remains stable.

The two remove-identity variants reconstruct ambiguous entrance packets, including candidate evidence, rather than performing a pure single-passage ablation. Their results establish behavior on those packets, not a causal effect of removing one passage. N02-title changes the title to a description consistent with its original closure evidence, so it provides weaker misleading-title coverage than intended. The A01 title variant does exercise a misleading supported-candidate title. Strengthen these cases deliberately in a subsequent dataset revision.

Before a qualification run, obtain independent review of all expectations and extractions, particularly S03 and the chronology taxonomy for T04 and D04. Address the unsupported continuity in U04, unnecessary uncertainty in T02/D03/P03, output completeness, and evidence-grounded reasons. Evaluate any change against the preserved cases, then use newly authored held-out scenarios. Do not tune against these results and continue calling the same cases held out.

No product behavior, release gate, or ticket status changed as a result of this run.
