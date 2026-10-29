# Uncertain match handling: source notes

Accessed **2026-10-29**. Supporting research for a draft proposal: when a new Report cannot be clearly matched to a nearby Happening, publish it as its own Happening with a visible "possible link", instead of holding it unpublished in `clarification`. Related: [ADR 0004](../adr/0004-confirm-matches-before-membership.md), [ADR 0005](../adr/0005-separate-extraction-from-matching.md), [ADR 0007](../adr/0007-happening-identity-follows-the-situation.md), [#6](https://github.com/Pcworker996/nebius-hack/issues/6) (clarify ambiguous matching, repair wrong membership), [#20](https://github.com/Pcworker996/nebius-hack/issues/20) (waiting Reports stall), and the earlier [duplicate report handling notes](duplicate-report-handling.md). These notes summarize sources. The Nearhood sections are our recommendation, not implemented behaviour.

Several sources are PDFs whose text we extracted locally; quotes from them are marked with the section or rule number where one exists. Claims we could not read in the primary text are marked **unverified**.

## Record linkage: three-way decisions

**Fellegi–Sunter rule.** As restated by the Census Bureau's Winkler, the rule has three outcomes. Above an upper threshold a pair is a match. Between the thresholds it is "a possible match and hold for clerical review". Below the lower threshold it is a nonmatch. "The cutoff thresholds … are determined by a priori error bounds on false matches and false nonmatches." The middle band "is referred to as the no-decision region or clerical review region. In some situations, resources are available to review pairs clerically" ([Winkler, Census RRS2006-02, §3.1, rule (2)](https://census.gov/content/dam/Census/library/working-papers/2006/adrm/rrs2006-02.pdf)). We could not read the text of the original paper (Fellegi and Sunter, *JASA* 64, 1969, pp. 1183–1210); the copies we found are image scans. Its claim that the optimal rule minimizes the possible-link band for fixed error bounds is **unverified** here.

**Possible matches are held, not published as decided.** In this framework the middle band is a pending state awaiting review. It is neither treated as a match nor as a non-match.

**Error rates are hard to know without labels.** Winkler says "the general problem of error rate estimation is very difficult." Labelled pairs used for estimation are "typically … concentrated in the clerical review region", and fewer than 0.5% labelled pairs drawn from that region were enough for semi-supervised estimation in one method (same source, §3.5, §4.1). For a maintained register, "undetected duplication may increase by 1% or more per year" if it is not maintained effectively (§4.13).

**Thresholds follow goals.** Splink calls threshold choice "a key decision point". It frames the choice as capturing "all possible matches (i.e. high recall)" against minimizing "incorrectly predicted matches (i.e. high precision)". It recommends labelled data, or spot checks of real pairs when labels are absent ([Splink: edge evaluation overview](https://moj-analytical-services.github.io/splink/topic_guides/evaluation/edge_overview.html)). It defines a false positive as a predicted match between two records that "are actually a non-match", and gets ground truth from "Clerical Labelling (i.e. labels created by a human)" ([Splink: edge metrics](https://moj-analytical-services.github.io/splink/topic_guides/evaluation/edge_metrics.html)).

**Senzing keeps "possibly same" entities separate and linked.** Its principles decide whether an inbound record is "the same as, possibly the same as, or possibly related to the candidate". Possibly-same entities "stay separate: they scored below the resolution threshold, though they may still be related". An "ambiguous match" is when "a record could legitimately belong to more than one entity". Senzing also "re-evaluates earlier assertions and makes adjustments automatically" as new data arrives ([Senzing: ER processes](https://senzing.com/er-processes)). The page describes no human review step.

**Wikidata models an uncertain sameness claim as data.** Property P460 "said to be the same as" means "this item is said to be the same as that item, though this may be uncertain or disputed" ([P460](https://www.wikidata.org/wiki/Property:P460)). P1889 "different from" records an "item that is different from another item, with which it may be confused" ([P1889](https://www.wikidata.org/wiki/Property:P1889)). Before merging, editors must be "absolutely certain" the items are the same. When in doubt the surviving item is the one "with the lowest Q####, as it will be the older item". The merged item becomes a redirect: "Never reuse merged items for other things." A merge is undone by restoring the pre-merge revisions of both items ([Help:Merge](https://www.wikidata.org/wiki/Help:Merge)).

**MDM unmerge.** Reltio stewards review potential matches with two choices, "Merge" or "Not a Match" ([Reltio: reviewing potential matches](https://docs.reltio.com/en/explore/get-your-bearings-in-reltio/workflow/workflow-use-cases/reviewing-potential-matches)). Its API lists "Unmerge Entity by Contributor URI" and related operations ([Reltio: merge and unmerge API](https://docs.reltio.com/en/developer-resources/entity-management-apis/entity-management-apis-at-a-glance/merge-and-unmerge-entities-api)). In Informatica MDM, unmerging a parent record does not unmerge its child records unless "cascade unmerge" is enabled per child object ([Informatica 10.4: cascade unmerge](https://docs.informatica.com/master-data-management/multidomain-mdm/10-4/configuration-guide/part-4--configuring-the-data-flow/configuring-the-consolidate-process/consolidation-settings/unmerge-child-when-parent-unmerges--cascade-unmerge-.html)). The detailed Reltio unmerge pages and the Informatica page returned 404/403 to our fetcher, so the unmerge semantics come from search excerpts and are **unverified** beyond the operation names.

## LLM-based entity matching

**LLMs are capable matchers, but prompts do not transfer.** Peeters, Steiner and Bizer find that "there is no single best prompt but that the prompt needs to be tuned for each model/dataset combination". LLM matchers show "higher robustness to unseen entities" than fine-tuned PLMs, and GPT-4 "can generate structured explanations for matching decisions" ([Peeters et al., EDBT 2025, arXiv:2310.11244](https://arxiv.org/abs/2310.11244)).

**Pairwise, compare and select strategies differ.** Wang et al. compare three strategies. *Matching* "independently classifies each pair of records". *Comparing* asks which of two candidates "is more consistent with" the anchor record. *Selecting* "directly selects the match" from a list (§3.2–3.4). Selecting wins because it incorporates record interactions, but "current LLMs suffer from position bias, with the selection accuracy varying significantly" as the true match moves down the list (§3.4, §4.3). Their ComEM method first ranks and filters candidates with a pairwise matcher, then selects among the top few; experiments "kept the top 4 candidates for selection" (§3.5, §4.1). Some chat LLMs "produce numerous false positives" with the independent matching strategy (§4.4) ([Wang et al., COLING 2025, arXiv:2405.16884](https://arxiv.org/html/2405.16884)).

**Long and distracting inputs hurt.** Performance "is often highest when relevant information occurs at the beginning or end of the input context" ([Liu et al., TACL, arXiv:2307.03172](https://arxiv.org/abs/2307.03172)). Model performance "is dramatically decreased when irrelevant information is included". Telling the model to ignore irrelevant information, and self-consistency decoding, help ([Shi et al., ICML 2023, arXiv:2302.00093](https://arxiv.org/abs/2302.00093)). LLM judges show "position, verbosity, and self-enhancement biases" ([Zheng et al., NeurIPS 2023, arXiv:2306.05685](https://arxiv.org/abs/2306.05685)).

**Citations do not guarantee grounding.** Even the best models evaluated "lack complete citation support 50% of the time" on ELI5 ([Gao et al., EMNLP 2023, arXiv:2305.14627](https://arxiv.org/abs/2305.14627)). A valid evidence ID is therefore not proof that the reason compares the right things.

**Abstention is a separate capability.** A survey frames abstention, "the refusal of large language models (LLMs) to provide an answer", as needing its own methods, benchmarks and metrics ([Wen et al., TACL, arXiv:2407.18418](https://arxiv.org/abs/2407.18418)). We read only the abstract. Its specific findings on calibration are **unverified** here.

We found no primary study that measures whether "reason before label" ordering improves entity-matching labels. That remains a hypothesis for Nearhood to test.

## Event detection and dedup in news and crisis data

**TDT treats new-event detection as a cost trade-off.** All TDT tasks "are cast as detection tasks", scored by a detection cost `C_Det = C_Miss·P_Miss·P_target + C_FA·P_FA·P_non-target`. For the 1998 TDT2 evaluation, "the cost of miss and false alarm were set equal to each other (C_Miss = C_FA = 1)", with priors set per task. Systems output a score per decision, so thresholds can be varied after the fact to draw a Detection Error Tradeoff curve. The topic detection task allowed a decision deferral of 1, 10 or 100 source files, and longer deferral gave "a small improvement" of about 7% relative ([Fiscus et al., Eurospeech 1999](https://www.isca-archive.org/eurospeech_1999/fiscus99_eurospeech.pdf)). Later TDT years are often said to have used `C_FA = 0.1` and `P_target = 0.02`; we could not retrieve those evaluation plans, so those values are **unverified**. Allan, Lavrenko and Jin's "First Story Detection in TDT Is Hard" (CIKM 2000, DOI 10.1145/354756.354843) is the standard reference on the difficulty of new-event detection. Its PDF text was not machine-readable, so its specific findings are **unverified** here.

**GDELT links many mentions to one event and keeps a per-mention confidence.** GDELT 2.0 adds "a new Mentions table that records all mentions of each event". An event mentioned in 100 articles is listed 100 times there, and each mention has a `Confidence` field: "Percent confidence in the extraction of this event from this article". The event-level `NumMentions` and `NumSources` "refer only to the first news report … and [are] not updated" ([GDELT Event Codebook V2.0](http://data.gdeltproject.org/documentation/GDELT-Event_Codebook-V2.0.pdf)). We found no documented later merge or split of GDELT events. **Undocumented.**

**Crisis mapping.** Ushahidi's Uchaguzi guide makes the duplicate check a manual human-verification step before publishing; see [duplicate report handling](duplicate-report-handling.md#ushahidi). We found no primary documentation of a "possibly same event" state or of event split/merge in crisis-mapping tools.

## Nearhood evidence

All figures come from the **v4** prompt and synthetic, agent-authored development cases. Nothing here is held-out or independently reviewed ([live matching record](../reviews/2026-10-27-issue-4-live-matching.md), [case review](../reviews/2026-10-28-issue-4-matching-case-review.md)).

**Overall.** 122/144 trials passed the automated model assertions; 128/144 software-derived recommendations matched expectation. In 447 candidate assessments there were **zero same↔separate swaps**:

| Expected | Actual same | Actual separate | Actual unknown | Invalid |
| --- | --- | --- | --- | --- |
| same (99) | 90 | 0 | 9 | 0 |
| separate (303) | 0 | 246 | 57 | 0 |
| unknown (45) | 3 | 0 | 40 | 2 |

So almost every v4 error was an *unknown*, not a confident wrong answer. There were 66 unnecessary unknowns among 402 answerable assessments, and 57 of them were P03's 19 distractors × 3 runs.

**Unsafe errors (old rule).** The only unsafe errors were U04's three false `same`. The case review found that all three reasons "compare the candidate's two evidence items with each other and never mention the new Report" ([case review, finding 2](../reviews/2026-10-28-issue-4-matching-case-review.md#findings-that-cut-across-cases)). Under ADR 0007, U04's expected label becomes `same`, so these outputs are now correct answers reached for the wrong reason.

**Other causes of `unknown`.** These are not "wrong pair" errors:

- **The prompt tells the model to abstain.** T02 and D03 (3/3 each) see the disagreement correctly and abstain. The production prompt still says "disagreement or lack of proof of continuity alone calls for unknown" and "use continuity=unknown when evidence cannot distinguish occurrences" ([`src/lib/report-model.ts`](../../src/lib/report-model.ts), `compareReport`). That is occurrence wording that ADR 0007 replaces.
- **The label contradicts the reason.** P03's reasons call the distractors "unrelated" while the labels say `unknown`. The schema puts `continuity` before `reason`. The case design is also confounded by bridge-themed padding.
- **Grounding errors.** A04 (3/3), A02-remove-identity and P01-remove-identity reasons say "same time" when the times differ. 41 reasons hit the 320-character cap.

**What v4 behaviour would do under the draft.** This is our projection from archived outputs, relabelled per the [identity proposal table](../proposals/happening-identity-recurrence.md#implementation-boundaries). It is not a new run.

- **Single-candidate expected-`same` Reports answered `unknown`:** S03, T02, D03, U01, U01-duplicate-source, U02 and U03, which is 7 cases and 21 trials. Today they go to `clarification`, where the contributor can pick the Happening; [state tests](../reviews/2026-10-27-issue-4-matching-states.md) verify this for T02. Under "no same, some unknown → publish new", **each would create a duplicate Happening with a possible link.** T02 is a partial reopening, the [V1 demo's core step](../product-guardrails.md#v1-demonstration-priority).
- **P03** (1 `same` + 19 `unknown`) goes to `clarification` today because any second plausible candidate blocks a suggestion (`plausible.length > 1` in `compareReport`). A rule that suggests the single `same` and lists the unknowns as alternatives would turn it into a correct `match_review`.
- **A03 and the remove-identity variants** are expected `unknown` because the Report could be either of two or more existing Happenings. Publishing new would create a third pin that is certainly a duplicate of one of them.
- **Distance and order.** The reversed-order variants (A01-reverse, P02-reverse), the target in position 20, and the target at 1,400 m with a distractor at 1 m (A01-distance) all passed 3/3. Position or distance bias was not observed in this small set.

**Coverage and budget facts (code).**

- Retrieval takes up to 20 Happenings within 1,500 m. For each Happening it sends evidence from 3 Reports: the first submitted, then those nearest in observation time ([`src/lib/report-matching.ts`](../../src/lib/report-matching.ts)).
- Any Happening with 4 or more Reports, or a pool of more than 20, marks coverage incomplete. Incomplete coverage blocks create-new (`coverageIncomplete`, and a 409 on `create_new`).
- The evidence-ID enum in the schema contains only *candidate* Observation IDs, so a reason cannot structurally cite the new Report.
- The largest v4 packet was 57,331 of 65,536 bytes, so raising the per-candidate cap is not free.

**Stalling is real.** [#20](https://github.com/Pcworker996/nebius-hack/issues/20) records that `match_review` and `clarification` wait only on the contributor. No endpoint lists a contributor's Reports, and a contributor who loses the URL cannot return. The cost of the current design is a stranded, invisible Report, not just a delay.

## Implications for the draft proposal

Our recommendations. **Supported** = keep as drafted; **Change** = keep the intent, revise; **Contradicted** = evidence or accepted ADRs argue against it as drafted.

### Step 0: fix grading

**Supported, with changes.** U04 shows reasons that compare the wrong pair (case review finding 2), and Gao et al. show that valid citations do not ensure support. But the draft's diagnosis is too narrow. "Judges internal consistency" fits U04 only. T02 and D03 abstain because the prompt tells them to, and P03's label contradicts its own reason. Revisions:

1. Replace the occurrence wording in the prompt with ADR 0007's label meanings, including "disagreement is `same` + `conflict`". This alone targets T02 and D03.
2. Put the reason before the label (v6 R2), and require the reason to name the new Report's observation and the candidate evidence it compares. Add the new Report's extraction observation keys to the citation schema so software can check that both sides are cited. The second half of this is new.
3. Evaluate a decomposed design against the current single listwise call on the same cases: a pairwise grade of the Report against one candidate at a time, then a select step among the few non-`separate` candidates, as in Wang et al.'s ComEM. Pairwise grading removes the other candidates' evidence that U04 and P03 confused (cf. Shi et al.). The cost is up to 20 calls against [ADR 0005](../adr/0005-separate-extraction-from-matching.md)'s "one provider stage per processing request"; measure it before adopting it.
4. "Evaluate on reviewed cases" is right, but no held-out set or independent label review exists yet. Add the case review's fixture changes: non-"unrelated" distractors, and the P03 and U04 isolating variants. Report the same↔separate swap count as the safety metric (ADR 0007).

### Step 1: decision rules

| Rule | Verdict | Reason and revision |
| --- | --- | --- |
| Exactly 1 `same` → suggest; contributor confirms | **Change** | Supported in principle (ADR 0004; Fellegi–Sunter match region). As coded, any extra `unknown` candidate blocks the suggestion (P03). Say explicitly: 1 `same` plus any number of `unknown` → suggest the `same`, list up to four `unknown` as alternatives (ADR 0005), and do not treat unshown unknowns as rejected. |
| 2+ `same` → ask | **Supported** | A04; Senzing's "ambiguous match". Also record a possible link *between the two existing Happenings*, because 2+ `same` is evidence of an existing duplicate and is input to #6. |
| No `same`, some `unknown` → publish new with possible links | **Contradicted as a default** | v4 would have split 7 expected-`same` cases (21 trials), including the demo's partial reopening (T02). For A03-type cases, a new pin is a certain duplicate. Fellegi–Sunter and Census practice *hold* the possible band for review. This rule also overturns accepted text: ADR 0004 ("Uncertainty leaves the Report unassigned and asks a focused question"), ADR 0005 ("uncertainty … is not evidence of no match"), ADR 0007 ("Matching still asks the contributor when it can't tell which Happening") and the guardrails ("Keep the agreed targeted clarification"). **Revision:** keep asking, but make it non-blocking and explicit. Show the `unknown` candidates with evidence, plus a choice such as "Publish as its own Happening". That choice publishes new and records an open possible link (FixMyStreet's "Continue – report a new problem" pattern). What happens when the contributor never answers (#20) stays a separate product decision. If automatic publish-new is still wanted, limit it to a single `unknown` whose reason says the Report may be about a different problem. Never apply it when 2+ `unknown` candidates describe the same kind of problem. Either way it needs an ADR superseding the lines quoted above. |
| Evidence omitted (cap of 3 Reports), no `same` → publish new, noting incomplete check | **Change** | ADR 0005: "A truncated pool … is not evidence of no match." But today's rule blocks create-new near *any* Happening with 4 or more Reports, which over-blocks as Happenings grow. Make coverage per candidate. Omission matters only for a candidate graded `unknown`, or one graded `separate` whose omitted Reports were not represented by the first Report and the nearest-in-time Reports. Keep pool truncation (more than 20 Happenings) as blocking, because unseen Happenings were never graded. Distinguish the two reasons in the stored coverage and in the wording. Revise ADR 0005 for this. |
| All `separate` / no candidates → publish new | **Supported** | Current behaviour; v4 had 0 expected-`same` → `separate`. |
| Multiple situations → unassigned | **Supported** | ADR 0005; unchanged. |

### Step 2: possible-link record

**Supported, with changes.** Senzing keeps possibly-same entities separate with a relationship, Wikidata stores P460 and P1889 as data, and Jira links rather than merges ([duplicate notes](duplicate-report-handling.md#zendesk-and-jira)). All of these support a record outside membership. Revisions:

- Link Happening↔Happening, not only new↔candidate, so the 2+ `same` case can use it.
- Record the source of the link (`model`, `contributor`, later Report), the matching run and snapshot fingerprint, the cited evidence on **both** sides, and the reason.
- Add `superseded` for when a merge makes the link moot.
- Make `confirmed_different` sticky like P1889, so later matching does not reopen it without new evidence.
- Keep the link out of `observation_memberships` and out of account synthesis (ADR 0001).

### Step 3: display

**Supported, with one change.** P460 is a public precedent for showing an unresolved "said to be the same, uncertain or disputed" claim. The earlier note's statement that there is "little direct precedent" should be softened accordingly. Keep it unscored, as the guardrails require ("Do not display fake numerical precision"). The wording should say *why* the link exists ("the system could not tell whether these describe the same lamp") and show both evidence sets. The optional "add your Report there?" prompt is supported (FixMyStreet). It must remain an ADR 0004 confirmation, never one-tap membership without showing evidence.

### Step 4: repair

**Supported, but under-specified.** Revisions:

- Use Wikidata's merge semantics. The older Happening survives. An emptied Happening becomes a **redirect**, not a deleted or reused ID. Both versions of each account history stay inspectable.
- Undo must restore both Happenings. Informatica's per-child "cascade unmerge" shows that moving children (Observations) is a separate, explicit choice.
- "Move the contributor's own Observations" only repairs a new Happening that no one else has joined. If other Reports have joined either side, repair needs an actor other than the contributor. Otherwise the split persists, which is the Chicago and Garda pattern ([duplicate notes](duplicate-report-handling.md#city-of-chicago-311-audit-evidence)).

### Undecided items

- **Flag radius.** *Evidence leans one way.* Let the semantic grade decide whether to show a link, not distance. A01-distance (correct target at 1,400 m) passed 3/3, so a 250 m cut would have hidden it. Use distance only to order and phrase links ("40 m away"). FixMyStreet's 250 m is a deterministic *retrieval* radius for category-only matching, not a semantic flag.
- **Who resolves links.** *Undecided.* Clerical staff resolve links in Census practice, the system re-evaluates automatically in Senzing, and Waze relies on later observers. Recommendation: the contributor can move only their own Report. A later Report graded `same` to both linked Happenings should prompt *its* contributor and flag the link for review. Merging two Happenings needs a steward role that does not exist yet (#6).
- **Merge survivor ID.** *Evidence supports:* the older Happening survives, the other becomes a redirect, and IDs are never reused (Wikidata).
- **Map display of flagged pins.** *Undecided; no primary source found.* Two linked pins at nearly the same coordinates hit the open marker-overlap bug [#17](https://github.com/Pcworker996/nebius-hack/issues/17). Resolve #17 first, or draw the link visibly (shared cluster or connector) so a reader cannot miss it.
- **Demo without repair.** *Evidence against shipping auto-publish-new without repair.* Winkler warns that unmaintained registers accumulate duplication, and Chicago shows that unrepaired duplicates persist. Acceptable for the demo: the non-blocking clarification above, the link record, and a "these are different" dismissal. Not acceptable: an automatic split of the demo's partial-reopening Report.

## Gaps and unverified claims

- The text of the original Fellegi–Sunter paper was not read; we rely on Winkler's restatement. The optimality claim is unverified.
- TDT `C_FA = 0.1` / `P_target = 0.02` for later years and the findings of Allan et al. (CIKM 2000) are unverified. We found no TDT or GDELT documentation of later event merges or splits.
- Reltio and Informatica unmerge details come from search excerpts; the pages returned 403/404 to us.
- No primary source found shows that "reason before label" or required two-sided citation improves LLM matching labels. Nearhood must test this.
- Nearhood figures are from v4, synthetic, agent-labelled development cases without held-out or independent review. The projections under ADR 0007 labels and the draft's rules are recounts of archived outputs, not new runs. v6 may change the rate of `unknown` substantially.
- We found no primary source on map display of "possibly same" items, and no measured duplicate or wrong-merge rates for civic reporting (see [duplicate report handling gaps](duplicate-report-handling.md#gaps-and-unverified-claims)).
