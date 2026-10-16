# Nearhood Product Differentiation Guardrails

Provided by the product owner on October 7, 2026. Apply these standing guardrails when choosing designs, planning implementation, writing code, and reviewing changes. They refine the information model; illustrative states and examples do not automatically add features to the agreed V1 scope.

## Product definition

**Nearhood turns fragmented local observations into evolving, evidence-linked happenings so people can understand what is currently known, what changed, and what remains uncertain.**

The central question is: **What does the available evidence currently support about a real-world local happening?**

Nearhood is organized around evolving real-world happenings reconstructed from inspectable observations. Avoid drifting into a generic neighborhood social network, incident map, 311 issue tracker, Citizen clone, crowdsourced alert app, local-events app, or AI summarization app.

## Information model

Human → Report → Observation → Happening → Shared Account.

- **Report:** what a contributor submitted. Preserve original text, author, submission time, reported observation time, location, source/media information when supported, and provenance. Keep original reports inspectable after the shared account changes.
- **Observation:** a structured interpretation of a claim in a report, including relevant subject, state, time, and spatial scope. A report can contain multiple observations. Extracted observations must trace back to their report; an AI interpretation must never silently replace the source.
- **Happening:** the evolving real-world situation to which observations may refer. Multiple reports about the same situation should not create independent pins merely because their wording differs.
- **Shared Account:** the provisional current interpretation of the happening's evidence, including what is supported, what changed, and uncertainty. The Shared summary is its concise readable presentation, not the entirety of the account.
- Activities, disruptions, and safety concerns use the same Happening model. An activity can receive observations about attendance, a changed location, or wrapping up; it is not an unrelated events subsystem. Preserve the agreed distinction between participant observations and organizer-controlled schedule changes.

## Evidence and chronology

- Popularity is not evidence strength. Repetition of one underlying source does not create independent corroboration. Consider independence, provenance, recency, temporal/spatial relevance, corroboration, contradiction, and duplication, while making limitations explicit.
- Do not display fake numerical precision or unsupported truth scores. Prefer inspectable descriptions such as recent observations, shared sources, older conflicting accounts, and unobserved parts of the situation. Do not claim independence unless supported.
- Observation time and submission time remain separate throughout storage, reasoning, ordering, and presentation. A newly submitted older observation does not become the latest real-world state.
- Disagreement is data. Distinguish temporal change, different spatial scope, and genuine unresolved disagreement. An earlier blockage and later reopening may be a transition; a blocked north entrance and open south entrance may describe different scopes.
- Preserve unknown times, causes, extent, and conditions as unknown. Do not fill gaps with plausible details.
- Support partial state: one lane open, another blocked, sidewalk unknown. Avoid a binary active/resolved model that loses scope or remaining uncertainty. Preserve the agreed provisional Reported resolved terminology and freshness behavior; examples such as Emerging or Likely Resolved are not a mandate to add new V1 status labels.

## Inspectable, provisional accounts

- Important claims should link to supporting observations and then original reports with contributor, time, location, and provenance. Generic citations at the bottom of a paragraph are insufficient when readers cannot tell which evidence supports a particular claim.
- The current account changes with evidence. Present it as current understanding or provisional state, not permanent truth. Preserve original evidence, relationships, and previous states where appropriate.
- AI outputs are derived representations, not authoritative evidence. Models reason over evidence; models do not become the evidence. Preserve reports, timestamps, locations, source relationships, evidence links, happening membership, and relevant history independently of model-generated synthesis.
- Make uncertainty visible, including unknown, conflicting, stale, and partially improved conditions. Fluent prose is not grounds for certainty.

## Contribution and processing

- Humans report what they observe; the system organizes observations into happenings. Start with what was seen, when, and where. Do not require contributors to understand the ontology or manually categorize before submitting.
- Use system-assisted extraction, candidate retrieval, and matching. Keep the agreed targeted clarification for ambiguous matches or scope; phrase it in ordinary descriptions rather than making contributors learn internal terminology.
- Conceptual pipeline: Report → Observation extraction → Candidate retrieval → Happening matching → Evidence reconciliation → Temporal reasoning → State assessment → Grounded synthesis → Updated Happening.
- These are responsibilities, not a requirement for seven model calls or separate matching, temporal, evidence, and summary agents. Add independent agents only if independent behavior provides a demonstrated benefit.
- Use deterministic software for timestamps, explicit time inputs, coordinates, distance, IDs, persistence, authentication, evidence links, versions, and spatial filtering. Use models for semantic extraction, ambiguous matching, interpreting state changes versus contradictions, and grounded synthesis.
- Evidence relationships, spatial scope, chronology, and state assessment must inform synthesis. Do not reduce the architecture to reports sent to an LLM that returns truth.

## Feature and positioning discipline

- Evaluate every feature against: **Does this help the user understand what the available evidence currently supports about what is happening nearby?**
- Prioritize evidence timelines, current accounts, observation chronology, uncertainty, claim-level evidence links, provisional resolution, private updates, location-aware contribution, and happening matching.
- Strongly reconsider generic comments, likes/reactions, follower counts, engagement ranking, unrelated chatbots, broad recommendation engines, gamification, generic news feeds, and reputation scores without a clear need.
- Optimize useful local understanding and real-world action rather than social popularity. Do not position the product as Citizen + AI, Nextdoor + map, SeeClickFix + events, or another feature combination.
- Differentiate by the information architecture: evolving real-world happenings reconstructed from inspectable observations. AI supports this model; using AI is not itself the differentiation.

## V1 demonstration priority

Protect the central workflow before broadening features:

1. A reader sees a Happening on the map and opens its current account, evidence, timeline, and uncertainty.
2. Another contributor submits an observation describing partial improvement.
3. The system matches the same Happening and recognizes the change's time and scope.
4. The account updates without declaring unsupported full resolution.
5. Original reports remain inspectable and the reader can understand why the account changed.

The lane-reopening example illustrates this behavior; use the agreed demo scenarios without silently replacing them. Directions, activities, and private updates should support the core workflow. These guardrails do not authorize adding media uploads, statistical models, external source research, or other deferred features to V1.

## Product constitution

1. Reports are preserved as evidence.
2. Submission time is not observation time.
3. Popularity is not truth.
4. Disagreement is preserved.
5. AI outputs are derived, not authoritative.
6. Important claims are inspectable.
7. Uncertainty remains visible.
8. Happenings represent the world; reports and their observations describe it.
9. The current account is provisional.
10. Prefer evidence quality over engagement metrics.

Before adding or changing a feature, ask whether it improves modeling and explaining an evolving real-world happening. If it merely makes Nearhood resemble a generic social, alert, events, or AI app, strongly reconsider it.
