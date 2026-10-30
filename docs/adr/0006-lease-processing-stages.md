---
status: accepted
date: 2026-10-26
---

# Lease each processing stage with an expiring attempt token

[ADR 0005](0005-separate-extraction-from-matching.md) runs extraction and matching as separate provider stages, outside database transactions, with up to 25 seconds per provider call. While a call is in flight the same Report can receive a duplicate `POST /api/reports/:id/process` (double submit, client retry), the request can die (route timeout, dropped connection), or a stalled request can return after a retry has already finished. Without coordination these cause duplicate provider work and publications, Reports stuck in `processing` forever, or obsolete results overwriting newer ones.

Each stage therefore claims a lease on the Report's `nearhood.report_processing` row: an atomic update that sets `state='processing'`, a random `attempt` token and `lease_until = now() + 60 seconds`. The lease is decided from the stored row only; callers cannot supply a stage.

Sources: [ticket #4](../issues/4.md), the [processing contract](../implementation/report-processing-stages.md) and [ADR 0005](0005-separate-extraction-from-matching.md). Recorded retrospectively from the implemented contract.

## Decision and responsibilities

- A lease can be acquired only when the row is `saved` or `pending`, is `processing` with an expired lease, or is in `match_review`/`clarification` and either a refresh was requested or its extraction checkpoint no longer matches the Report. A concurrent request acquires nothing and returns the saved state without calling a provider.
- The acquired stage is `matching` when a compatible extraction checkpoint exists (same extraction version and input), otherwise `extraction`. A row whose extraction or matching version is newer than the running deployment's is never leased, so an older deployment cannot overwrite it.
- Checkpoint and result writes require the owned attempt and an unexpired lease (`attempt=$2 AND lease_until > now()`). A request whose lease expired or was taken over writes nothing; its work is discarded rather than published. Failure records require the owned attempt, so a stale request cannot mark a newer attempt as failed.
- One provider stage runs per request. Successful writes clear `attempt` and `lease_until`, except when a no-match continues straight into publication under the same attempt.
- An expired lease makes the Report retryable by the next `process` request without manual intervention. `GET` never acquires a lease or advances processing.

## Consequences

- Duplicate or concurrent `process` requests cannot duplicate provider work for one Report, and an interrupted request delays a retry by at most the lease duration.
- The lease must outlast one stage. It matches the 60-second route `maxDuration`, and a stage makes a single 25-second provider call plus short database work. Raising the provider timeout or adding provider calls to a stage requires revisiting the lease, or a still-running stage can be taken over and its result discarded.
- The lease coordinates processing of one Report only. Publication across Reports (two Reports creating or joining the same nearby Happening) is serialized separately by the transaction-scoped advisory lock and snapshot revalidation described in the processing contract.
- `NEARHOOD_LEASE_SECONDS` and `NEARHOOD_MODEL_TIMEOUT_MS` override the defaults for tests; they are not tuned production values.

The alternatives were holding a database transaction or row lock across the provider call, which ties up connections for the full call and loses the work if the connection drops, or a plain `processing` flag without expiry, which leaves interrupted Reports stuck. A queue or workflow engine would add hosting and operational dependencies this milestone does not need.

## Implementation and verification status

[`acquireLease` and the stage writes](../../src/lib/report-processing.ts) implement this. [`scripts/report-lease.test.ts`](../../scripts/report-lease.test.ts) checks acquisition for each state, expiry, version and refresh combination against a real PostgreSQL database. On October 26 the local gates (`npm run verify`) passed on the #4 working tree, including the lease test and 82 browser tests. Lease timing under hosted Vercel limits and live provider latency is not yet verified.
