import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { database } from "./database";
import type { Connection, MatchChoice } from "./happenings";
import { effectiveGrade, type CandidateAssessment } from "./report-model";

type Coverage = { omittedEvidence?: Record<string, number> };

export const connectionUncertainty = (title: string) =>
  `Another Happening nearby may describe the same situation: ${title}. Not confirmed.`;

const displayed = async (client: PoolClient, id: string) =>
  !!(
    await client.query(
      `SELECT 1 FROM nearhood.happening_connections hc
      JOIN nearhood.connection_statements s ON s.connection_id=hc.id
      WHERE hc.id=$1 AND hc.superseded_at IS NULL
        AND s.kind IN ('possibly_same','unsure') LIMIT 1`,
      [id],
    )
  ).rowCount;

// A new version that copies the latest claims and appends one uncertainty item.
async function addUncertainty(client: PoolClient, happeningId: string, item: string) {
  const { rows } = await client.query<{ id: string; version: number; uncertainty: string[] }>(
    `SELECT id, version, uncertainty FROM nearhood.shared_accounts
    WHERE happening_id=$1 ORDER BY version DESC LIMIT 1 FOR UPDATE`,
    [happeningId],
  );
  const previous = rows[0];
  if (!previous || previous.uncertainty.includes(item)) return;
  const accountId = randomUUID();
  await client.query(
    `INSERT INTO nearhood.shared_accounts(id,happening_id,version,published_at,origin,uncertainty)
    VALUES ($1,$2,$3,now(),'connection_update',$4)`,
    [accountId, happeningId, previous.version + 1, [...previous.uncertainty, item]],
  );
  const claims = await client.query<{ id: string; statement: string; position: number }>(
    "SELECT id, statement, position FROM nearhood.claims WHERE account_id=$1",
    [previous.id],
  );
  for (const claim of claims.rows) {
    const claimId = randomUUID();
    await client.query(
      "INSERT INTO nearhood.claims(id,account_id,statement,position) VALUES ($1,$2,$3,$4)",
      [claimId, accountId, claim.statement, claim.position],
    );
    await client.query(
      `INSERT INTO nearhood.claim_supports(claim_id,observation_id)
      SELECT $1, observation_id FROM nearhood.claim_supports WHERE claim_id=$2`,
      [claimId, claim.id],
    );
  }
}

// Connections are stored once per unordered pair (ADR 0008).
async function connectionId(client: PoolClient, a: string, b: string) {
  const [low, high] = [a, b].sort();
  await client.query(
    `INSERT INTO nearhood.happening_connections(id,happening_low,happening_high)
    VALUES ($1,$2,$3) ON CONFLICT (happening_low,happening_high) DO NOTHING`,
    [randomUUID(), low, high],
  );
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM nearhood.happening_connections
    WHERE happening_low=$1 AND happening_high=$2`,
    [low, high],
  );
  return rows[0].id;
}

type Statement = {
  between: [string, string];
  source: "automatic_matching" | "contributor";
  kind: "possibly_same" | "unsure" | "different";
  evidenceIds: string[];
  partialEvidence: boolean;
  reason: string | null;
};

// Writes the statements a Report's publication produces, inside its transaction.
export async function recordConnections(
  client: PoolClient,
  input: {
    reportId: string;
    contributorId: string;
    happeningId: string;
    reportObservationIds: string[];
    assessments: CandidateAssessment[];
    coverage: Coverage;
    matchingVersion: string | null;
    snapshotFingerprint: string | null;
    answer: MatchChoice["choice"] | null;
  },
) {
  const partial = (...ids: string[]) =>
    ids.some((id) => (input.coverage.omittedEvidence?.[id] ?? 0) > 0);
  const possible = input.assessments.filter(
    (a) =>
      effectiveGrade(a) !== "separate" && a.candidateId !== input.happeningId,
  );
  const same = input.assessments.filter((a) => effectiveGrade(a) === "same");
  const statements: Statement[] = possible.map((a) => ({
    between: [input.happeningId, a.candidateId],
    source: "automatic_matching",
    kind: "possibly_same",
    evidenceIds: [...input.reportObservationIds, ...a.evidenceIds],
    partialEvidence: partial(a.candidateId),
    reason: a.reason,
  }));
  // One Report fitting two Happenings suggests they may duplicate each other.
  for (const [i, a] of same.entries())
    for (const b of same.slice(i + 1))
      if (a.candidateId !== input.happeningId && b.candidateId !== input.happeningId)
        statements.push({
          between: [a.candidateId, b.candidateId],
          source: "automatic_matching",
          kind: "possibly_same",
          evidenceIds: [...a.evidenceIds, ...b.evidenceIds],
          partialEvidence: partial(a.candidateId, b.candidateId),
          reason: null,
        });
  const answered =
    input.answer === "unsure"
      ? possible.filter((a) => effectiveGrade(a) === "unknown")
      : input.answer === "create_new"
        ? possible
        : [];
  for (const a of answered)
    statements.push({
      between: [input.happeningId, a.candidateId],
      source: "contributor",
      kind: input.answer === "unsure" ? "unsure" : "different",
      evidenceIds: input.reportObservationIds,
      partialEvidence: false,
      reason: null,
    });

  const appeared = new Set<string>();
  for (const s of statements) {
    const automatic = s.source === "automatic_matching";
    const connection = await connectionId(client, ...s.between);
    const wasDisplayed = await displayed(client, connection);
    await client.query(
      `INSERT INTO nearhood.connection_statements
        (id,connection_id,source,kind,report_id,contributor_id,matching_version,
         snapshot_fingerprint,evidence_ids,partial_evidence,reason)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10,$11)
      ON CONFLICT (connection_id,report_id,source,kind) DO NOTHING`,
      [
        randomUUID(),
        connection,
        s.source,
        s.kind,
        input.reportId,
        automatic ? null : input.contributorId,
        automatic ? input.matchingVersion : null,
        automatic ? input.snapshotFingerprint : null,
        s.evidenceIds,
        s.partialEvidence,
        automatic ? s.reason : null,
      ],
    );
    if (!wasDisplayed && (await displayed(client, connection)))
      appeared.add(s.between.slice().sort().join("\n"));
  }
  // The account history records when each connection first appeared.
  for (const pair of appeared) {
    const ids = pair.split("\n");
    const { rows } = await client.query<{ id: string; title: string }>(
      "SELECT id, title FROM nearhood.happenings WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",
      [ids],
    );
    const title = (id: string) => rows.find((r) => r.id === id)!.title;
    await addUncertainty(client, ids[0], connectionUncertainty(title(ids[1])));
    await addUncertainty(client, ids[1], connectionUncertainty(title(ids[0])));
  }
}

// Displayed connections: someone suggested the pair may be the same situation.
export async function connectionsFor(happeningId: string): Promise<Connection[]> {
  const { rows } = await database().query<{
    happeningId: string;
    title: string;
    source: Connection["statements"][number]["source"];
    kind: Connection["statements"][number]["kind"];
    reportId: string;
    displayName: string | null;
    createdAt: string;
    reason: string | null;
    evidenceIds: string[];
    partialEvidence: boolean;
  }>(
    `SELECT other.id AS "happeningId", other.title, s.source, s.kind,
      s.report_id AS "reportId", c.display_name AS "displayName",
      s.created_at AS "createdAt", s.reason, s.evidence_ids AS "evidenceIds",
      s.partial_evidence AS "partialEvidence"
    FROM nearhood.happening_connections hc
    JOIN nearhood.happenings other ON other.id =
      CASE WHEN hc.happening_low=$1 THEN hc.happening_high ELSE hc.happening_low END
    JOIN nearhood.connection_statements s ON s.connection_id=hc.id
    LEFT JOIN nearhood.contributors c ON c.id=s.contributor_id
    WHERE $1 IN (hc.happening_low, hc.happening_high) AND hc.superseded_at IS NULL
      AND other.redirect_to IS NULL
      AND EXISTS (SELECT 1 FROM nearhood.connection_statements suggested
        WHERE suggested.connection_id=hc.id AND suggested.kind IN ('possibly_same','unsure'))
    ORDER BY other.id, s.created_at, s.source, s.id`,
    [happeningId],
  );
  const byHappening = new Map<string, Connection>();
  for (const { happeningId: id, title, ...statement } of rows) {
    const connection = byHappening.get(id) ?? { happeningId: id, title, statements: [] };
    connection.statements.push(statement);
    byHappening.set(id, connection);
  }
  return [...byHappening.values()];
}
