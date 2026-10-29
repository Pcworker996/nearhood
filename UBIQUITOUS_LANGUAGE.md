# Ubiquitous Language

This is a terminology reference extracted from the conversation and the existing domain documents; [CONTEXT.md](CONTEXT.md) remains the canonical domain glossary in this repository's single-context layout. Definitions below reflect documented agreements, not a claim that every behavior is implemented. “Aliases to avoid” are editorial recommendations, including explicitly excluded terms from the canonical glossary.

Sources: [product guardrails](docs/product-guardrails.md), [evidence preservation decision](docs/adr/0001-preserve-evidence-separately.md), and [revised matching decision](docs/adr/0005-separate-extraction-from-matching.md). This document proposes no new product behavior.

## Evidence and interpretation

| Term                    | Definition                                                                                                                                     | Aliases to avoid                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Report**              | A contributor's original submitted account, preserving their words, provenance, location, submission time, and reported observation time.      | Post; Observation when referring to submitted words           |
| **Observation**         | A structured interpretation of a claim in a Report, including its subject, state, observation time, and spatial scope.                         | Original account; verified fact                               |
| **Firsthand report**    | A Report identified by its contributor as based on their own observation, without an assurance of accuracy.                                    | Verified report; eyewitness proof                             |
| **Source-based report** | A Report identified by its contributor as information from another source.                                                                     | Independent corroboration merely because it is another Report |
| **Supporting evidence** | Material submitted to support a Report or Report update, with relevance and limitations that affect its evidential support.                    | Proof; verification                                           |
| **Report stack**        | The inspectable collection of attributed Reports associated with a Happening, including conflicting accounts.                                  | Comment thread; consensus                                     |
| **Shared account**      | The provisional current interpretation of a Happening's evidence, including chronology, spatial scope, changes, disagreement, and uncertainty. | Truth; authoritative finding; Shared summary                  |
| **Shared summary**      | A concise readable presentation of a Shared account whose key statements reference supporting Observations and original Reports.               | Shared account when referring to the entire interpretation    |

## Happenings, identity, and scope

| Term                    | Definition                                                                                                                  | Aliases to avoid                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Happening**           | An evolving real-world occurrence of an activity or condition to which Observations refer.                                  | Label; Report; map pin as the domain identity |
| **Category**            | A broad kind of Happening, such as an activity, disruption, or safety concern.                                              | Label; Happening identity                     |
| **Spatial scope**       | The part of a place or situation described by an Observation, such as one lane or entrance.                                 | Whole location when only part was observed    |
| **Matching**            | The determination of whether a Report refers to an existing Happening or a separate occurrence.                             | Categorization; proximity check               |
| **Candidate Happening** | An existing Happening retrieved for consideration during Matching, without established membership for the submitted Report. | Confirmed match                               |

“Candidate Happening” is a recommended explicit name for the candidates described in [ADR 0004](docs/adr/0004-confirm-matches-before-membership.md); it does not add a new kind of Happening.

## Chronology and report history

| Term                 | Definition                                                                                                                         | Aliases to avoid                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Observation time** | The time the reported situation was observed, which may be unknown and may differ from Submission time.                            | Report time; creation time                       |
| **Submission time**  | The time a contributor submits a Report or Report update.                                                                          | Observation time; occurrence time                |
| **Report update**    | A contributor's later observation or correction attached to their earlier Report while retaining the earlier account and its time. | Replacement Report; silent edit                  |
| **New observation**  | A Report update describing what the contributor observed at a later time.                                                          | Correction merely because conditions changed     |
| **Correction**       | A Report update identifying an inaccuracy in the contributor's earlier account.                                                    | New observation when correcting an earlier error |

## Provisional condition and freshness

| Term                      | Definition                                                                                                                                                      | Aliases to avoid                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Reports received**      | A provisional status acknowledging available Reports without establishing resolution or agreement.                                                              | Confirmed active; verified condition              |
| **Resolution report**     | A Report claiming that a previously reported disruption or safety concern may have ended.                                                                       | Confirmed resolution                              |
| **Resolution assessment** | An assessment of whether Reports support the end of the original condition across its full extent, considering timing, source support, and remaining conflicts. | Vote; truth score                                 |
| **Reported resolved**     | A provisional status indicating sufficient evidence supports the end of the original disruption or safety concern across its full reported extent.              | Resolved as a definitive finding; guaranteed safe |
| **Partial improvement**   | A reduction in the extent or impact of a disruption or safety concern without established full resolution.                                                      | Reported resolved                                 |
| **No recent updates**     | A freshness indicator that available Reports are too old to establish current conditions.                                                                       | Still active; Reported resolved                   |

## Activities and private updates

| Term                   | Definition                                                                                                                            | Aliases to avoid                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Activity organizer** | The designated contributor who explicitly assumes responsibility for an activity's schedule and cancellation status when creating it. | First reporter; sharer            |
| **Past activity**      | A scheduled activity whose scheduled end time has passed, without establishing that it occurred.                                      | Completed activity                |
| **Interested**         | A person's private choice to receive activity updates without committing to attend.                                                   | RSVP; public follower             |
| **Follow updates**     | A person's private choice to receive in-app updates about provisional status changes to a disruption or safety concern.               | Public follow; popularity measure |
| **RSVP**               | A person's response indicating whether they intend to attend an activity.                                                             | Interested                        |

## Finding information

| Term             | Definition                                                                                                                 | Aliases to avoid                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Discovery**    | Finding relevant Happenings already stored in the app in response to a reader's request.                                   | Source check; external research        |
| **Source check** | An assessment of relevant information outside the app with dated, linked findings about agreement, conflict, and unknowns. | Discovery; verification as a guarantee |

These terms describe the documented domain; their presence does not authorize deferred features such as external source research or RSVP implementation.

## Relationships

- A **Report** can contain multiple **Observations**; each **Observation** traces back to its original **Report**.
- A **Happening** can be described by multiple **Reports** and their **Observations**; shared category or proximity alone does not establish that they describe the same occurrence.
- A **Report stack** collects the attributed **Reports** associated with one **Happening**.
- A **Shared account** interprets a **Happening**'s available evidence; its **Shared summary** presents that interpretation concisely, with key claims linked through **Observations** to original **Reports**.
- A **Report update** attaches to an earlier **Report** and may be a **New observation** or a **Correction**; earlier evidence remains inspectable.
- An **Observation** has an **Observation time**, possibly unknown, and relevant **Spatial scope**; **Submission time** does not substitute for either.
- Under the agreed initial Report and Add an update flows, a recommended **Candidate Happening** requires contributor confirmation before the Report's Observations are added to it; a search or processing failure leaves the saved Report retryable rather than establishing no match.
- A **Resolution report** contributes to a **Resolution assessment**; neither a single reopening observation nor **Partial improvement** alone establishes **Reported resolved**.
- Activities are **Happenings**; **Activity organizer** authority over schedule and cancellation remains distinct from participant **Observations**.

## Example dialogue

> **Dev:** “A contributor submits ‘the north entrance reopened.’ Is that the new **Shared account**?”
>
> **Domain expert:** “Those words are a **Report**. The derived **Observation** describes the north entrance at its **Observation time**; the **Shared account** must still consider the other evidence.”
>
> **Dev:** “A nearby **Happening** describes the same building. Can we attach the Report immediately?”
>
> **Domain expert:** “It is a **Candidate Happening**. Compare its evidence and ask the contributor to confirm the match before adding the Report's Observations.”
>
> **Dev:** “After confirmation, can the **Shared summary** say **Reported resolved**?”
>
> **Domain expert:** “Only if the evidence supports the end of the original condition across its full **Spatial scope**. One reopened entrance may establish **Partial improvement**, while another entrance remains blocked or unknown.”
>
> **Dev:** “The reopening was submitted today but observed yesterday. Does it supersede a blockage observed this morning?”
>
> **Domain expert:** “No. Use **Observation time** for the chronology, preserve both Reports in the **Report stack**, and explain what the evidence currently supports.”

## Flagged ambiguities

- **“Account”** can suggest a login identity or a contributor's narrative; use **Shared account** for the provisional evidence interpretation and **Report** for the original submitted narrative.
- **“Observation”** can mean the human act of seeing something or the system's derived representation; use **Report** for submitted words and **Observation** for the structured claim, preserving its source link and uncertainty.
- **“Summary”** can obscure evidence and interpretation boundaries; use **Shared summary** for the concise presentation and **Shared account** for the broader provisional interpretation.
- **“Label”** is explicitly excluded for both **Happening** and **Category** in CONTEXT.md; use **Happening** for occurrence identity and **Category** for its broad kind.
- **“Latest”** is incomplete without a clock; say latest by **Observation time** or by **Submission time**, and retain unknown observation times as unknown.
- **“Resolved,” “active,” and “stale”** can imply unsupported real-world certainty; preserve **Reported resolved**, **Reports received**, **Partial improvement**, and **No recent updates** as distinct concepts rather than a binary condition.
- **“New”** can mean newly submitted, newly observed, or a separate real-world occurrence; specify which meaning applies, and do not ask contributors to decide whether a situation is “new” as a substitute for Matching.
- **One Report describing separate occurrences:** the October 21 decision in [ADR 0005](docs/adr/0005-separate-extraction-from-matching.md) accepts saving it unassigned with an explanation for the hackathon; guided follow-up is deferred, and no general one-to-many membership rule or automatic distribution is implied.
- **Repeated Reports are not automatically independent support:** several **Source-based reports** may repeat one underlying source; neither Report count nor firsthand provenance alone establishes accuracy.
- **Activity updates are not organizer decisions:** participant **Observations** about an activity do not themselves change its organizer-controlled schedule or cancellation status.
- **Glossary presence is not implementation status:** terms such as **Source check** and **RSVP** describe domain boundaries without establishing that those features exist or belong in V1.
