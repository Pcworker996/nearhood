# Report matching strategy

**Status: accepted direction, October 21, 2026; staged foundation implemented locally October 22, with live/hosted acceptance outstanding.** The product owner approved this revision after reviewing the original proposal. Requirements live in [spec #1](https://github.com/Pcworker996/nebius-hack/issues/1), [plan #2](https://github.com/Pcworker996/nebius-hack/issues/2), and tickets [#4](https://github.com/Pcworker996/nebius-hack/issues/4), [#5](https://github.com/Pcworker996/nebius-hack/issues/5), and [#6](https://github.com/Pcworker996/nebius-hack/issues/6). [ADR 0005](../adr/0005-separate-extraction-from-matching.md) revises the architecture in ADR 0004 while retaining contributor confirmation. This document specifies the full target behavior; [the #4 processing contract](../implementation/report-processing-stages.md) and [verification record](../reviews/2026-10-22-issue-4-stages.md) identify what currently exists and what remains open.

## Hackathon outcome

Two different contributors describe one evolving bridge Happening through live sign-in, persistent storage and runtime NVIDIA Nemotron calls on Nebius Token Factory. A later Report describes one entrance reopening while the other remains blocked or unknown. After the contributor confirms the match, the Shared account explains partial improvement, links important claims to original evidence, preserves the earlier account, and leaves unsupported full resolution unknown.

This is the hackathon delivery milestone, not completion of the broader V1. Existing browsing work is retained. Interactive handling of multiple separate occurrences, own-report rematching, embeddings, a physical-object registry, automatic merging, and automatic multi-Happening distribution are outside this milestone. Later V1 workflows remain tracked in #6–#16; they are not marked complete or deleted. Submission preparation follows the hosted core milestone rather than waiting for the full-V1 #16 dependency chain.

The official [event page](https://nebiusglobalaihackathon.devpost.com/) identifies technical implementation, coherent design, impact and originality as judging criteria. The recommendation is to demonstrate the complete evidence-change journey first. Two calls are an architectural choice, not an official judging requirement or a claim of better accuracy.

## Agreed matching rules

- Initial Reports and “Add an update” use the same confirmation boundary. A selected detail or pin is context; neither a model recommendation nor selecting a detail commits membership.
- Occurrence identity differs from agreement: conflicting accounts of the same situation can join one Happening after confirmation. Different times or spatial scopes can also explain different states.
- A shared physical object, category, similar words, or proximity alone does not establish one occurrence. A closure and an unrelated pothole on the same bridge may be separate Happenings.
- Recurrence requires evidence of a separate occurrence. Elapsed time and the provisional Reported resolved status alone cannot establish a new blockage; unclear continuity stays unassigned and needs a focused question.
- Create a Happening only after successful extraction and search support one coherent occurrence with no plausible existing match, including a successful empty search within the documented scope. Ambiguity, inadequate evidence coverage and provider/search failure are not no-match results.
- A Report describing separate situations is saved unassigned with an explanation, for example: “Your report describes separate situations. We’ve saved it, but haven’t added it to a Happening.” Guided follow-up for that case is deferred; do not duplicate, partially attach, or automatically distribute its Observations.
- Contributor confirmations are attributed decisions, not ground-truth labels. Neither confirmation rate nor Report count proves matching correctness or independent corroboration.

## Fixed workflow and ownership

1. **Save:** software saves the immutable Report before any provider call, retaining words, contributor, location, provenance, separate observation/submission times and the idempotency key.
2. **Extract:** dedicated LLM call 1 interprets that Report into JSON without candidate Happenings. It answers what is claimed, not which Happening owns the claim.
3. **Validate and checkpoint:** software validates structure and source references, then saves the extraction separately from the Report. Unknowns and qualifications survive. A malformed result cannot advance to matching.
4. **Retrieve:** deterministic server code retrieves a larger bounded nearby pool. Start by evaluating a cap of 20 evidence-bearing Happenings, using the existing 1,500 m / symmetric 30-day defaults as reviewable starting values. Unknown observation times remain unknown; do not use Submission time as their replacement. Category and extracted target descriptions are not hard identity filters.
5. **Compare:** dedicated LLM call 2 receives the validated extraction, original Report and actual candidate Report/Observation evidence. It assesses occurrence continuity, chronology, spatial scope, disagreement and uncertainty before ranking review candidates.
6. **Review:** software validates supplied candidate/evidence IDs and presents the best suggestion with evidence and up to four alternatives. The contributor confirms an existing match, rejects the shown candidates, or leaves it unassigned.
7. **Publish:** software checks authorization and freshness, then commits membership and the applicable account changes once in a short transaction. No model chooses tools, changes membership, or performs an open-ended search loop.

These are two model stages for extraction and matching. Account reconciliation/synthesis in #5 remains a separately validated responsibility; it must not be smuggled into extraction or treated as evidence. Its provider work, if needed, gets its own execution budget. The design does not impose two calls as a limit on every later V1 workflow.

## Extraction contract

The following information is required; exact JSON field names and bounded sizes must be frozen with the versioned schema in #4 before coding the provider adapter:

| Information                         | Meaning and validation                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Report reference and schema version | Software-owned references to the saved input; the model cannot invent persisted IDs.                                                                               |
| Occurrence assessment               | One coherent occurrence, multiple separate occurrences, or unclear; not a verdict about whether a candidate matches.                                               |
| Observations                        | Separate claims with local keys, subject/target description, reported condition, relevant spatial scope, time wording and uncertainty.                             |
| Source support                      | Exact passages or validated source offsets connecting each interpretation to the original Report, preserving surrounding negation, qualifications and attribution. |
| Category proposal                   | A derived activity/disruption/safety classification; not occurrence identity or a mandatory contributor input.                                                     |

A target description is text about what was observed, not a stable physical-object identifier. A named bridge, a bridge kind and a Happening are distinct. Do not require a registry or normalized condition taxonomy for this milestone.

Explicit form times and coordinates remain deterministic inputs. Time/location phrases extracted from prose are interpretations; do not invent a date, timezone or coordinates, or silently replace conflicting explicit inputs. Missing or conflicting details remain explicit uncertainty. Valid JSON and real citations alone do not prove semantic accuracy.

Persist valid extraction even when it identifies separate occurrences; it remains private and unassigned. An unclear occurrence assessment also cannot force a single Happening. The original words remain owner-inspectable after validation/provider failure; unsupported output cannot become published Observations or claims.

## Candidate evidence and matching contract

Compare the larger retrieved pool before selecting the review set; do not apply the old time/distance top-five cutoff first. Start with the same qualified Nemotron model for both calls; a faster extraction model is a later measured optimization. The cap of 20 is an initial evaluation limit, not a verified quality, cost or latency guarantee.

Supply source-linked evidence of the original condition and relevant later changes, with times, scope, provenance and coordinates. Repeating one Report for several Observations must not duplicate its full text in the packet. Bound total input size as well as candidate and evidence counts. Do not silently truncate away qualifications or drop a candidate's identity evidence. Persist inclusion/omission and truncation information with the snapshot; insufficient coverage yields uncertainty, not permission to create a duplicate.

Matching must return assessments for supplied candidates with evidence references and a short supported explanation. The versioned schema must distinguish supported continuity, supported separate occurrence and unknown continuity, alongside chronology/scope and disagreement. It must not treat “conflict” as a prohibition on membership or treat every unknown attribute as proof of no match. Return a supplied recommendation, a supported no-match outcome, or uncertainty; multiple plausible candidates require contributor review rather than automatic attachment.

The private record retains the full assessed pool, review ordering, evidence snapshot, model/prompt/schema versions, recommendation, matching outcome and actor/time. Record candidates actually shown separately from all retrieved candidates. Rejecting five displayed candidates does not reject unshown plausible candidates. The server must preserve that remaining uncertainty rather than create a Happening on that basis. Refresh stale candidate evidence before accepting a changed or obsolete decision.

## Durable stages, API and UI

Retain `POST /api/reports` for immutable saving, owner-only `GET /api/reports/:id` for recovery, `POST /api/reports/:id/process` for advancing processing, and `POST /api/reports/:id/match` for an attributed decision. Target contracts extend the current APIs; they are not implemented by this document.

Use separate resumable extraction and matching stages. A processing request claims one stage, makes at most one provider call, validates and saves its result, then returns. The client advances the next stage through another authorized POST; GET remains read-only. Persist stage, attempt token, lease, extraction checkpoint, pending reason and versions privately with Report processing. Exact schema changes belong to #4; do not rewrite earlier migrations or backfill by calling a live provider automatically.

| Outcome                                          | Durable behavior                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Saved, no extraction                             | Next processing request runs extraction.                                                                                       |
| Valid single-occurrence extraction               | Checkpoint survives reload; next request retrieves current candidates and runs matching.                                       |
| Separate occurrences or unclear occurrence scope | Unassigned, with an ordinary-language reason; no invented membership/account. Separate-occurrence guided answers are deferred. |
| Match recommendation                             | Persist review; wait for contributor confirmation.                                                                             |
| Candidate/continuity uncertainty                 | Unassigned, show a focused question and available evidence-backed choices; richer clarification and repair belong to #6.       |
| Supported no match after successful search       | Create the first Happening/account once for the coherent occurrence.                                                           |
| Provider, search, validation or database failure | Preserve the Report and the last committed valid checkpoint; expose pending/retry for the failed stage.                        |
| Published                                        | Replay of the same operation returns the published result without duplication.                                                 |

Reuse extraction only for the same immutable Report and input/schema/prompt version. Matching retry retains that valid checkpoint but refreshes candidate evidence. Obsolete attempts cannot save stage results or publish an account. Future Report revisions invalidate dependent work under the later correction ticket; they do not mutate the original submission here.

The current implementation permits a 35-second provider call in a 60-second route/lease. Two sequential worst-case calls do not fit. Separate requests avoid adding both provider timeouts into that route; #4 must still verify each stage's provider, database and response budget with margin inside the actual hosting deadline and lease. Use one stage lease/attempt at a time, compare-and-set checkpoint writes, and short publication transactions with no provider call while holding database locks. Host limits and numerical budgets require measurement before release.

Owner-only recovery exposes a comprehensible phase/reason and permitted next action; it must not expose auth data, other contributors' private submissions or raw processing diagnostics. The public account still provides claim-level original evidence. A pending Report does not imply its evidence has been incorporated. Explain “saved,” “finding a match,” “please confirm,” “unassigned,” and “retry” in ordinary language; implementation details need not appear in the contribution form.

## Delivery and acceptance

1. **#4 — extraction and matching:** freeze versioned contracts and evidence budgets; add separate resumable stages; evaluate the larger candidate pool; preserve confirmation, idempotency, authorization and safe failure behavior; verify live Google, Nebius, hosted migrations and the deployment's database target.
2. **#5 — evidence-change milestone:** use the same confirmed-match policy for later Reports; reconcile scope, chronology and disagreement before publishing grounded account changes; demonstrate the hosted two-contributor bridge journey with originals and earlier/current account inspection.
3. **#6 and later — broader V1:** richer clarification and own-report membership repair remain later work. The multi-occurrence guided-answer flow requires a later design; this milestone accepts saving it unassigned with an explanation. Do not reinstate automatic attachment or abstract “this is new” choices.

Acceptance must include paraphrases, partial reopening, same-time/same-scope disagreement within one occurrence, separate problems on one bridge, recurrence with and without continuity evidence, unknown times, an appropriate candidate outside the old top five, multiple separate occurrences, prompt injection inside evidence, long Reports, invalid IDs/support, source dependence, unshown plausible candidates, and inadequate/truncated evidence. Confirm no membership changes before confirmation and no creation on ambiguous/failed processing.

At the browser/API/database boundary, verify reload between stages, extraction reuse after matching failure, fresh candidate evidence on retry, expired leases, concurrent processing/confirmation, stale completion, cross-owner writes, and no duplicate Report/Happening/account publication. Retain existing evidence-scope and original-word regressions. No new tests are implemented by this plan.

Compare the current combined-call baseline with the two-stage workflow on the same reviewed development and held-out scenarios. Keep scenario variants together when splitting. Report candidate recall, wrong merges, missed matches, unnecessary uncertainty, separate-occurrence handling, scope/qualification preservation, stage failures, end-to-end latency and token usage. Use repeated live trials where variability matters; controlled fixtures establish application behavior, not live semantic quality. Human-review the important judgments. Do not treat confirmations as ground truth or claim improvement without measured results. Reviewed release thresholds and final caps/time budgets are implementation preflight outputs, not settled numerical guarantees.

## Current implementation and evidence

The current code still retrieves five candidates and combines extraction with matching in one call. It does not yet implement this architecture. October 19's recorded 40/40 controlled-service result applies to that earlier revision. On October 21, typecheck/build passed; the checker tests passed 3/3 under Node 22; the browser suite passed 38/40 with the test origin explicitly configured. Two map-marker tests failed because overlapping Report markers intercepted clicks. These failures need resolution or a fresh isolated-database reproduction before claiming a green suite.

The saved October 20 provider check passed three examples and failed separate-occurrence extraction with `Unsupported Observation passage`; `selected` was null. Its roughly 4.5–5.8 second combined-call timings do not predict two-stage latency. Requalify the actual implemented schemas and model before claiming live readiness. This documentation revision changes no code, data, deployment or issue completion status.
