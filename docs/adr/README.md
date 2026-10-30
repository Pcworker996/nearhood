# Architecture decision records

ADRs explain significant, lasting engineering choices and their consequences. They complement [GitHub issues](https://github.com/Pcworker996/nebius-hack/issues), which own requirements and task status, and [CONTEXT.md](../../CONTEXT.md), which owns domain terminology.

| Record                                            | Decision                                                                                                  | Status                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [0001](0001-preserve-evidence-separately.md)      | Preserve original evidence separately from derived accounts.                                              | Accepted; browsing slice implemented.                                               |
| [0002](0002-server-owned-persistence.md)          | Serve the web app and HTTP API with server-owned PostgreSQL/PostGIS access.                               | Accepted; browsing slice deployed.                                                  |
| [0003](0003-test-through-the-product-boundary.md) | Use browser journeys with real API/persistence as the main behavioral testing boundary.                   | Accepted; browsing coverage implemented.                                            |
| [0004](0004-confirm-matches-before-membership.md) | Keep retrieval deterministic and require contributor confirmation before joining an existing Happening.   | Accepted confirmation boundary; retrieval/call design partially superseded by 0005. |
| [0005](0005-separate-extraction-from-matching.md) | Separate extraction and matching into resumable model stages; compare a larger pool before review.        | Accepted October 21; implementation and evaluation outstanding.                     |
| [0006](0006-lease-processing-stages.md)           | Lease each processing stage with an expiring attempt token so retries cannot duplicate or overwrite work. | Accepted; implemented locally in #4, hosted timing unverified.                      |
| [0007](0007-happening-identity-follows-the-situation.md) | A Happening is one problem at one place followed over time; unknown history does not separate Happenings. | Accepted October 28; not implemented. Q1/Q2 decided October 29.                     |
| [0008](0008-uncertain-matches-publish-with-connections.md) | Uncertain matches never block a Report; possible duplicates are shown as attributed connections. | Accepted October 29; not implemented. |
| [0009](0009-discovery-agent-with-separate-source-checks.md) | Discovery is a bounded read-only agent; Source checks are stored apart from evidence. | Accepted October 30; not implemented. |

Records 0001–0003 were captured retrospectively on October 16, 2026 from the agreed spec and existing implementation. Record 0004 documents the October 19 matching revision. Record 0006 was captured retrospectively on October 26 from the implemented processing contract. Recording dates do not claim that all decisions were first made that day. Alternatives describe the tradeoffs; they do not imply a separate historical evaluation occurred.

Create the next numbered ADR when a consequential choice needs an explanation: context, decision, rationale, consequences, source issue, and implementation status. Distinguish accepted direction from shipped behavior. When replacing a decision, retain the old record and link it to its successor.

Daily progress and reflection belong in the [engineering journal](../journal/README.md). An ADR is not a daily task list.
