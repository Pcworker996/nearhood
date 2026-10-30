# Verify saved Report state after matching

Status: implemented October 27, 2026; focused product-boundary verification passes 18/18 on mobile and desktop. Full browser run reports 112 passed, including two existing expected failures for #17, with zero unexpected failures. See the [verification record](../reviews/2026-10-27-issue-4-matching-states.md). Related: [ticket #4](../issues/4.md), [matching-only live evaluation](../reviews/2026-10-27-issue-4-live-matching.md), and [ADR 0003](../adr/0003-test-through-the-product-boundary.md).

The model-only evaluation did not exercise saved Report processing state or publication. Add a separate product-boundary test that replays recorded matching responses through the real application APIs and PostgreSQL, using controlled external auth and model services.

## Expected behavior

| Matching result | Saved state after matching | Public membership | Next action |
| --- | --- | --- | --- |
| Supported no-match with complete coverage | published | A new Happening contains the Report | None |
| Unique existing match | match_review | None yet | Contributor confirms a shown candidate |
| Uncertain identity or multiple plausible candidates | clarification | None yet | Contributor chooses a shown candidate or leaves it unassigned |
| Invalid/incomplete response or provider failure | pending | None | Retry matching using the saved extraction |

Confirmation moves an eligible match_review or clarification Report to published with one membership in the chosen Happening. Repeating the same confirmation must not duplicate the Report or its Observations. Reload must preserve every saved state. A model recommendation alone must never incorporate a Report into an existing Happening.

Use eight recorded cases: T01, N01, T02, D03, S03, U04, P03, and A02-remove-identity. Also check a controlled provider failure followed by an empty-pool no-match retry. U04's bad same-occurrence interpretation must still wait for confirmation. P03's many unknown distractors must stay unassigned and block create-new when plausible candidates are unshown.

## Responsibilities and boundaries

- Storage, APIs, publication and recovery use the existing production code, unchanged. Tests observe owner-only GET responses and public Happening evidence before and after mutations.
- Seed synthetic candidate Happenings through real submission/processing APIs. Rebind recorded structured candidate and evidence IDs to those isolated test entities. The reason text remains the recorded model text.
- Replay only the matching response. Extraction and authentication use existing external-service fixtures. This establishes state behavior for those responses, not a second live evaluation or exact reconstruction of each original evidence packet.
- Extend only the localhost model fixture with an optional recorded matching-content field. The fixture must not import application storage or processing helpers.
- Use a new disposable local database. No hosted data, schema change, new product state, endpoint, or UI behavior is needed.

## Acceptance

Each journey checks saved -> saved extraction checkpoint -> matching result state, reload persistence, original Report preservation, membership, public evidence isolation, and candidate accounts unchanged before confirmation. Selected journeys check confirmation, repeated confirmation, invalid-output recovery, provider recovery, and blocked create-new.

Run on mobile and desktop. Attach actual API state snapshots to each result and document fixture versus live evidence explicitly. Product-boundary passes must not replace the earlier model-quality failures or imply the model is qualified.
