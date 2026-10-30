# Proposal: Uncertain matches never block a Report, and possible duplicates stay visible

**Status:** Contracts agreed in discussion with Maoyuan Wang on 2026-10-29 and recorded in [ADR 0008](../adr/0008-uncertain-matches-publish-with-connections.md). Not implemented. Field names, wording and API names marked Illustrative may change without a new decision.
**Author / date:** Agent draft for Maoyuan Wang, 2026-10-29.
**Related issues:** [#4](../issues/4.md) (matching), [#6](../issues/6.md) (clarification and membership repair), [#17](../issues/17.md) (overlapping markers), [#20](../issues/20.md) (stalled Reports). Evidence: [duplicate report handling](../research/duplicate-report-handling.md), [uncertain match handling](../research/uncertain-match-handling.md), [live matching record](../reviews/2026-10-27-issue-4-live-matching.md), [case review](../reviews/2026-10-28-issue-4-matching-case-review.md). Builds on: [v6 matching revision](ticket-4-matching-v6-revision.md), [Happening identity proposal](happening-identity-recurrence.md). Affects: [ADR 0004](../adr/0004-confirm-matches-before-membership.md), [ADR 0005](../adr/0005-separate-extraction-from-matching.md).
**Decision requested:** None before implementation. Q5 is decided by slice 1's evaluation. Slice 1's contract is the [consolidated v6 contract](ticket-4-matching-v6-revision.md#consolidated-v6-contract-2026-10-29).

Labels: **Agreed** was decided in discussion. **Proposed** is a contract to accept or change. **Illustrative** can change without changing behavior. **Undecided** blocks the work that depends on it.

## Problem and evidence

**A Report the app can't place disappears.** Matching grades each nearby Happening `same`, `separate` or `unknown`. Anything not `separate` counts as plausible (`isPlausible`, `src/lib/report-model.ts:113`). Unless exactly one plausible candidate is `same`, or none is plausible, the Report goes to `clarification` (`compareReport`, `src/lib/report-model.ts:632`). It stays unpublished until its contributor answers, and #20 shows the contributor may never find it again.

**Observed example (2026-10-28).** Report `7699b58d…` ("At 11:00 I can use the south entrance of the same Alder footbridge closure. I did not check the north entrance.") was compared against all six demo Happenings. All six were graded `same` or `unknown`, including the streetlamp, picnic and garden cleanup. The bridge had four Reports, one over the per-candidate cap of three (`MATCHING_SCOPE.evidenceReportsPerCandidate`), so coverage was also incomplete and "create new" was blocked. The Report was not published.

**Three causes, from the live run and the code:**

| Cause | Evidence | Owner |
| --- | --- | --- |
| The prompt still tells the model that "disagreement or lack of proof of continuity alone calls for unknown", the wording ADR 0007 replaces. | T02 (partial reopening) and D03 return `unknown` in 3/3 runs ([live matching](../reviews/2026-10-27-issue-4-live-matching.md)). | [v6 revision](ticket-4-matching-v6-revision.md) R1 |
| Labels are chosen before reasons. | P03: 19 distractors with reasons saying "unrelated" are labelled `unknown`; 57 of 66 unnecessary `unknown` grades in the run. | v6 revision R2 |
| The decision rule treats `unknown` like `same`, and any omitted evidence as incomplete coverage. | P03 has one correct `same` and still returns `uncertain`; the example above was blocked by one omitted Report. | This proposal, P1 and P2 |

A fourth fault seen once: U04's reasons compared the candidate's own evidence and never mentioned the new Report ([uncertain match handling](../research/uncertain-match-handling.md#step-0-fix-grading)).

**Why not publish every uncertain Report as new.** An earlier draft did that. Seven single-candidate cases expected `same` came back `unknown` in the v4 run (S03, T02, D03, U01, U01-duplicate-source, U02, U03). Under that draft each would create a duplicate pin; T02 is the guardrails' central demo step. Record-linkage practice holds possible matches for review rather than publishing them as decided ([uncertain match handling](../research/uncertain-match-handling.md#record-linkage-three-way-decisions)). The v4 cases are agent-written and have been used for tuning, so these counts indicate risk; they are not held-out rates.

## Goal and scope

- **Outcome (Agreed):**
  - An uncertain match never leaves a Report unpublished with no way forward for its contributor.
  - The app asks fewer unnecessary questions.
  - When two Happenings may describe one situation, readers can see that and inspect both sets of evidence.
- **Included:** P1 to P5 below.
- **Owned elsewhere:** prompt and label changes (v6 revision R1 to R5); Happening identity (ADR 0007); server retry and abandoned Reports (#20).
- **Deferred:** automatic merging of any kind; numerical confidence; Reports describing several situations (stay unassigned, unchanged).
- **Constraints:**
  - A Report joins an existing Happening only with its contributor's confirmation (ADR 0004).
  - Do not ask the contributor whether the situation is "new"; choices are grounded in the shown situations (ADR 0004, #6).
  - No truth scores; uncertainty is visible; AI output is derived, not evidence ([guardrails](../product-guardrails.md)).

## Options and recommendation

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Keep current behavior | No new states | Reports disappear; unnecessary questions; #20 worsens |
| Publish every uncertain Report as new, flagged | Nothing waits | Splits real matches (7 single-candidate cases above), including the core demo step |
| **Recommended:** fix grading, narrow what blocks, and turn the remaining question into a non-blocking choice that can publish with recorded, displayed connections | Fewer questions; nothing is guessed; possible duplicates are visible and repairable | New connection records and display; revises ADR 0004 (uncertain Reports can publish) and ADR 0005 (left-out evidence), see ADR 0008 |

## Concrete behavior

### P1. Decision rules (Agreed 2026-10-29)

| Model result | Current | Agreed |
| --- | --- | --- |
| Exactly one `same`; others `separate` or `unknown` | `uncertain` if any `unknown` exists | **Suggest the `same` candidate** for confirmation; show the `unknown` ones as alternatives |
| Two or more `same` | Ask | Ask; after publication, automatic statements connect the Happenings involved (P3) |
| No `same`, at least one `unknown` | Ask; publication blocked | Ask with the D1 choices; publication never blocked by the question |
| All `separate`, or no candidates | Publish new | Unchanged |
| Several situations in one Report | Unassigned | Unchanged |

**Effective grade (Agreed 2026-10-29).** Software maps each assessment to one effective grade before applying the table: `continuity` `same` → `same`; `unknown` → `unknown`; `separate` with `chronology: conflict` → `unknown` (the labels contradict each other); any other `separate` → `separate`. A **possible match** is a candidate whose effective grade is `same` or `unknown`. This replaces `isPlausible` (`src/lib/report-model.ts:113`).

**Two or more `same` (Agreed 2026-10-29).** Besides the statements connecting the Report's Happening with each candidate, every pair of candidates graded `same` gets an automatic statement (P3 rule 2), because one Report fitting both is evidence they may duplicate each other.

**Version (Proposed).** The rule change bumps `MATCHING_VERSION`, so stored reviews made under the old rule ask for a refresh before a decision, as for any matching revision.

### P2. Left-out evidence is disclosed, not blocking (Agreed 2026-10-29; requires ADR 0005 revision)

Matching sees at most `evidenceReportsPerCandidate` (3) Reports per Happening and `maxCandidates` (20) Happenings. Today any omission blocks "create new". Agreed:
- **Reports left out of a Happening never block.** For that Happening, the matching question and any automatic statement say it was checked on partial evidence (`coverage.omittedEvidence`, already stored).
- **More than 20 nearby Happenings** (`coverage.poolTruncated`): the ungraded Happenings could match, so the Report is never published automatically as new, even if every graded candidate is `separate`. The contributor gets the D1 question with "Some nearby Happenings could not be checked" (wording Illustrative), answer 2 refused and answer 3 available. If no candidate is a possible match, answer 3 publishes with no statements.
- Everything else follows P1.

ADR 0005 states "a truncated pool … is not evidence of no match". The pool rule above keeps that; the per-Happening rule replaces the current "any omission blocks".

### D1. The non-blocking question (Agreed 2026-10-29; wording Illustrative)

When P1 asks, the contributor sees each possible match with its evidence, place and chronology, and three kinds of answer:

1. **"Add my Report to [Happening]"** → existing confirmed-match path.
2. **"My Report describes a different situation from these"** → publishes a new Happening and records a `different` statement by the contributor for each possible match (P3).
3. **"I can't tell. Publish my Report on its own for now"** → publishes a new Happening and records an `unsure` statement by the contributor for each `unknown` candidate (P3).

Answers 2 and 3 are grounded in the shown situations rather than asking "is this new?", which is the intent of ADR 0004 and #6. **Agreed (2026-10-29):** the product owner accepted both answers as satisfying that rule.

**Offered candidates (Agreed 2026-10-29).** Every possible match (at most `maxCandidates`, 20) is offered, ordered `same` first, then `unknown`, then by the existing review order. The first five show; the rest are behind "Show more". Candidates graded `separate` are not offered.
- Answer 1 accepts any offered candidate the contributor has shown.
- Answer 2 ("different") requires every offered possible match in `candidateIdsShown`, because it is a claim about all of them.
- Answer 3 ("can't tell") requires the first five (or all, if fewer) in `candidateIdsShown`. Unshown possible matches still receive automatic statements, so nothing is hidden.

This replaces today's fixed review set of five (`REVIEW_SET_SIZE`, `src/lib/report-submission.ts:132`), which would otherwise make answers 2 and 3 impossible with six or more possible matches.

### P3. Connections are attributed statements (Agreed 2026-10-29; field names Illustrative)

**Agreed principle (2026-10-29):** if anyone, a person or automatic matching, has suggested that two Happenings may describe the same situation, the connection is displayed, whether or not it is accurate. A later "different" never hides it; it is shown beside the earlier statements. Disagreement is displayed, not settled by whoever spoke last. Showing a connection never moves Reports or changes either Shared Account's claims.

**Agreed (2026-10-29):** automatic matching counts as a source and is labelled as automatic. People make statements only through the matching question on their own Report, never from a Happening page, so every statement is tied to a Report.

A **connection** is an unordered pair of Happenings. A **statement** is an immutable, attributed record attached to it. Connections have no "resolved" state; only emptying one Happening into the other (P5) supersedes one.

`nearhood.happening_connections`:

| Field | Meaning |
| --- | --- |
| `id` | Connection ID |
| `happening_low`, `happening_high` | The pair, stored in sorted order; unique |
| `created_at` | First statement time |
| `superseded_at` | Set when P5 empties one Happening into the other; otherwise null |

`nearhood.connection_statements` (append-only):

| Field | Meaning |
| --- | --- |
| `id`, `connection_id` | Identity |
| `source` | `contributor` or `automatic_matching` |
| `kind` | `unsure` (contributor couldn't tell), `different` (contributor said different), `possibly_same` (automatic: graded `same` or `unknown`) |
| `report_id` | The Report whose processing or answer produced it (required) |
| `contributor_id` | Set for `contributor` statements; null for automatic |
| `matching_version`, `snapshot_fingerprint` | What automatic matching saw; null for contributor statements |
| `evidence_ids` | Cited Observation IDs from the Report and the candidate |
| `partial_evidence` | True when matching saw only some of either Happening's Reports (`coverage.omittedEvidence`); false for contributor statements |
| `reason` | Model reason for automatic statements; null for contributor statements. Contributors add no free text (Agreed 2026-10-29): their Report is the evidence. |
| `created_at` | Time |

**When statements are written (Agreed 2026-10-29).** In the publication transaction for Report R into Happening H (new or existing):
1. For every other candidate C whose effective grade (P1) is `same` or `unknown`, shown or not, add an `automatic_matching` / `possibly_same` statement on (H, C), citing R.
2. For every pair of candidates (C1, C2) both graded `same`, add an `automatic_matching` / `possibly_same` statement on (C1, C2), citing R.
3. If R was published through D1, add the contributor's statement on (H, C): `unsure` for each `unknown` candidate after answer 3, `different` for each possible match after answer 2.
4. Candidates graded `separate` produce nothing.
5. Statements are unique per (connection, Report, source, kind). A connection row is created with its first statement.

**Shared Account versions (Agreed 2026-10-29; mechanics Proposed).** When a connection becomes displayed, the same transaction publishes a new Shared Account version for **both** Happenings, adding its uncertainty item, so the account history records when the doubt appeared. Later statements on an already displayed connection do not create versions.
- A connection-only version copies the previous version's claims and claim supports unchanged and appends the uncertainty item. Its `origin` is `connection_update`; the migration widens the `shared_accounts.origin` check (today `seed_fixture`, `model_derived`).
- The item text comes from one function of the other Happening's title, so it can be found and removed exactly.
- Both Happening rows are locked `FOR UPDATE` in ID order, under `PUBLICATION_LOCK`.
- **Accepted side effect:** a new version changes that Happening's `accountVersion`, which is part of the candidate fingerprint. Another contributor reviewing a nearby Report at that moment is told "Nearby evidence changed. Refresh the suggestions", as for any other account change.
- When a connection is superseded (P5), the remaining Happening gets a new version without that item.

**When a connection is displayed (Agreed 2026-10-29).** When it has at least one `possibly_same` or `unsure` statement and is not superseded. A connection with only `different` statements is stored but not displayed, because no one suggested a connection; `different` statements are shown inside a displayed connection. In practice, answer 2 usually still displays the connection, because the shown candidates were graded `same` or `unknown` and rule 1 adds an automatic statement.

### P4. Display (Agreed 2026-10-29; wording Illustrative)

- **Happening page:** one block per displayed connection, statements in time order:
  > **Possible connection with *Eastbank footbridge closure***
  > - Jules couldn't tell whether their Report is about the same situation (28 Oct).
  > - Automatic matching found Omar's Report may describe both (29 Oct). [reason]
  > - Mara said her Report is about a different situation (29 Oct).
  >
  > Not confirmed. [View both sets of evidence]
- People are named by the public display name already shown on their Report, linked to that Report. Automatic statements say "Automatic matching".
- Each statement links to its Report and cited Observations. No score, and no verdict from counting statements.
- **Shared Account uncertainty:** one item per displayed connection (not combined): "Another Happening nearby may describe the same situation: *Eastbank footbridge closure*. Not confirmed."
- **Map (Agreed 2026-10-29, Q3):** no change. Connected Happenings keep normal pins; the connection appears only on Happening pages and in the Shared Account. Revisit with #17.

### P5. Repair: contributors move their own Report (Agreed 2026-10-29; storage Proposed; part of #6)

**Agreed (2026-10-29):**
- Only a Report's own contributor can move it between connected Happenings (Q1).
- No one merges whole Happenings in this proposal; a steward role is deferred to a later issue (Q2).
- There is no "dismiss". A `different` answer is a statement (P3), not a resolution.

**Agreed details (2026-10-29):**
- **Move:** from their Report's page, the contributor sees both connected Happenings' evidence and chooses "Move my Report to [Happening]". Only Happenings with a displayed connection to the Report's current Happening are offered. The Report's Observations change membership in one transaction under `PUBLICATION_LOCK`; both Shared Accounts get new versions; a history row keeps who, when, from and to.
- **Emptied Happening:** when the last Report leaves a Happening, its pin and page disappear and it becomes a redirect to the Happening that Report moved into; old links open that Happening with a "moved into" note. Its ID is never reused. Any connection between the two is marked superseded.
- **Moving back:** the same action in reverse, recorded as another history entry. A redirected Happening is restored if a Report moves back into it.
- Statements are never deleted by a move; they keep their original Report and time.
- In-flight processing based on pre-move membership must not restore it (#6 acceptance criterion). Moves change both Happenings' account versions, so the existing fingerprint check refuses stale decisions.

**Storage and account rules (Proposed):**
- `nearhood.happenings.redirect_to` (nullable, references `happenings.id`). Map and list queries exclude redirected rows. Happening detail for a redirected ID returns `{ redirectTo }`; the page opens the target with a "moved into" note.
- `nearhood.membership_changes`: `id`, `report_id`, `from_happening_id`, `to_happening_id`, `actor_id`, `created_at`. Append-only.
- **Account after a Report leaves:** the new version keeps each previous claim that still has at least one supporting Observation in the Happening, with supports limited to those Observations; claims left without support are dropped. Uncertainty is recomputed: the single-contributor caveat by contributor count; connection items unchanged.
- **Account after a Report arrives:** the same as today's existing-Happening publication (`publishEvidence`): previous claims plus one claim per moved Observation with a described condition.
- Both versions use `origin` `membership_change` (added by the same migration as `connection_update`).
- **Emptied Happening:** `redirect_to` is set and no new account version is written; its last version stays as history. Moving a Report back clears `redirect_to` and writes a new version.

### Example: the footbridge Report under this proposal

After v6 grading, the expected result is `same` for the bridge (the text says "the same … footbridge closure") and `separate` for the lamp, picnic, garden cleanup and walk signal. Path-water may stay `unknown`. Under P1 that is one `same`, so the bridge is suggested with path-water as an alternative, and the omitted fourth bridge Report no longer blocks (P2: the bridge is graded `same`). If grading instead returns `unknown` for the bridge too, the contributor sees D1 and can publish without waiting. **Illustrative:** the expected grades are a prediction, not a test result.

## Implementation boundaries

| Area | Proposed change |
| --- | --- |
| Model | The [consolidated v6 contract](ticket-4-matching-v6-revision.md#consolidated-v6-contract-2026-10-29). **Proposed, not yet agreed:** let reasons cite the new Report's Observation keys so code can check a reason refers to the Report (research: Step 0). Per-candidate grading calls are an experiment, gated by Q5. |
| Decision rule | `compareReport` (`src/lib/report-model.ts`): effective grade and P1 table; P2 coverage rules. `reviewSet` (`src/lib/report-submission.ts`): offer every possible match (D1). |
| Data | Slice 3: `nearhood.happening_connections`, `nearhood.connection_statements`; `shared_accounts.origin` gains `connection_update`; `report_processing.decision_source` gains `contributor_unsure`. Slice 5: `happenings.redirect_to`, `nearhood.membership_changes`, origin `membership_change`. No backfill. |
| Lifecycle | `clarification` gains answers 2 and 3 (D1). Every publication (new or existing Happening) writes P3 statements in the same transaction, under `PUBLICATION_LOCK`. |
| API | `POST /api/reports/:id/match`: `MatchChoice` (`src/lib/happenings.ts:99`) keeps `match` and `create_new` (answer 2, `decision_source` `contributor_rejected_candidates`) and adds `{ choice: "unsure", candidateIdsShown }` (answer 3, `decision_source` `contributor_unsure`); both new-Happening answers set `matching_outcome` `create_new`. Validated against `offered_candidate_ids` and the snapshot fingerprint like today, with D1's shown-candidate rules. `GET /api/happenings/:id` adds `connections: { happeningId, title, statements: { source, kind, reportId, displayName \| null, createdAt, reason \| null, evidenceIds, partialEvidence }[] }[]`, displayed connections only, statements oldest first. Slice 5 adds `POST /api/reports/:id/move` with `{ toHappeningId }`, owner-only. No endpoint adds statements outside matching. |
| UI | Contribution flow: D1 choices. Happening page: P4 connection blocks. Map: unchanged (Q3). |

## Failure and recovery

- **Stale evidence:** if the snapshot fingerprint changed, the D1 choice is refused with "Nearby evidence changed. Refresh the suggestions", as today.
- **Connected Happening redirected or gone before publication:** the statement targets the redirect target, or is skipped with a logged reason; publication still succeeds.
- **Repeated choice:** idempotent, like the current match decision; statements are unique per (connection, Report, source, kind), so a retry adds nothing.
- **Model failure:** unchanged; a failure never means no match and leaves the Report retryable (#20 owns retry).
- **Contributor never answers:** still unpublished. Out of scope here (Q4); #20 owns it.

## Verification and acceptance

- [ ] Given a Report graded one `same` plus some `unknown`, the contributor is offered the `same` candidate first and the `unknown` ones as alternatives; no `clarification` state is entered.
- [ ] A candidate graded `separate` with chronology `conflict` is treated as `unknown`: offered as an alternative, never suggested, and given an automatic statement.
- [ ] With eight possible matches, all eight are offered; "can't tell" is accepted after the first five are shown; "different" is refused until all eight are shown.
- [ ] A Report graded `same` for both A and B produces an automatic statement on (A, B) as well as on the Report's Happening with each.
- [ ] Given no `same` and some `unknown`, choosing "I can't tell" publishes a new Happening with contributor `unsure` and automatic `possibly_same` statements for each `unknown` candidate; neither connected Happening's membership or claims change.
- [ ] Choosing "different" publishes with contributor `different` statements; a later Report graded `unknown` for the same pair adds an automatic statement, and the connection is displayed with both statements.
- [ ] A Report confirmed into Happening A while graded `unknown` for B adds an automatic statement on (A, B), shown on both pages.
- [ ] A displayed connection lists every statement in time order with its source, Report and evidence, and adds one uncertainty item to each Shared Account through a new `connection_update` version; claims are unchanged.
- [ ] No API path adds a statement except a Report's processing or its contributor's matching answer.
- [ ] Reports left out of a Happening's evidence never block publication, and the question and automatic statements disclose partial evidence for that Happening.
- [ ] With more than 20 nearby Happenings, the Report is never published as new automatically; answer 2 is refused and answer 3 publishes.
- [ ] Repeating the same D1 choice does not duplicate Happenings or statements.
- [ ] Moving a contributor's only Report out of B makes B a redirect, removes its pin, and writes new versions for A; moving it back restores B. Moving someone else's Report is refused.
- [ ] Model changes are measured on newly written held-out cases as well as the existing ones; the T02 partial reopening must match, not split.

Product-boundary tests follow [ADR 0003](../adr/0003-test-through-the-product-boundary.md) with controlled model responses.

## Delivery and open decisions

Slices, smallest useful first. Status lives in the linked issues.

1. **Grading (v6 revision), #21.** Fewer unnecessary `unknown` grades. No ADR change.
2. **P1 rule fix for "one `same` plus `unknown`", #22.** Small code change; fixes P03.
3. **D1 + P3 + P4, #23.** The contributor can always publish; connections are recorded and shown.
4. **P2 left-out evidence, #24.** Revises ADR 0005 (recorded in ADR 0008).
5. **P5 repair, #25.** Contributor moves their own Report. Part of #6.

Slices 1 and 2 do not depend on any open question. A demo may ship slices 1 to 3 without slice 5: connections are statements, not states, so nothing needs dismissing. **Risk:** until slice 1 lowers unnecessary `unknown` grades, automatic statements will connect many unrelated demo Happenings (P03 graded 19 unrelated candidates `unknown`). Ship slice 3 only after slice 1 is measured.

**Open decisions:**

| ID | Question | Impact | Evidence needed |
| --- | --- | --- | --- |
| D1 | ~~Does "I can't tell. Publish my Report on its own for now" satisfy ADR 0004's "do not ask whether it is new"?~~ | **Decided 2026-10-29:** yes; offer both "different" and "can't tell". | — |
| Q1 | ~~Who may move a Report between connected Happenings?~~ | **Decided 2026-10-29:** only its contributor. | — |
| Q2 | ~~Who may merge whole Happenings?~~ | **Decided 2026-10-29:** nobody in this proposal; steward role deferred to a later issue. | — |
| Q3 | ~~How are connected pins shown on the map?~~ | **Decided 2026-10-29:** normal pins; revisit with #17. | — |
| Q4 | ~~Should an unanswered Report publish on its own after some time?~~ | **Decided 2026-10-29:** out of scope; #20 owns it. | — |
| Q5 | Is per-candidate grading worth more model calls than ADR 0005's one call per request? | Only if slice 1 leaves P03-style errors | Slice 1 evaluation |
| Q6 | ~~Is a contributor's "different" binding?~~ | **Decided 2026-10-29:** no. It is one displayed statement; any suggested connection stays visible. | — |

## Decision record

**Outcome / date:** Agreed 2026-10-29 in discussion with Maoyuan Wang:
- P1 agreed: one `same` plus `unknown` candidates gives a suggestion.
- D1 agreed: "different" and "can't tell" answers.
- P3 principle agreed: any suggested connection is displayed regardless of accuracy; "different" never hides it (decides Q6).
- Automatic matching counts as a labelled source; people add statements only through their own Report's matching question.
- P2 agreed: left-out Reports are disclosed, never blocking; more than 20 nearby Happenings refuses answer 2 and never auto-publishes.
- Display: a connection with only `different` statements is not shown.
- P3 to P5 details agreed: automatic statements for every `same`/`unknown` candidate; display names; no contributor notes; one uncertainty item per connection; new Shared Account versions for both Happenings when a connection becomes displayed; an emptied Happening redirects.
- Q1: only a Report's contributor moves it. Q2: no whole-Happening merge; steward deferred. Q3: normal map pins. Q4: left to #20.
- Review gaps: every possible match is offered (show more); two `same` candidates are connected to each other; `separate` + `conflict` counts as `unknown`.

**Agreed scope and rationale:** P1 to P5 and D1 as written; see Problem and evidence.
**Issue / ADR / implementation reference:** [ADR 0008](../adr/0008-uncertain-matches-publish-with-connections.md); revision notes in ADR 0004 and ADR 0005. Slice issues: #21 to #25.
