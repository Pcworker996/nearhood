# Architecture decision records

ADRs explain significant, lasting engineering choices and their consequences. They complement [GitHub issues](https://github.com/Pcworker996/nebius-hack/issues), which own requirements and task status, and [CONTEXT.md](../../CONTEXT.md), which owns domain terminology.

| Record                                            | Decision                                                                                                                                          | Status                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [0001](0001-preserve-evidence-separately.md)      | Preserve original evidence separately from derived accounts.                                                                                      | Accepted; browsing slice implemented.                                                              |
| [0002](0002-server-owned-persistence.md)          | Serve the web app and HTTP API with server-owned PostgreSQL/PostGIS access.                                                                       | Accepted; browsing slice deployed.                                                                 |
| [0003](0003-test-through-the-product-boundary.md) | Use browser journeys with real API/persistence as the main behavioral testing boundary.                                                           | Accepted; browsing coverage implemented.                                                           |
| [0004](0004-confirm-matches-before-membership.md) | Keep retrieval deterministic, use the model to rank supplied evidence, and require contributor confirmation before joining an existing Happening. | Accepted; local implementation and controlled-service checks pass; live verification remains open. |

These records were captured retrospectively on October 16, 2026 from the agreed spec and existing implementation. Their date is the recording date, not a claim that the decisions were first made that day. Alternatives describe the tradeoffs; they do not imply a separate historical evaluation occurred.

Create the next numbered ADR when a consequential choice needs an explanation: context, decision, rationale, consequences, source issue, and implementation status. Distinguish accepted direction from shipped behavior. When replacing a decision, retain the old record and link it to its successor.

Daily progress and reflection belong in the [engineering journal](../journal/README.md). An ADR is not a daily task list.
