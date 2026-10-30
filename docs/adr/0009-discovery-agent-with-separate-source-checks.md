---
status: accepted
date: 2026-10-30
---

# Discovery is a bounded read-only agent; Source checks are stored apart from evidence

Report processing is a fixed sequence of model stages ([ADR 0005](0005-separate-extraction-from-matching.md)), and the V1 demonstration ticket excluded external research and unnecessary agents ([#16](https://github.com/Pcworker996/nebius-hack/issues/16)). For Discovery ([#13](https://github.com/Pcworker996/nebius-hack/issues/13)) we chose an adaptive agent instead: the next useful lookup depends on what the reader asked and what the evidence already read shows, and the agent cannot change Reports, membership or Shared Accounts. It may also run a Source check on its own initiative, because outside notices are where disagreement with neighbours' Reports becomes visible.

Source: grilling session with the product owner, Maoyuan Wang, on 2026-10-29/30. Terms: **Discovery**, **Source check**, **Reported cause** and **Suggestion** in [CONTEXT.md](../../CONTEXT.md).

## Decision

- **Read-only, bounded loop.** Nemotron chooses among deterministic tools (search stored Happenings, open one Happening's evidence, expand the search area once, run a Source check) within fixed step, tool, time and size budgets. Exhausting a budget returns only what was already validated.
- **Results are stored Happenings.** Software keeps a result, claim or cited Observation only if this run's tool output returned it; card text for claims comes from the database. No area-wide synthesis across Happenings.
- **Causes are reported or unknown.** A cause appears only when a Report or Source check finding states it, attributed and with its qualifications.
- **Suggestions cite Observations** and never establish that a place or route is safe, passable or to be avoided.
- **Source checks are their own records.** Each belongs to one Happening, records its query, time, findings and the Shared Account version it was compared against, and is shown under "Outside sources — not Nearhood evidence". It never adds claims, supports, membership or corroboration. A check newer than 24 hours and compared against the current account version is reused; otherwise the agent may check again. At most two per request; the agent writes the query, and software rejects contributor names and copied Report text.
- **Spending is capped** per visitor and per day, so a public demo cannot exhaust model or search credits.

## Consequences

- #16's exclusion of external research no longer holds for Source checks; its other exclusions stand.
- A stale comparison label is possible between a new account version and the next check; the display names the account time it was compared against.
- Model judgement is evaluated through live cases (grounding, unreported cause, Source check conflict, empty area, prompt injection), separately from product tests that verify the software rules.
- Not implemented as of this record.

## Alternatives

- **Fixed discovery pipeline** (search, then one answer call): simpler, but cannot decide to read further evidence or check outside sources based on what it found.
- **Web results inside Discovery:** rejected because readers could not tell neighbour evidence from outside claims, and results without stored location break the map.
- **Model-suggested causes, labelled as speculation:** rejected; the label does not stop readers treating a plausible cause as fact.
- **Per-request Source checks:** rejected because readers would see different outside findings for one Happening and repeated searches would spend credits during judging.
