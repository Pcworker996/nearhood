# Duplicate report handling: source notes

Accessed **2026-10-29**. Supporting research for the open question of what Nearhood should do when a Report's candidate Happenings are neither clearly the same nor clearly separate ([ADR 0004](../adr/0004-confirm-matches-before-membership.md), [ADR 0007](../adr/0007-happening-identity-follows-the-situation.md), [#6](https://github.com/Pcworker996/nebius-hack/issues/6), [#20](https://github.com/Pcworker996/nebius-hack/issues/20)). These notes summarize source behaviour. The Nearhood section is our recommendation, not vendor claims or implemented features.

FixMyStreet source links are pinned to commit [`cd96011`](https://github.com/mysociety/fixmystreet/tree/cd96011f1630272f3aecde3c461873245faac2a8).

## FixMyStreet (mySociety)

**At submit time.** In cobrands that turn on `suggest_duplicates`, a step headed "Already been reported?" appears after the reporter drops a pin and picks a category. It lists nearby reports and says "There are similar problems nearby that we're already aware of, is one of them yours?" The reporter can subscribe to one of them for updates, or press "Continue – report a new problem" ([template](https://github.com/mysociety/fixmystreet/blob/cd96011f1630272f3aecde3c461873245faac2a8/templates/web/base/report/new/duplicate_suggestions.html)). mySociety's trial write-up describes the same flow, with "read more" showing the full text and photos so the reporter can compare ([mySociety, 2019](https://www.mysociety.org/2019/04/24/stop-right-there-thats-already-been-reported/)).

**Matching rules.** Matching is purely deterministic: same category, open state and distance. The public suggestion radius defaults to **250 m**, and the inspector radius to **1,000 m** ([`nearby_distances`](https://github.com/mysociety/fixmystreet/blob/cd96011f1630272f3aecde3c461873245faac2a8/perllib/FixMyStreet/Cobrand/Default.pm#L1561-L1582), [duplicates.js](https://github.com/mysociety/fixmystreet/blob/cd96011f1630272f3aecde3c461873245faac2a8/web/js/duplicates.js#L35-L39)). At most 5 reports are shown, and the radius is capped at 1,000 m ([`_nearby_json`, `_find_distance`](https://github.com/mysociety/fixmystreet/blob/cd96011f1630272f3aecde3c461873245faac2a8/perllib/FixMyStreet/App/Controller/Report.pm#L760-L845)). Councils can set the radius per category. They can also widen the search to closed, fixed or internal reports ([SocietyWorks, 2024](https://www.societyworks.org/2024/04/02/you-can-now-customise-fixmystreet-pros-duplicate-report-radius-per-category/)).

**Nothing merges automatically.** The reporter decides at submit time. Afterwards, only staff with the `report_inspect` permission can mark a report as duplicate. They set its state to `duplicate` and either point it to the original or write a public update ([Report.pm](https://github.com/mysociety/fixmystreet/blob/cd96011f1630272f3aecde3c461873245faac2a8/perllib/FixMyStreet/App/Controller/Report.pm#L470-L532)). The original keeps a list of its duplicates ([`set_duplicate_of`](https://github.com/mysociety/fixmystreet/blob/cd96011f1630272f3aecde3c461873245faac2a8/perllib/FixMyStreet/DB/Result/Problem.pm#L1434-L1465)).

**Public display.** The duplicate stays public. Its page shows "This report is a duplicate. Please leave updates on the original report", with a link to the original, and the update form is replaced ([display.html](https://github.com/mysociety/fixmystreet/blob/cd96011f1630272f3aecde3c461873245faac2a8/templates/web/base/report/display.html#L43-L57), [duplicate-no-updates.html](https://github.com/mysociety/fixmystreet/blob/cd96011f1630272f3aecde3c461873245faac2a8/templates/web/base/report/duplicate-no-updates.html)).

**Undo.** Changing the state away from `duplicate` clears the pointer to the original. We did not confirm whether the original's list of duplicates is cleaned up as well.

**Evidence.** Neither mySociety post gives numbers. In a 2026 Keep Britain Tidy member Q&A, Brent Council said the nearby prompt "has reduced duplications but has not been measured". Blackpool said residents still re-report when they think the location differs slightly or there is more than one fly-tip ([KBT Network, May 2026](https://www.keepbritaintidy.org/sites/default/files/2026-05/Online%20Reporting%20of%20Fly-tipping%20%26%20Duplications%20May%2026.pdf)). These are anecdotal council statements.

## SeeClickFix (CivicPlus)

CivicPlus marketing says the 311 CRM can "Automatically detect duplicate requests before they are submitted" and supports "identifying and merging duplicate submissions" ([CivicPlus](https://www.civicplus.com/seeclickfix-311-crm/unified-platform/)). We found no first-party help article that describes:

- the matching criteria
- what the reporter sees
- how merging works or who can merge.

**Unverified beyond marketing.**

## Open311 GeoReport v2

The spec has no duplicate concept. Each POST creates a new `service_request_id`. The spec's only mention of duplicates is an example of a closed request with `status_notes` "Duplicate request." ([GeoReport v2](https://wiki.open311.org/GeoReport_v2/)). Systems that integrate through Open311 therefore usually show a duplicate as a closed request with a free-text note, not as a link to the original.

## City of Chicago 311 (audit evidence)

Chicago's Inspector General audited the city's 311 service request process ([OIG audit, 2026](https://igchicago.org/wp-content/uploads/2026/02/OIG-Audit-of-311-Service-Request-Process.pdf), pp. 10 and 16–20). It found:

- **Automatic coupling is narrow.** Salesforce is configured to classify requests as duplicates and combine them "based on certain parameters, such as when the addresses of multiple complaints match exactly". It "frequently fails to couple duplicate complaints", so departments end up responding to each complaint separately.
- **Manual repair has a bottleneck.** Departments can couple requests by hand, but only a limited number of staff have access to that feature. Departments often "simply close them without explanation", and some duplicates are closed with misleading outcomes. As a result, the public sees inaccurate results.
- **Residents re-report on purpose.** A common misconception is that entering the same complaint repeatedly will escalate the issue.

The audit gives no duplicate rate.

## Waze

Waze has no submit-time "is this the same?" prompt. Other drivers confirm or dismiss an existing alert instead:

- **Display time.** Reports stay on the map "for a certain amount of time" that depends on how many users respond. Tapping **Not there** shortens it ([Waze Help](https://support.google.com/waze/answer/13739290?hl=en)).
- **Confidence score.** The partner data feed gives each alert a confidence score from driver reactions: thumbs-up and comments raise it, "Not there" lowers it. Two "Not there" reports with no thumbs-up or comments remove the alert ([Waze Data Feed](https://support.google.com/waze/partners/answer/10618035?hl=en)).
- **Reliability score.** It is based on the reporter's experience level (same source).

Waze's documentation does not say whether multiple new reports of the same incident are clustered into one alert. **Undocumented.**

## Google Maps incident reports

Drivers report a crash, slowdown, police and so on during navigation. Near a reported incident, Maps asks "Is this still here?" with Yes/No buttons ([Maps Help](https://support.google.com/maps/answer/3273406?hl=en)). Google does not document how duplicate reports are combined or how the votes are weighted.

## Ushahidi

In the Uchaguzi deployment guide, checking for duplicates is a manual step in human verification. The checklist asks "Is the post a duplicate?" and tells volunteers to search for similar reports. Posts are marked Verified, Unverified or FALSE before anything is published ([Ushahidi docs](https://docs.ushahidi.com/uchaguzi-support/digital-response-teams/verification)). We found no documented merge or "related post" feature, and no rule for what happens to a confirmed duplicate. **Undocumented.**

## OpenStreetMap Notes

Anyone can open a note anonymously, and we found no documentation of a nearby-notes prompt. "Duplicate or invalid notes should also be marked as resolved". Resolving requires logging in. Resolved notes are not deleted, but they are hidden from the map after seven days ([OSM wiki: Notes](https://wiki.openstreetmap.org/wiki/Notes)). The API has a `reopen` endpoint ([API v0.6](https://wiki.openstreetmap.org/wiki/API_v0.6)).

One community bot, NeisBot, closes later notes only when a note has identical location *and* text to an earlier one ([NeisBot](https://www.openstreetmap.org/user/NeisBot)). This is a deliberately strict rule for automatic closing.

## Citizen

**Skipped.** We could not reach a first-party help centre. The only descriptions we found are third-party mirrors and press coverage, so we make no claims.

## Stack Overflow

**Who closes.** Users with 500+ reputation vote to close a question as a duplicate. Five votes are normally needed, but one vote from a moderator or a gold tag-badge holder is enough. The original generally must already have an answer ([Stack Overflow help: duplicates](https://stackoverflowteams.com/help/duplicates); the public stackoverflow.com page could not be fetched, so this is the Teams copy).

**Public display.** A closed duplicate gets "[duplicate]" in its title and a banner linking the original. It is "often … left as a signpost" rather than deleted.

**Dispute.** The asker disputes by editing the question to show the differences and then seeking a reopen vote (same source).

**Merging.** Moderators can merge accidental duplicates without losing answers. Borderline variants are deliberately kept because different wording helps search ([Stack Overflow blog, 2009](https://stackoverflow.blog/2009/04/29/handling-duplicate-questions/)).

**Asker confirmation.** In 2015 the asker was reportedly offered "That solved my problem!" to close their own question as a duplicate. The only sources we found are a Meta Stack Exchange post we could not fetch and a mirror of it. **Unverified.**

**Evidence.** A peer-reviewed MSR 2019 study found that about 53% of closed posts are closed as duplicates, and about 9% of duplicates get more views than their originals. It argued that duplicates add value ([Abric et al., MSR 2019](https://swag.uwaterloo.ca/publications/can-duplicate-questions-on-stack-overflow-benefit-the-software-development-community.html)).

## GitHub Issues

A user with write access marks a duplicate either by commenting "Duplicate of #N", which adds a timeline event, or by choosing **Close as duplicate** and picking the original, which adds a note at the top of the issue ([GitHub Docs](https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/marking-issues-or-pull-requests-as-a-duplicate), [Changelog, 2024-12-12](https://github.blog/changelog/2024-12-12-github-issues-projects-close-issue-as-a-duplicate-rest-api-for-sub-issues-and-more/)). Marking can be undone from the timeline. Both issues remain readable.

## Zendesk and Jira

**Zendesk.** Agents merge tickets. The source ticket is closed and tagged `closed_by_merge`. "Merges are permanent and can't be undone". Fields such as tags and priority are not carried over ([Zendesk: Merging tickets](https://support.zendesk.com/hc/en-us/articles/4408882445594-Merging-tickets)).

**Jira.** Jira takes the opposite approach to Zendesk: it links rather than merges. Its "duplicates / is duplicated by" link type is configurable by admins, and both issues persist ([Jira Cloud: link work items](https://support.atlassian.com/jira-software-cloud/docs/link-issues/), [Jira Server: issue linking](https://confluence.atlassian.com/adminjiraserver0818/configuring-issue-linking-1082267526.html)).

## Emergency dispatch (CAD)

We could not access NENA's standards text, including [EIDO, NENA-STA-021](https://kb.nena.org/wiki/EIDO_(Emergency_Incident_Data_Object)), so NENA's rules for duplicate or merged incidents are **unverified**. Zetron's release notes list "detect duplicate incidents" and "link incident-management records" without giving the criteria ([Zetron, 2016](https://portal.zetron.com/Portals/0/PDFs/press_releases/2016/pr_031816.pdf)).

The strongest primary evidence is An Garda Síochána's CAD review (Ireland's national police) ([briefing, June 2021](https://www.garda.ie/en/about-us/our-departments/office-of-corporate-communications/news-media/cad-review-briefing-24-june-2021.pdf)):

- **What went wrong.** Incidents were closed prematurely using CANCEL or INFO.
- **What counts as a valid closure.** "Verified duplicate (linked to another incident correctly closed)" is listed as valid.
- **The fix.** Supervisor approval became required for these closures. The overall cancellation rate then fell from 14% to 6% across 1.45M incidents.
- **The cost.** Of 3,120 cancelled domestic-violence incidents, 65% were assumed invalid.

The briefing does not break out how many invalid closures were labelled as duplicates. It shows the cost of closing an incident into another one without verification.

## Comparison

| Product | Decision at submit | Reporter prompt | Public display of possible duplicates | Merge/repair path |
|---|---|---|---|---|
| FixMyStreet | Always creates a new report unless the reporter subscribes to an existing one | "Already been reported?" list (same category, open, 250 m default, max 5) | None while only "possible". After staff marking: "This report is a duplicate", with a link | Staff with `report_inspect` set the state to duplicate; reversible by changing the state |
| SeeClickFix | Claimed pre-submit detection | Undocumented | Undocumented | Claimed merging; workflow undocumented |
| Open311 v2 | Always new | None in spec | Closed with free-text note | Outside the spec |
| Chicago 311 | Auto-couples on exact address match | Not described | Duplicates sometimes closed with misleading outcomes | Manual coupling by a few staff per department |
| Waze / Google Maps | Undocumented | None; later drivers answer "Not there" / "Is this still here?" | One alert with confidence from reactions | Reactions lower or remove the alert |
| Ushahidi (Uchaguzi) | Nothing published before human review | None | Unpublished until verified | Manual verification; outcome for duplicates undocumented |
| OSM Notes | Always new | None documented | Open until resolved | Logged-in users resolve; reopen possible; bot closes only exact location+text matches |
| Stack Overflow | Always new | Asker confirmation reported (2015), unverified | "[duplicate]" banner linking the original; kept as a signpost | Community/moderator votes; reopen votes; moderator merge |
| GitHub | Always new | None | Timeline event or "closed as duplicate" note | Write-access users; undoable |
| Zendesk | Always new | None | Requester may see the merge comment | Agents; permanent, cannot be undone |
| Jira | Always new | None | "is duplicated by" link | Users link; editable |
| CAD (Garda) | Call-taker decides | n/a | n/a | Closing as a verified duplicate; supervisor approval added after misuse |

## Nearhood implications

These are **our recommendations**, not implemented behaviour.

1. **No surveyed public reporting system auto-merges on fuzzy similarity.** Automatic merging happens only on near-exact keys: exact address in Chicago, identical location and text for NeisBot. Everything fuzzier goes either to the reporter (FixMyStreet) or to staff (GitHub, Stack Overflow, Zendesk, CAD). This supports keeping ADR 0004's rule that membership needs confirmation.

2. **The common default for an unresolved case is "publish as new, link later".** FixMyStreet, OSM Notes, GitHub, Stack Overflow and Jira all let a possible duplicate exist publicly and record duplicate status as a reversible pointer that leaves both items readable. This favours the proposal over stalling unpublished in "clarification". A Report that is never published is invisible evidence, and the Chicago audit shows that unresolved duplicates turn into silent closures.

3. **A plain "possibly related to X" flag has little direct precedent.** Every surveyed public product shows only a decided state ("duplicate of X"), never an unresolved "possibly" label. If Nearhood adds one, it is new design. It should be:
   - phrased descriptively, e.g. "Another report nearby may describe the same situation", without a score
   - inspectable, linking both evidence sets
   - kept separate from membership, so nothing from X enters this Happening's Shared Account.

4. **Findings that argue against the proposal or constrain it:**
   - **Split pins.** Publishing as new creates the split pins that the guardrails warn against ("should not create independent pins merely because their wording differs"). It also creates readers who see two partial accounts.
   - **Repair must be real.** Chicago and Garda show that a later repair path is only safe if it is actually exercised, by people who have both access and accountability. Narrow access led to unrepaired duplicates in Chicago, and unchecked closures led to lost incidents at the Garda.
   - **So the proposal needs #6's repair path.** That means authorized rematching, preserved history, and recomputing both accounts. Without it, "possibly related" is likely to persist indefinitely.

5. **Use the radius as a strength-of-signal cue.** FixMyStreet's public suggestion radius (250 m) is far smaller than Nearhood's 1,500 m candidate search. A wide search is fine for retrieval. A "possibly related" flag, or any prompt shown to the contributor, could be restricted to candidates that are both closer and semantically "unknown".

6. **Keep the reporter's choice cheap and specific.** FixMyStreet shows concrete nearby items with photos and text, plus a clear way to continue. That matches ADR 0004's "show evidence, don't ask whether it's new". The alternative is for the contributor's clarification to be optional and not block publication.

7. **Later Observations are a natural repair signal.** Waze and Google Maps resolve "is this still the same thing?" through later observers. A later Report that confidently matches one of the two Happenings could prompt a merge review instead of relying only on the original contributor.

## Gaps and unverified claims

- No primary source gives a measured duplicate rate or a missed-versus-wrong-merge trade-off for civic reporting. Brent's "reduced duplications" claim is explicitly unmeasured, and Chicago's audit gives no rate. The only quantitative duplicate figures we found are from Stack Overflow (MSR 2019) and Garda cancellations, and the Garda figures do not isolate duplicates.
- SeeClickFix duplicate behaviour is known only from marketing. Citizen was skipped. NENA EIDO duplicate and merge semantics were not accessed.
- Waze's clustering of multiple new reports, and Google Maps' vote weighting and duplicate handling, are undocumented.
- Stack Overflow's asker-confirm feature (2015) is unverified, and we did not confirm it is still current. The help-page details come from the Stack Overflow Teams copy.
- FixMyStreet: we did not confirm whether clearing a duplicate also removes it from the original's list of duplicates. Cobrand overrides of `nearby_distances` and `suggest_duplicates` vary by council.
- Ushahidi: the documentation describes manual duplicate checks but not what happens to confirmed duplicates.
