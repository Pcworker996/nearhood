# Ticket #4: saved Report state after matching

October 27, 2026. The earlier [live matching evaluation](2026-10-27-issue-4-live-matching.md) scored model assessments and software-derived recommendations. It did not verify saved processing state, membership, or publication. This record adds that product-boundary verification for [ticket #4](https://github.com/Pcworker996/nebius-hack/issues/4).

The focused run passed **18/18 journeys**, covering nine scenarios on mobile and desktop. The full browser run reported **112 passed**, with zero unexpected failures. That count includes the two existing expected marker-overlap failures for #17. These are real application API and PostgreSQL outcomes with recorded or controlled external responses, not new live model calls.

## Publication is a separate decision boundary

The saved entity is a Report. Its processing state has more values than published and pending:

| Matching outcome | Persisted state | Published evidence immediately? | Transition after user action |
| --- | --- | --- | --- |
| Supported new occurrence, complete search | `published` | Yes, in a new Happening | Already complete |
| Unique existing-Happening suggestion | `match_review` | No | Confirmation publishes into the chosen existing Happening |
| Unknown continuity or multiple plausible candidates | `clarification` | No | A valid contributor choice can publish; otherwise it stays unassigned |
| Provider failure or invalid/incomplete response | `pending` | No | Retry matching using the retained extraction checkpoint |

Before matching, submission is `saved`; successful extraction leaves a saved checkpoint ready for matching. `processing` is the leased in-flight state. This suite observes the stable states returned after those requests, not every transient in-flight database update.

The model does not return a published/pending flag. It returns candidate assessments. Software derives a recommendation, persists the next state, and enforces publication and confirmation rules.

## Recorded responses exercised through the application

[State tests](../../tests/report-matching-state.spec.ts) replay eight selected responses from the preserved live matching artifacts. Each row runs once in each browser project. A ninth journey uses controlled provider failure and empty-search responses.

| Source | After matching | Further verified outcome |
| --- | --- | --- |
| T01: supported partial reopening | `match_review`, no membership | Explicit confirmation publishes into the existing Happening; repeated confirmation creates no duplicate Reports or Observations |
| N01: explicitly unrelated sticker | `published` in a new Happening | Existing candidate evidence unchanged; repeat processing does not duplicate publication |
| T02: model unnecessarily uncertain about partial reopening | `clarification`, unassigned | Contributor selection publishes into the chosen Happening exactly once |
| D03: model uncertain about same-occurrence disagreement | `clarification`, unassigned | Reload preserves state and original Report; candidate account and evidence unchanged |
| S03: model abstains with unknown observation time | `clarification`, unassigned | Unknown time remains unknown; no public Happening at the Report's own ID |
| U04: unsupported confident same-occurrence assessment | `match_review`, unassigned | The incorrect model assessment cannot publish into an existing Happening without confirmation |
| P03: correct target plus nineteen unknown distractors | `clarification`, unassigned | Attempting create-new while unshown plausible candidates remain returns 409; state remains unchanged |
| A02-remove-identity: one assessment missing | `pending`, reason `matching_failed` | Valid recorded retry reaches clarification; original Report and saved extraction remain available |
| Controlled provider outage, then empty search | `pending`, then `published` after retry | One extraction and two matching calls; no public evidence before successful retry; publication occurs once |

Each journey rereads the owner recovery endpoint after its meaningful state changes. Checks cover the original words, processing stage, extraction checkpoint, Happening membership and saved state. Before confirmation, every seeded candidate's account, Reports and Observations must remain unchanged. Unassigned Reports must not appear as a public Happening at their own ID.

For the supported-match and uncertainty-confirmation journeys, public evidence is reread after confirmation. The saved Report must appear once, its Observations must belong to the selected Happening, and a repeated identical confirmation must leave evidence counts unchanged.

These tests assert the correct application response to the actual recorded model output. They do not assert that every recorded model interpretation is correct. U04 remains a model-quality failure. T02's clarification is the correct storage transition for an unnecessarily uncertain model response. Passing this suite does not erase those semantic failures or qualify the model.

## Compare state verdicts across the original 144 trials

For completeness, the original recommendation labels and actual recommendations can also be translated into the stable state expected immediately after matching, before any contributor confirmation:

| Expected next state from the original case label | Projected match_review | Projected published | Projected clarification | Projected pending |
| --- | --- | --- | --- | --- |
| match_review | 81 | 0 | 12 | 0 |
| published | 0 | 24 | 0 | 0 |
| clarification | 3 | 0 | 23 | 1 |

These projected state verdicts agree in 128/144 trials. The twelve unnecessary clarifications, three unsupported review suggestions and one invalid response remain visible. This is a projection of the archived model results, not 144 additional database replays. The eighteen product-boundary journeys above verify selected cases and transitions against real persistence. Independent label review is still outstanding.

## Test boundary and fixture adaptations

- Browser sign-in uses the existing localhost external auth fixture. The application server, API routes, authorization, PostgreSQL/PostGIS, processing, recovery and publication code are real.
- The external model fixture accepts an optional `matchingReplay` string for the matching stage only. Existing extraction behavior and ordinary fixture responses remain available. The fixture does not import application storage or processing helpers.
- Seed synthetic candidate Happenings through the real APIs, with short first-sentence support for each source evidence item. Rebind only structured candidate and evidence IDs in the recorded output to those test entities. Recorded reason text is retained. This tests state transitions, not exact reconstruction or renewed semantic evaluation of the original candidate packet.
- Coordinates are isolated per scenario and browser project. Recorded observation timestamps are shifted together into the past, preserving their relative intervals and null values. The real submission API correctly rejects future observation times, so the offline evaluation dates cannot be submitted unchanged.
- No provider inference, hosted database, deployment, product schema, processing rule, UI, or production model prompt changed for this verification.

Your existing development server on port 3000 remained running. Next.js prevents two dev servers in the same application directory, so verification used an isolated source copy under `.local/matching-state-checkout`. Its copied Playwright configuration selects webpack to support the linked dependencies. Test servers use ports 3100 and 3101 and a new disposable local database, removed by the existing verification script.

## Verification record

The first targeted T01 test failed before replay support was added: it received the old fixture's no-match behavior and `published` instead of `match_review`. This demonstrated that the test checks the actual persisted transition. After adding replay support, the initial broader run had twelve passes and six setup failures because recorded lamp observation dates were in the future. Rebased timestamps resolved those setup failures without changing the publication rules or recorded matching assessments.

The resulting focused run passed 18/18, with typecheck and the existing model, extraction, review-set and lease checks also passing. Full verification then completed with the same gates passing and the browser reporter recording 112 passed in 5.1 minutes. The existing overlapping-marker test uses `test.fail()` for #17 in both projects: those two expected failures are included in Playwright's passing total. All eighteen new state tests pass their assertions normally. No unexpected failures remain.

Permanent evidence:

- [All eighteen observed state histories](artifacts/2026-10-27-issue-4-matching-states/saved-states.json).
- [Projection for all 144 original model trials](artifacts/2026-10-27-issue-4-matching-states/state-verdicts.json).
- [Environment, source fingerprints and verification counts](artifacts/2026-10-27-issue-4-matching-states/manifest.json).
- [Full browser verification log](artifacts/2026-10-27-issue-4-matching-states/browser.log).

The tested processing, model adapter, recovery/storage, test and fixture source files match the current checkout by content hash. The disposable database was removed after verification. The original development server was not stopped.

To rerun in an available checkout with PostgreSQL/PostGIS on port 55432:

```sh
npm run verify -- tests/report-matching-state.spec.ts
```

Use Node 22.19.0 for the recorded environment. If another development server uses the checkout, run from an isolated source copy as above. The command creates a disposable database and controls external auth/model services. It makes no paid Nebius calls.

Related: [state-verification plan](../proposals/ticket-4-matching-state-verification.md), [matching suite design](../proposals/ticket-4-matching-evaluation.md), and [ADR 0003](../adr/0003-test-through-the-product-boundary.md).
