# Proposal: Fix the failures from the 2026-10-27 live extraction run

**Status:** Draft, not accepted or implemented.
**Author / date:** Agent draft for Maoyuan Wang, 2026-10-27.
**Related issues:** [#4](../issues/4.md) (criterion 36, extraction). Evidence: [live extraction record](../reviews/2026-10-27-issue-4-live-extraction.md). Plan: [ticket-4 test plan](ticket-4-test-plan.md).
**Decision requested:** Agree to L1 to L3 below, and answer U1 to U3, before `report-extraction-v8` is implemented.

Labels: **Proposed** is a contract to accept or change. **Illustrative** is wording or a value that can change without changing behavior. **Undecided** blocks the work that depends on it.

## Problem and evidence

The live run (33 development cases × 3 runs, `nvidia/Nemotron-3-Ultra-550b-a55b`, extraction v7) failed the same 4 cases in every run. Labels are agent drafts that the user has not yet reviewed.

| ID | Case | What happens today | Evidence |
| --- | --- | --- | --- |
| P1 | "Barriers block the left lane of the bridge. Traffic was too heavy to see the right lane." | The model returns scope "right lane of the bridge", which the Report never says. Validation rejects the **whole** extraction. | 3/3 runs; raw output captured 2026-10-27 |
| P2 | "La entrada norte está cerrada." | The model translates the scope to "north entrance". The whole extraction is rejected. | 3/3 runs |
| P3 | "At 10 pm, the streetlamp at Alder and 3rd is lit. This conflicts with…" | Category `activity`. The draft label is `disruption` (a reported resolution, per the v7 rule). This trips the hazard → activity gate. | 3/3 runs |
| P4 | "Only the south half of the lot is fenced now." | The model's scope "south half of the lot" is correct, but the draft label expected "south half". | Label error, not a model failure |

**Why P1 and P2 matter more than a failed test.** A rejected extraction leaves the Report `pending` and retryable (`report-processing.ts`). At `temperature: 0` the same answer came back in 3 of 3 runs, so each retry makes another paid call and fails the same way. The contributor's Report is saved but never processed.

Observed: two triggers, an added qualifier and a translation. Assumption, unverified: any Report not in English is at risk whenever the model translates its scope. Only one such case has been run.

The same stuck state exists for `timeWording`. The `rejected-time.json` fixture shows that an invented time wording rejects the whole extraction. It was not seen live, but the mechanism is identical.

## Goal and scope

- **Outcome:**
  - Wording the model invents for scope or time costs only that one field, never the whole Report. No Report can get stuck in an endless retry because of it.
  - A Report that something works normally again is never shown as an `activity`.
  - The live set measures the model, not label mistakes.
- **Included:** L1 to L3 below, shipped as `report-extraction-v8`.
- **Deferred:**
  - Non-time text in `timeWording` ("The west gate is closed."). It is accepted today because it is a substring of the Report, and it is a separate validation question.
  - Provider latency spikes (about 15 s). These are within budget and are a hosting measurement for phase 4.
  - Translation support or multilingual scope.
- **Constraints:**
  - Reports stay immutable and remain the authority ([ADR 0001](../adr/0001-preserve-evidence-separately.md)).
  - Spatial scope ranks high in the [guardrails](../product-guardrails.md), so a scope is never invented: an unsupported scope becomes null, never a paraphrase.
  - Tests run through the product boundary ([ADR 0003](../adr/0003-test-through-the-product-boundary.md)).

## Options and recommendation

**For P1 and P2 (stuck Reports):**

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| A. Keep rejecting | Strict: no unsupported wording is ever stored | Reports stay stuck; each retry is another paid, failing call |
| B. Prompt only: copy the scope verbatim in the Report's language | Fixes the cause when the model obeys; no contract change beyond wording | A model that still paraphrases leaves the Report stuck. P1 broke the existing "copy it from originalText" rule, so another rule alone may not hold |
| **C. B plus field-level fallback** | Invented wording can never block a Report; the prompt still pushes for verbatim scope | That Observation loses its scope, though its subject and the linked original words remain |
| D. Software repair: find the closest real substring | Keeps a scope | Guessing a scope breaks "never invent a scope", and can misattribute (for example "right lane of the bridge" → "the bridge") |

**Recommendation: C.** The validator still decides what is stored. It now rejects one field instead of the whole Report. D is rejected because it makes software invent scope.

**For P3 (lamp category):** add one prompt rule (L2). Option B, with no software change, is enough for a category. Software cannot judge whether a Report describes a resolution.

## Concrete behavior

**P1, current behavior:** the extraction is rejected, the Report stays `pending`, and retrying repeats the failure.

**P1, proposed:**

- The left-lane Observation is unchanged: scope "left lane of the bridge" is a verbatim substring, so it passes.
- The right-lane Observation keeps `describedCondition: null` and its uncertainty "Traffic was too heavy to see the right lane…".
- On that Observation, `spatialScope` becomes `null`, and the private field `unsupportedWording` records `{ field: "spatialScope", value: "right lane of the bridge" }`.
- Processing continues to matching.
- Published result: the right-lane Observation shows "No condition described", its uncertainty, no scope, and the original Report beside it.

If the v8 prompt works, the model returns "right lane" and nothing is dropped.

**P2:** the scope "north entrance" is dropped, and the condition "closed" with its subject is kept. The card shows the original Spanish words beside the derived Observation. The derived subject is in English: subjects are interpretations, which the contract already states.

**P3:** "At 10 pm, the streetlamp at Alder and 3rd is lit." → `disruption` (pending U1). If no existing lamp Happening matches, the new Happening shows a warning icon for a working lamp. That over-warns, which costs less than an `activity` pin.

**Still rejected (unchanged):** structure, enums including category, keys, source IDs, occurrence groups and text lengths. These protect integrity or traceability, and none was seen to repeat live.

## Implementation boundaries

| Area | Proposed change |
| --- | --- |
| Data | `Extraction.observations[]` gains private `unsupportedWording: { field: "spatialScope" \| "timeWording"; value: string }[]` (Illustrative name). It replaces nothing. `scopeOutsideCitation` stays, and is false when the scope is null. |
| Validation (`extractReportInfo`) | **L1, Proposed.** If `spatialScope` or `timeWording` fails its existing check (v7 whole-word rule for scope; substring of text or form time for time wording), set that field to `null`, append to `unsupportedWording`, and continue. Every other check still rejects. |
| Prompt | **L1:** "Copy spatialScope character for character from originalText, in the Report's own language. Never translate, expand or add words such as 'of the bridge'. If no exact phrase fits, use null." **L2:** "A Report that something works normally again or has recovered (lit, open, clear, repaired) is disruption, never activity." Both Illustrative wording. |
| Version | `report-extraction-v8`: prompt and validation semantics change. v7 checkpoints are re-extracted on their next processing request, by the existing rule. `MATCHING_VERSION` is unchanged. |
| Matching input | Unchanged. It lists Observation fields explicitly, so `unsupportedWording` never reaches call 2. A null scope is already a valid input. |
| Storage / API / UI | No migration. The private extraction checkpoint is JSON. Published Observations already allow a null `spatial_scope` and null time. The API and UI are unchanged. |
| Live checker | Prints a `DROPPED: "<key>" <field> "<value>"` line for each fallback, and a summary count. These are not failures: the reviewer checks that the dropped wording really was unsupported. |
| Fixtures and labels | **L3.** `partial-change.json` expects "south half of the lot". `rejected-scope.json`, `rejected-time.json`, `rejected-scope-fragment.json` and `rejected-scope-partial-word.json` become accepted fixtures with a null field and an `unsupportedWording` entry. Rename them to `dropped-*.json` (Illustrative). |

Affected modules: `src/lib/report-model.ts`, `scripts/check-extraction-live.ts`, `scripts/fixtures/extraction*/`, `tests/external-services.ts`, `docs/implementation/report-processing-stages.md`.

## Failure and recovery

| Case | Saved | Contributor sees | Resume |
| --- | --- | --- | --- |
| Scope or time wording unsupported (L1) | Extraction with that field null and `unsupportedWording` recorded | Normal processing; the Observation has no scope or time | Nothing to do |
| Every Observation's scope dropped | Extraction proceeds; matching compares the original words, coordinates and location name | Normal processing | Nothing to do |
| Any other validation failure | As today: pending, retryable | As today | Retry |
| Model keeps returning `activity` for a resolution after L2 | Category as returned | Activity pin | Caught by the live gate before release; U1 decides the label |

## Verification and acceptance

**L1 (fixtures, `npm run test:extraction`):**
- [ ] An expanded scope ("right lane of the bridge" for "the right lane") gives an extraction with that scope null and one `unsupportedWording` entry. The other Observations are unchanged.
- [ ] A translated scope gives the same result.
- [ ] An invented time wording ("yesterday", not in the text or form time) gives `timeWording: null` plus an entry. The form `observedAt` is untouched.
- [ ] A fragment (`"e"`) and part of a word (`"north"` in "northern") give null plus an entry.
- [ ] An invalid category, source ID or group is still rejected (existing table test unchanged).
- [ ] The matching request contains no `unsupportedWording` (assertion in the matching test).

**L2 (browser, fixture model):**
- [ ] New fixture mode `invented-scope` returns a scope absent from the text. The Report publishes, and the Observation has `spatialScope: null` and the original words. Exactly one extraction call is made, with no retry loop.

**L3 (live, approval needed; a re-run of the 2026-10-27 set, 3 runs):**
- [ ] `hedge-partial-view` and `non-english` are accepted in 3 of 3 runs, either with a verbatim scope or with a `DROPPED` line that the reviewer confirms.
- [ ] `scope-back-reference-lamp` is `disruption` in 3 of 3 runs, if U1 confirms the label.
- [ ] `partial-change` passes with the corrected label.
- [ ] No regression in the run's gates: zero conditions on unreported parts, zero unsupported conditions (manual), zero hazard → activity, every stage under 25 s.
- [ ] The `DROPPED` count is reported. If more than about 1 in 10 scoped Observations is dropped, the prompt is not working and L1 is hiding a model problem (Illustrative threshold).

Fixture results are not live evidence. The L3 run is still provisional until labels are reviewed and the safety and held-out preconditions in the test plan are met.

## Delivery and open decisions

One small slice: L1 to L3 together in one change, because they share `report-extraction-v8`. Rollback: revert. Checkpoints written by v8 would then be "newer" to an older instance and show `refresh_required` (C1/C2 from the review fixes) without looping.

- **U1. The lamp label.** Is a Report that something works normally again `disruption`? Recommended yes: it is the resolution of a problem, and the v7 rule already says so. The alternative is to accept `activity` as well for such Reports, which removes the gate failure but allows a working lamp to look like an event.
- **U2. Show dropped wording publicly?** Recommended no for now. The original words sit beside every Observation, and the field is a review signal, not evidence. Showing "The affected part could not be confirmed from the Report's words" (Illustrative) is the alternative, if readers should see the gap.
- **U3. Should time wording get the fallback too?** Recommended yes. The stuck mechanism is the same, and dropping an invented time can never overwrite the form's explicit time. The alternative is scope only, keeping the stricter time rule.

## Decision record

**Outcome / date:** Pending.
**Agreed scope and rationale:** …
**Issue / ADR / implementation reference:** #4; [live extraction record](../reviews/2026-10-27-issue-4-live-extraction.md).
