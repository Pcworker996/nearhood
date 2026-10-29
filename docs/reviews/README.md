# Verification and review records

These are **historical, revision-specific records**. A passing run establishes evidence for the stated commit and environment; it does not establish current branch health, live-provider success, or deployment status. Use [GitHub issues](https://github.com/Pcworker996/nebius-hack/issues) for current acceptance and blockers.

| Record                                                                      | Scope                                                                                                                   |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [2026-10-28 — Matching case review, v4 (#4)](2026-10-28-issue-4-matching-case-review.md) | Agent review of all 48 v4 matching cases: label soundness, model correctness, case-design weaknesses, proposed fixture changes. Not an independent sign-off. |
| [2026-10-27 — Report states after matching (#4)](2026-10-27-issue-4-matching-states.md) | Real API/PostgreSQL verification of publication, review, clarification, pending, confirmation and retry from recorded matching responses. |
| [2026-10-27 — Live matching, v4 (#4)](2026-10-27-issue-4-live-matching.md) | Matching-only development evaluation: 48 packets × 3, automated failures, grounding concerns, and complete raw artifacts. |
| [2026-10-27 — Live extraction, v7 (#4)](2026-10-27-issue-4-live-extraction.md) | Provisional live run of 33 development cases × 3: failures, gates, labels still unreviewed. |
| [2026-10-23 — Acceptance audit (#4)](2026-10-23-issue-4-acceptance-audit.md) | Per-criterion audit of the staged workflow, defects, and the four-level verification plan. |
| [2026-10-19 — Report submission (#4)](2026-10-19-issue-4-implementation.md) | Earlier durable submission implementation, standards/spec review, controlled-service checks, and remaining live checks. |
| [2026-10-08 — Browsing (#3)](2026-10-08-issue-3-implementation.md)          | Browsing, persistence, evidence inspection, responsive UI, and verification limits.                                     |

For current Report contracts and setup, use [Report submission](../implementation/report-submission.md). For evaluation methodology, use the [agent architecture and evaluation guide](../guides/agent-architecture-and-evaluation.md).

New records should identify the issue, reviewed baseline/commit, environment, commands and results, outstanding limitations, and whether providers were live or controlled. Keep one record per meaningful checkpoint; link it from the issue rather than replacing task status with a second checklist.

[Documentation index](../README.md)
