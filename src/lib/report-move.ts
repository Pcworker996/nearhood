import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { database } from "./database";
import { connectionUncertainty } from "./happening-connections";
import { PUBLICATION_LOCK, SINGLE_CONTRIBUTOR } from "./report-processing";
import { savedReport, SubmissionError } from "./report-submission";

// A new version built from the Happening's current members: earlier claims keep
// only supports still present, and arriving Observations add their own claims.
async function rebuildAccount(
  client: PoolClient,
  happeningId: string,
  arriving: string[],
  dropUncertainty: string[],
) {
  const members = (
    await client.query<{ observation_id: string }>(
      "SELECT observation_id FROM nearhood.observation_memberships WHERE happening_id=$1",
      [happeningId],
    )
  ).rows.map((r) => r.observation_id);
  const { rows: accounts } = await client.query<{
    id: string;
    version: number;
    uncertainty: string[];
  }>(
    `SELECT id, version, uncertainty FROM nearhood.shared_accounts
    WHERE happening_id=$1 ORDER BY version DESC LIMIT 1 FOR UPDATE`,
    [happeningId],
  );
  const previous = accounts[0];
  const contributors = await client.query<{ count: number }>(
    `SELECT COUNT(DISTINCT r.contributor_id)::int AS count
    FROM nearhood.observation_memberships m JOIN nearhood.observations o ON o.id=m.observation_id
    JOIN nearhood.reports r ON r.id=o.report_id WHERE m.happening_id=$1`,
    [happeningId],
  );
  const uncertainty = [
    ...(contributors.rows[0].count === 1 ? [SINGLE_CONTRIBUTOR] : []),
    ...(previous?.uncertainty ?? []).filter(
      (item) => item !== SINGLE_CONTRIBUTOR && !dropUncertainty.includes(item),
    ),
  ];
  const accountId = randomUUID();
  await client.query(
    `INSERT INTO nearhood.shared_accounts(id,happening_id,version,published_at,origin,uncertainty)
    VALUES ($1,$2,$3,now(),'membership_change',$4)`,
    [accountId, happeningId, (previous?.version ?? 0) + 1, uncertainty],
  );
  const supported = new Set<string>();
  let position = 1;
  if (previous) {
    const { rows: claims } = await client.query<{
      id: string;
      statement: string;
      position: number;
      supports: string[];
    }>(
      `SELECT c.id, c.statement, c.position,
        array_agg(s.observation_id) FILTER (WHERE s.observation_id IS NOT NULL) AS supports
      FROM nearhood.claims c LEFT JOIN nearhood.claim_supports s ON s.claim_id=c.id
      WHERE c.account_id=$1 GROUP BY c.id ORDER BY c.position, c.id`,
      [previous.id],
    );
    for (const claim of claims) {
      const kept = (claim.supports ?? []).filter((id) => members.includes(id));
      if (!kept.length) continue;
      const claimId = randomUUID();
      await client.query(
        "INSERT INTO nearhood.claims(id,account_id,statement,position) VALUES ($1,$2,$3,$4)",
        [claimId, accountId, claim.statement, claim.position],
      );
      for (const observationId of kept) {
        supported.add(observationId);
        await client.query(
          "INSERT INTO nearhood.claim_supports(claim_id,observation_id) VALUES ($1,$2)",
          [claimId, observationId],
        );
      }
      position = Math.max(position, claim.position + 1);
    }
  }
  const { rows: incoming } = await client.query<{
    id: string;
    subject: string;
    spatial_scope: string | null;
    described_state: string | null;
  }>(
    `SELECT id, subject, spatial_scope, described_state FROM nearhood.observations
    WHERE id=ANY($1::text[]) AND described_state IS NOT NULL ORDER BY id`,
    [arriving],
  );
  for (const observation of incoming) {
    if (supported.has(observation.id) || !members.includes(observation.id))
      continue;
    const claimId = randomUUID();
    await client.query(
      "INSERT INTO nearhood.claims(id,account_id,statement,position) VALUES ($1,$2,$3,$4)",
      [
        claimId,
        accountId,
        `${observation.subject}${observation.spatial_scope ? ` (${observation.spatial_scope})` : ""}: ${observation.described_state}`,
        position++,
      ],
    );
    await client.query(
      "INSERT INTO nearhood.claim_supports(claim_id,observation_id) VALUES ($1,$2)",
      [claimId, observation.id],
    );
  }
}

// Only a Report's own contributor moves it, and only to a Happening it is
// connected with, or back into one it emptied (ADR 0008).
export async function moveReport(
  reportId: string,
  contributorId: string,
  toHappeningId: string,
) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [PUBLICATION_LOCK]);
    const { rows } = await client.query<{ state: string; happening_id: string | null }>(
      `SELECT state, happening_id FROM nearhood.report_processing
      WHERE report_id=$1 AND contributor_id=$2 FOR UPDATE`,
      [reportId, contributorId],
    );
    const from = rows[0]?.happening_id;
    if (!rows[0]) throw new SubmissionError("Report not found.", 404);
    if (rows[0].state !== "published" || !from)
      throw new SubmissionError("Only a published Report can be moved.", 409);
    if (from === toHappeningId) {
      await client.query("COMMIT");
      return savedReport(reportId, contributorId);
    }
    const [low, high] = [from, toHappeningId].sort();
    const allowed = await client.query(
      `SELECT 1 FROM nearhood.happenings h WHERE h.id=$2 AND (
        h.redirect_to=$1 OR (h.redirect_to IS NULL AND EXISTS (
          SELECT 1 FROM nearhood.happening_connections hc
          JOIN nearhood.connection_statements s ON s.connection_id=hc.id
          WHERE hc.happening_low=$3 AND hc.happening_high=$4 AND hc.superseded_at IS NULL
            AND s.kind IN ('possibly_same','unsure'))))`,
      [from, toHappeningId, low, high],
    );
    if (!allowed.rowCount)
      throw new SubmissionError(
        "Your Report can only move to a Happening shown as possibly connected.",
        409,
      );
    const { rows: happenings } = await client.query<{ id: string; title: string }>(
      "SELECT id, title FROM nearhood.happenings WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",
      [[from, toHappeningId]],
    );
    const title = (id: string) => happenings.find((h) => h.id === id)!.title;
    const moving = (
      await client.query<{ observation_id: string }>(
        `UPDATE nearhood.observation_memberships m SET happening_id=$3
        FROM nearhood.observations o
        WHERE o.id=m.observation_id AND o.report_id=$1 AND m.happening_id=$2
        RETURNING m.observation_id`,
        [reportId, from, toHappeningId],
      )
    ).rows.map((r) => r.observation_id);
    await client.query(
      `INSERT INTO nearhood.membership_changes(id,report_id,from_happening_id,to_happening_id,actor_id)
      VALUES ($1,$2,$3,$4,$5)`,
      [randomUUID(), reportId, from, toHappeningId, contributorId],
    );
    await client.query(
      "UPDATE nearhood.report_processing SET happening_id=$2 WHERE report_id=$1",
      [reportId, toHappeningId],
    );
    // Moving back restores a Happening this Report's move emptied.
    await client.query(
      `UPDATE nearhood.happening_connections SET superseded_at=NULL
      WHERE happening_low=$1 AND happening_high=$2 AND superseded_at IS NOT NULL
        AND (SELECT redirect_to FROM nearhood.happenings WHERE id=$3)=$4`,
      [low, high, toHappeningId, from],
    );
    await client.query(
      "UPDATE nearhood.happenings SET redirect_to=NULL WHERE id=$1",
      [toHappeningId],
    );
    const remaining = await client.query(
      "SELECT 1 FROM nearhood.observation_memberships WHERE happening_id=$1 LIMIT 1",
      [from],
    );
    if (remaining.rowCount) {
      await rebuildAccount(client, from, [], []);
      await rebuildAccount(client, toHappeningId, moving, []);
    } else {
      await client.query(
        "UPDATE nearhood.happenings SET redirect_to=$2 WHERE id=$1",
        [from, toHappeningId],
      );
      await client.query(
        `UPDATE nearhood.happening_connections SET superseded_at=now()
        WHERE happening_low=$1 AND happening_high=$2`,
        [low, high],
      );
      await rebuildAccount(client, toHappeningId, moving, [
        connectionUncertainty(title(from)),
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return savedReport(reportId, contributorId);
}
