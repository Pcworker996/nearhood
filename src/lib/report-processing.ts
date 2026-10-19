import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { database } from "./database";
import type {
  MatchCandidate,
  MatchRecommendation,
  SavedReport,
} from "./happenings";
import { nearbyCandidates } from "./report-matching";
import { extractReport, type Extraction } from "./report-model";
import { savedReport, SubmissionError } from "./report-submission";

type MatchChoice =
  | { choice: "match"; candidateId: string; candidateIdsShown: string[] }
  | { choice: "create_new"; candidateIdsShown: string[] };

export async function processReport(
  id: string,
  contributorId: string,
  refresh = false,
) {
  const report = await savedReport(id, contributorId);
  if (
    report.state === "published" ||
    ((report.state === "match_review" || report.state === "clarification") &&
      !refresh)
  )
    return report;

  const attempt = randomUUID();
  const lease = await database().query(
    `UPDATE nearhood.report_processing SET state='processing', attempt=$3,
      lease_until=now()+interval '60 seconds'
    WHERE report_id=$1 AND contributor_id=$2 AND (
      state IN ('saved','pending') OR
      (state='processing' AND lease_until < now()) OR
      ($4::boolean AND state IN ('match_review','clarification'))
    ) RETURNING report_id`,
    [id, contributorId, attempt, refresh],
  );
  if (!lease.rowCount) return savedReport(id, contributorId);

  try {
    const candidates = await nearbyCandidates({
      lat: report.lat,
      lng: report.lng,
      observedAt: report.observedAt,
      candidateHint: report.candidateId,
    });
    const { extraction, matching, model } = await extractReport({
      originalText: report.originalText,
      observedAt: report.observedAt,
      locationName: report.locationName,
      lat: report.lat,
      lng: report.lng,
      provenance: report.provenance,
      sourceUrl: report.sourceUrl,
      candidateHint: report.candidateId,
      candidates,
    });
    if (!extraction.sameOccurrence) {
      await storeReview({
        id,
        attempt,
        candidates,
        matching: null,
        extraction,
        model,
        state: "clarification",
      });
      return savedReport(id, contributorId);
    }
    if (matching.kind === "match") {
      await storeReview({
        id,
        attempt,
        candidates,
        matching,
        extraction,
        model,
        state: "match_review",
      });
      return savedReport(id, contributorId);
    }
    if (matching.kind === "uncertain") {
      await storeReview({
        id,
        attempt,
        candidates,
        matching,
        extraction,
        model,
        state: "clarification",
      });
      return savedReport(id, contributorId);
    }

    const recorded = await database().query(
      `UPDATE nearhood.report_processing SET candidate_ids=$3::text[],
        candidate_packet=$4::jsonb, recommendation=$5::jsonb,
        extraction=$6::jsonb, matching_outcome='create_new',
        decision_source='model_no_match', decision_actor=NULL,
        decision_candidate_ids=ARRAY[]::text[], decision_at=now(),
        model_id=$7
      WHERE report_id=$1 AND attempt=$2 AND state='processing' RETURNING report_id`,
      [
        id,
        attempt,
        candidates.map((candidate) => candidate.id),
        JSON.stringify(candidates),
        JSON.stringify(matching),
        JSON.stringify(extraction),
        model,
      ],
    );
    if (!recorded.rowCount) return savedReport(id, contributorId);
    await publishForAttempt({ id, attempt, report, extraction, model });
  } catch {
    // Preserve the original Report and any successful no-match decision. A
    // failed search/model call never becomes evidence that no candidate exists.
    await database().query(
      `UPDATE nearhood.report_processing SET state='pending', attempt=NULL, lease_until=NULL
      WHERE report_id=$1 AND attempt=$2 AND state='processing'`,
      [id, attempt],
    );
  }
  return savedReport(id, contributorId);
}

async function storeReview(input: {
  id: string;
  attempt: string;
  candidates: MatchCandidate[];
  matching: MatchRecommendation | null;
  extraction: Extraction;
  model: string;
  state: "match_review" | "clarification";
}) {
  const { rowCount } = await database().query(
    `UPDATE nearhood.report_processing SET state=$3, attempt=NULL, lease_until=NULL,
      candidate_ids=$4::text[], candidate_packet=$5::jsonb, recommendation=$6::jsonb,
      extraction=$7::jsonb, matching_outcome=NULL, decision_source=NULL,
      decision_actor=NULL, decision_candidate_ids=ARRAY[]::text[], decision_at=NULL,
      happening_id=NULL, model_id=$8
    WHERE report_id=$1 AND attempt=$2 AND state='processing'`,
    [
      input.id,
      input.attempt,
      input.state,
      input.candidates.map((candidate) => candidate.id),
      JSON.stringify(input.candidates),
      input.matching ? JSON.stringify(input.matching) : null,
      JSON.stringify(input.extraction),
      input.model,
    ],
  );
  if (!rowCount) throw Error("Report processing attempt was superseded");
}

async function publishForAttempt(input: {
  id: string;
  attempt: string;
  report: SavedReport;
  extraction: Extraction;
  model: string;
}) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT report_id FROM nearhood.report_processing
      WHERE report_id=$1 AND attempt=$2 AND state='processing' AND lease_until > now()
      FOR UPDATE`,
      [input.id, input.attempt],
    );
    if (!locked.rowCount) {
      await client.query("ROLLBACK");
      return;
    }
    await publishEvidence(client, {
      report: input.report,
      extraction: input.extraction,
      happeningId: input.id,
      createHappening: true,
    });
    await client.query(
      `UPDATE nearhood.report_processing SET state='published', happening_id=$3,
        attempt=NULL, lease_until=NULL, model_id=$4
      WHERE report_id=$1 AND attempt=$2`,
      [input.id, input.attempt, input.id, input.model],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmReportMatch(
  id: string,
  contributorId: string,
  choice: MatchChoice,
) {
  const report = await savedReport(id, contributorId);
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      state: string;
      candidate_ids: string[];
      extraction: Extraction | null;
      model_id: string | null;
      matching_outcome: "matched" | "create_new" | null;
      decision_source: string | null;
      happening_id: string | null;
      recommendation: MatchRecommendation | null;
    }>(
      `SELECT state, candidate_ids, extraction, model_id,
        matching_outcome, decision_source, happening_id,
        recommendation
      FROM nearhood.report_processing WHERE report_id=$1 AND contributor_id=$2
      FOR UPDATE`,
      [id, contributorId],
    );
    const processing = rows[0];
    if (!processing) throw new SubmissionError("Report not found.", 404);

    if (processing.state === "published") {
      const sameChoice =
        (choice.choice === "match" &&
          processing.matching_outcome === "matched" &&
          processing.happening_id === choice.candidateId) ||
        (choice.choice === "create_new" &&
          processing.matching_outcome === "create_new" &&
          processing.decision_source === "contributor_rejected_candidates");
      if (!sameChoice)
        throw new SubmissionError(
          "This Report already has a different published matching decision.",
          409,
        );
      await client.query("COMMIT");
      return savedReport(id, contributorId);
    }
    if (
      !(["match_review", "clarification"] as string[]).includes(
        processing.state,
      )
    )
      throw new SubmissionError("Matching suggestions are not ready yet.", 409);
    if (!processing.extraction || !processing.model_id)
      throw new SubmissionError(
        "Matching suggestions need to be refreshed.",
        409,
      );
    if (
      processing.state === "match_review" &&
      processing.recommendation?.kind !== "match"
    )
      throw new SubmissionError(
        "Matching suggestions need to be refreshed.",
        409,
      );
    if (
      processing.state === "clarification" &&
      (!processing.extraction.sameOccurrence ||
        processing.recommendation?.kind !== "uncertain")
    )
      throw new SubmissionError(
        "This Report cannot be assigned until its described occurrence is clear.",
        409,
      );
    if (
      choice.choice === "match" &&
      (!processing.candidate_ids.includes(choice.candidateId) ||
        !choice.candidateIdsShown.includes(choice.candidateId))
    )
      throw new SubmissionError(
        "Choose a Happening from the saved nearby suggestions.",
      );
    if (
      choice.candidateIdsShown.length < 1 ||
      choice.candidateIdsShown.length > processing.candidate_ids.length ||
      new Set(choice.candidateIdsShown).size !==
        choice.candidateIdsShown.length ||
      choice.candidateIdsShown.some(
        (candidateId) => !processing.candidate_ids.includes(candidateId),
      )
    )
      throw new SubmissionError(
        "Refresh the nearby suggestions before deciding.",
      );

    const currentCandidates = await client.query<{ id: string }>(
      "SELECT id FROM nearhood.happenings WHERE id=ANY($1::text[])",
      [processing.candidate_ids],
    );
    if (currentCandidates.rowCount !== processing.candidate_ids.length)
      throw new SubmissionError(
        "Nearby Happenings changed. Refresh the suggestions before deciding.",
        409,
      );

    const happeningId =
      choice.choice === "match" ? choice.candidateId : report.id;
    await publishEvidence(client, {
      report,
      extraction: processing.extraction,
      happeningId,
      createHappening: choice.choice === "create_new",
    });
    await client.query(
      `UPDATE nearhood.report_processing SET state='published', happening_id=$3,
        matching_outcome=$4, decision_source=$5, decision_actor=$6,
        decision_candidate_ids=$7::text[], decision_at=now(), attempt=NULL, lease_until=NULL
      WHERE report_id=$1 AND contributor_id=$2`,
      [
        id,
        contributorId,
        happeningId,
        choice.choice === "match" ? "matched" : "create_new",
        choice.choice === "match"
          ? "contributor_confirmed"
          : "contributor_rejected_candidates",
        contributorId,
        choice.candidateIdsShown,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return savedReport(id, contributorId);
}

async function publishEvidence(
  client: PoolClient,
  input: {
    report: SavedReport;
    extraction: Extraction;
    happeningId: string;
    createHappening: boolean;
  },
) {
  const { report, extraction, happeningId } = input;
  if (input.createHappening) {
    await client.query(
      `INSERT INTO nearhood.happenings(id,title,category,location_name,location)
      VALUES ($1,$2,$3,$4,
        extensions.ST_SetSRID(extensions.ST_MakePoint($5,$6),4326)::extensions.geography)`,
      [
        happeningId,
        `Report near ${report.locationName}`,
        extraction.category,
        report.locationName,
        report.lng,
        report.lat,
      ],
    );
  } else {
    const happening = await client.query(
      "SELECT id FROM nearhood.happenings WHERE id=$1 FOR UPDATE",
      [happeningId],
    );
    if (!happening.rowCount)
      throw new SubmissionError(
        "This Happening is no longer available. Refresh nearby suggestions.",
        409,
      );
  }

  const observationIds = new Map<string, string>();
  for (const observation of extraction.observations) {
    const observationId = randomUUID();
    observationIds.set(observation.key, observationId);
    await client.query(
      `INSERT INTO nearhood.observations
        (id,report_id,subject,described_state,spatial_scope,observed_at)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        observationId,
        report.id,
        observation.subject,
        observation.excerpt,
        observation.spatialScope,
        report.observedAt,
      ],
    );
    await client.query(
      "INSERT INTO nearhood.observation_memberships(happening_id,observation_id) VALUES ($1,$2)",
      [happeningId, observationId],
    );
  }

  let previousAccount: {
    id: string;
    version: number;
    uncertainty: string[];
  } | null = null;
  if (!input.createHappening) {
    const account = await client.query<{
      id: string;
      version: number;
      uncertainty: string[];
    }>(
      `SELECT id, version, uncertainty FROM nearhood.shared_accounts
      WHERE happening_id=$1 ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [happeningId],
    );
    previousAccount = account.rows[0] ?? null;
  }

  const accountId = randomUUID();
  const version = (previousAccount?.version ?? 0) + 1;
  const uncertainty = new Set(
    (
      previousAccount?.uncertainty ?? [
        "One contributor's account; not independently verified.",
        "Unobserved conditions and extent remain unknown.",
      ]
    ).filter(
      (item) =>
        item !== "One contributor's account; not independently verified.",
    ),
  );
  if (previousAccount)
    uncertainty.add(
      "This account remains provisional; Reports do not independently verify one another.",
    );
  if (!report.observedAt)
    uncertainty.add(
      "Observation time is unknown; this Report does not establish current conditions.",
    );
  if (report.provenance === "source_based")
    uncertainty.add(
      "Contributor-cited information; the app has not checked the source.",
    );
  await client.query(
    `INSERT INTO nearhood.shared_accounts
      (id,happening_id,version,published_at,origin,uncertainty)
    VALUES ($1,$2,$3,now(),'model_derived',$4)`,
    [accountId, happeningId, version, [...uncertainty]],
  );

  let nextPosition = 1;
  if (previousAccount) {
    const { rows: previousClaims } = await client.query<{
      id: string;
      statement: string;
      position: number;
    }>(
      `SELECT id, statement, position FROM nearhood.claims
      WHERE account_id=$1 ORDER BY position, id`,
      [previousAccount.id],
    );
    const { rows: previousSupports } = await client.query<{
      claim_id: string;
      observation_id: string;
    }>(
      `SELECT s.claim_id, s.observation_id FROM nearhood.claim_supports s
      JOIN nearhood.claims c ON c.id=s.claim_id WHERE c.account_id=$1`,
      [previousAccount.id],
    );
    const claimIds = new Map<string, string>();
    for (const claim of previousClaims) {
      const claimId = randomUUID();
      claimIds.set(claim.id, claimId);
      nextPosition = Math.max(nextPosition, claim.position + 1);
      await client.query(
        "INSERT INTO nearhood.claims(id,account_id,statement,position) VALUES ($1,$2,$3,$4)",
        [claimId, accountId, claim.statement, claim.position],
      );
    }
    for (const support of previousSupports) {
      const claimId = claimIds.get(support.claim_id);
      if (claimId)
        await client.query(
          "INSERT INTO nearhood.claim_supports(claim_id,observation_id) VALUES ($1,$2)",
          [claimId, support.observation_id],
        );
    }
  }

  for (const claim of extraction.claims) {
    const claimId = randomUUID();
    await client.query(
      "INSERT INTO nearhood.claims(id,account_id,statement,position) VALUES ($1,$2,$3,$4)",
      [claimId, accountId, claim.statement, nextPosition++],
    );
    for (const key of claim.observationKeys) {
      const observationId = observationIds.get(key);
      if (!observationId)
        throw Error("Model returned an unknown Observation key");
      await client.query(
        "INSERT INTO nearhood.claim_supports(claim_id,observation_id) VALUES ($1,$2)",
        [claimId, observationId],
      );
    }
  }
}
