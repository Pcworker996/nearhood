import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { database } from "./database";
import type {
  MatchChoice,
  MatchRecommendation,
  SavedReport,
} from "./happenings";
import { recordConnections } from "./happening-connections";
import { nearbyCandidates, type CandidateSearch } from "./report-matching";
import {
  extractReportInfo,
  compareReport,
  coverageIncomplete,
  isPlausible,
  COVERAGE_LIMIT_MESSAGE,
  EvidenceBudgetError,
  EXTRACTION_REVISION,
  EXTRACTION_VERSION,
  LEASE_SECONDS,
  MATCHING_REVISION,
  MATCHING_VERSION,
  RejectedOutputError,
  extractionInput,
  type Extraction,
  type CandidateAssessment,
  type ReportContext,
} from "./report-model";
import {
  REVIEW_SET_SIZE,
  reviewSet,
  savedReport,
  SubmissionError,
} from "./report-submission";

type Stage = SavedReport["processingStage"];
type SubmittedReport = ReportContext &
  Pick<SavedReport, "id" | "candidateId" | "submittedAt">;

// Serializes publications that read and change nearby Happenings.
export const PUBLICATION_LOCK = 70420261022;
export const SINGLE_CONTRIBUTOR =
  "One contributor's account; not independently verified.";

const candidateSearch = (report: SubmittedReport) => ({
  lat: report.lat,
  lng: report.lng,
  observedAt: report.observedAt,
  candidateHint: report.candidateId,
});
const occurrenceReason = (extraction: Extraction) =>
  extraction.occurrence === "multiple"
    ? "separate_occurrences"
    : "unclear_occurrence";

// Every lease decision reads the locked row; callers cannot supply a stage.
export async function acquireLease(input: {
  id: string;
  contributorId: string;
  attempt: string;
  refresh: boolean;
  extractionInput: string;
}): Promise<Stage | null> {
  const compatible = `(extraction_version=$5 AND extraction_input=$6) IS TRUE`;
  const { rows } = await database().query<{ processing_stage: Stage }>(
    `UPDATE nearhood.report_processing SET state='processing', attempt=$3,
      processing_stage=CASE WHEN ${compatible} THEN 'matching' ELSE 'extraction' END,
      pending_reason=NULL, lease_until=now()+make_interval(secs => $8)
    WHERE report_id=$1 AND contributor_id=$2 AND (
      state IN ('saved','pending') OR (state='processing' AND lease_until < now()) OR
      (state IN ('match_review','clarification') AND ($4::boolean OR NOT ${compatible}))
    ) AND NOT COALESCE(substring(extraction_version FROM '-v([0-9]+)$')::numeric > $7, false)
      AND NOT COALESCE(substring(matching_version FROM '-v([0-9]+)$')::numeric > $9, false)
    RETURNING processing_stage`,
    [
      input.id,
      input.contributorId,
      input.attempt,
      input.refresh,
      EXTRACTION_VERSION,
      input.extractionInput,
      EXTRACTION_REVISION,
      LEASE_SECONDS,
      MATCHING_REVISION,
    ],
  );
  return rows[0]?.processing_stage ?? null;
}

export async function processReport(
  id: string,
  contributorId: string,
  refresh = false,
) {
  const report: SubmittedReport = await savedReport(id, contributorId);
  const attempt = randomUUID();
  const stage = await acquireLease({
    id,
    contributorId,
    attempt,
    refresh,
    extractionInput: extractionInput(report),
  });
  if (!stage) return savedReport(id, contributorId);
  try {
    if (stage === "extraction") {
      const { extraction, run } = await extractReportInfo(report);
      await database().query(
        `UPDATE nearhood.report_processing SET state=$3, processing_stage='matching',
          extraction=$4::jsonb, extraction_version=$5, extraction_input=$6, extraction_model=$7,
          stage_runs=jsonb_build_object('extraction',$8::jsonb), pending_reason=$9,
          candidate_ids=ARRAY[]::text[], candidate_packet='[]'::jsonb,
          offered_candidate_ids=ARRAY[]::text[], recommendation=NULL,
          assessments='[]'::jsonb, coverage='{}'::jsonb, snapshot_fingerprint=NULL, matching_version=NULL,
          matching_outcome=NULL, decision_source=NULL, decision_actor=NULL, decision_at=NULL,
          decision_candidate_ids=ARRAY[]::text[], attempt=NULL, lease_until=NULL
        WHERE report_id=$1 AND attempt=$2 AND state='processing' AND lease_until > now()`,
        [
          id,
          attempt,
          extraction.sameOccurrence ? "saved" : "clarification",
          JSON.stringify(extraction),
          EXTRACTION_VERSION,
          extractionInput(report),
          run.model,
          JSON.stringify(run),
          extraction.sameOccurrence ? null : occurrenceReason(extraction),
        ],
      );
    } else {
      const checkpoint = await database().query<{
        extraction: Extraction;
        extraction_model: string;
      }>(
        `SELECT extraction, extraction_model FROM nearhood.report_processing
        WHERE report_id=$1 AND attempt=$2 AND extraction_version=$3 AND extraction_input=$4`,
        [id, attempt, EXTRACTION_VERSION, extractionInput(report)],
      );
      const extracted = checkpoint.rows[0];
      if (!extracted) throw Error("Extraction checkpoint changed");
      if (!extracted.extraction.sameOccurrence) {
        await database().query(
          `UPDATE nearhood.report_processing SET state='clarification',
          pending_reason=$3, attempt=NULL, lease_until=NULL WHERE report_id=$1 AND attempt=$2 AND lease_until>now()`,
          [id, attempt, occurrenceReason(extracted.extraction)],
        );
        return savedReport(id, contributorId);
      }
      const search = await nearbyCandidates(candidateSearch(report));
      const snapshot = await database().query(
        `UPDATE nearhood.report_processing SET candidate_ids=$3::text[],
        candidate_packet=$4::jsonb, coverage=$5::jsonb, snapshot_fingerprint=$6,
        offered_candidate_ids=ARRAY[]::text[], recommendation=NULL, assessments='[]'::jsonb, matching_version=NULL,
        matching_outcome=NULL, decision_source=NULL, decision_actor=NULL, decision_at=NULL
        WHERE report_id=$1 AND attempt=$2 AND state='processing' AND lease_until>now() RETURNING report_id`,
        [
          id,
          attempt,
          search.candidates.map((c) => c.id),
          JSON.stringify(search.candidates),
          JSON.stringify(search.coverage),
          search.fingerprint,
        ],
      );
      if (!snapshot.rowCount) return savedReport(id, contributorId);
      const result = await compareReport(
        report,
        extracted.extraction,
        search.candidates,
        search.coverage,
      );
      const state =
        result.matching.kind === "match"
          ? "match_review"
          : result.matching.kind === "uncertain"
            ? "clarification"
            : "processing";
      const recorded = await database().query(
        `UPDATE nearhood.report_processing SET state=$3, candidate_ids=$4::text[], candidate_packet=$5::jsonb,
          recommendation=$6::jsonb, assessments=$7::jsonb, coverage=$8::jsonb, snapshot_fingerprint=$9,
          matching_version=$10, stage_runs=stage_runs || jsonb_build_object('matching',$11::jsonb),
          pending_reason=$12, model_id=$13, offered_candidate_ids=$14::text[],
          matching_outcome=CASE WHEN $3='processing' THEN 'create_new' ELSE NULL END,
          decision_source=CASE WHEN $3='processing' THEN 'model_no_match' ELSE NULL END,
          decision_at=CASE WHEN $3='processing' THEN now() ELSE NULL END, decision_actor=NULL,
          decision_candidate_ids=ARRAY[]::text[],
          attempt=CASE WHEN $3='processing' THEN attempt ELSE NULL END,
          lease_until=CASE WHEN $3='processing' THEN lease_until ELSE NULL END
        WHERE report_id=$1 AND attempt=$2 AND state='processing' AND lease_until > now() RETURNING report_id`,
        [
          id,
          attempt,
          state,
          search.candidates.map((c) => c.id),
          JSON.stringify(search.candidates),
          JSON.stringify(result.matching),
          JSON.stringify(result.assessments),
          JSON.stringify(search.coverage),
          search.fingerprint,
          MATCHING_VERSION,
          JSON.stringify(result.run),
          result.matching.kind === "uncertain"
            ? coverageIncomplete(search.coverage)
              ? "incomplete_coverage"
              : "unclear_continuity"
            : null,
          result.run.model,
          reviewSet(search.candidates, result.assessments).map((c) => c.id),
        ],
      );
      if (recorded.rowCount && result.matching.kind === "no_match") {
        await publishForAttempt({
          id,
          attempt,
          report,
          extraction: extracted.extraction,
          model: result.run.model,
          search,
        });
      }
    }
  } catch (error) {
    const oversized = error instanceof EvidenceBudgetError;
    const rejected = error instanceof RejectedOutputError ? error : null;
    // Model output can repeat contributor words, so production logs only its shape.
    console.error(
      `Report ${id} ${stage} failed: ${error instanceof Error ? error.message : String(error)}${rejected ? ` (${rejected.shape})` : ""}`,
      rejected && process.env.NODE_ENV !== "production"
        ? JSON.stringify(rejected.output)
        : "",
    );
    await database().query(
      `UPDATE nearhood.report_processing SET state=$3, pending_reason=$4,
      coverage=coverage || jsonb_build_object('inputBudgetExceeded',$5::boolean),
      matching_outcome=NULL, decision_source=NULL, decision_actor=NULL, decision_at=NULL,
      decision_candidate_ids=ARRAY[]::text[],
      attempt=NULL, lease_until=NULL WHERE report_id=$1 AND attempt=$2 AND state='processing'`,
      [
        id,
        attempt,
        oversized ? "clarification" : "pending",
        oversized ? "evidence_budget" : `${stage}_failed`,
        oversized,
      ],
    );
  }
  return savedReport(id, contributorId);
}

async function publishForAttempt(input: {
  id: string;
  attempt: string;
  report: SubmittedReport;
  extraction: Extraction;
  model: string;
  search: CandidateSearch;
}) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [PUBLICATION_LOCK]);
    const fresh = await nearbyCandidates(candidateSearch(input.report), client);
    if (fresh.fingerprint !== input.search.fingerprint)
      throw Error("Candidate evidence changed before publication");

    const locked = await client.query(
      `SELECT report_id FROM nearhood.report_processing WHERE report_id=$1
      AND attempt=$2 AND state='processing' AND lease_until>now() FOR UPDATE`,
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
      attempt=NULL, lease_until=NULL, model_id=$4, pending_reason=NULL WHERE report_id=$1 AND attempt=$2`,
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
  const report: SubmittedReport = await savedReport(id, contributorId);
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [PUBLICATION_LOCK]);
    const { rows } = await client.query<{
      state: string;
      candidate_ids: string[];
      offered_candidate_ids: string[];
      extraction: Extraction | null;
      model_id: string | null;
      matching_outcome: "matched" | "create_new" | null;
      decision_source: string | null;
      happening_id: string | null;
      recommendation: MatchRecommendation | null;
      extraction_version: string | null;
      extraction_input: string | null;
      matching_version: string | null;
      snapshot_fingerprint: string | null;
      assessments: CandidateAssessment[];
      coverage: CandidateSearch["coverage"];
    }>(
      `SELECT state, candidate_ids, offered_candidate_ids, extraction, model_id,
        matching_outcome, decision_source, happening_id,
        recommendation, extraction_version, extraction_input, matching_version,
        snapshot_fingerprint, assessments, coverage
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
        (choice.choice !== "match" &&
          processing.matching_outcome === "create_new" &&
          processing.decision_source ===
            (choice.choice === "create_new"
              ? "contributor_rejected_candidates"
              : "contributor_unsure"));
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
    const fresh = await nearbyCandidates(candidateSearch(report), client);
    if (
      !processing.extraction ||
      !processing.model_id ||
      processing.extraction_version !== EXTRACTION_VERSION ||
      processing.extraction_input !== extractionInput(report) ||
      processing.matching_version !== MATCHING_VERSION
    )
      throw new SubmissionError(
        "Matching suggestions need to be refreshed.",
        409,
      );
    if (processing.snapshot_fingerprint !== fresh.fingerprint)
      throw new SubmissionError(
        "Nearby evidence changed. Refresh the suggestions before deciding.",
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
    const offered = processing.offered_candidate_ids;
    if (
      choice.choice === "match" &&
      (!offered.includes(choice.candidateId) ||
        !choice.candidateIdsShown.includes(choice.candidateId))
    )
      throw new SubmissionError(
        "Choose a Happening from the saved nearby suggestions.",
      );
    if (
      // Nothing may be offered when every graded candidate was separate.
      choice.candidateIdsShown.length < Math.min(1, offered.length) ||
      choice.candidateIdsShown.length > processing.candidate_ids.length ||
      new Set(choice.candidateIdsShown).size !==
        choice.candidateIdsShown.length ||
      choice.candidateIdsShown.some(
        (candidateId) => !offered.includes(candidateId),
      )
    )
      throw new SubmissionError(
        "Refresh the nearby suggestions before deciding.",
      );

    // "Can't tell" never claims the Report differs from the possible matches.
    if (
      choice.choice === "unsure" &&
      offered
        .slice(0, REVIEW_SET_SIZE)
        .some((candidateId) => !choice.candidateIdsShown.includes(candidateId))
    )
      throw new SubmissionError(
        "Look at the first suggestions before publishing your Report on its own.",
      );
    if (choice.choice === "create_new" && coverageIncomplete(processing.coverage))
      throw new SubmissionError(COVERAGE_LIMIT_MESSAGE, 409);
    if (
      choice.choice === "create_new" &&
      processing.assessments.some(
        (a) =>
          isPlausible(a) && !choice.candidateIdsShown.includes(a.candidateId),
      )
    )
      throw new SubmissionError(
        "Another nearby Happening may describe this Report. Choose a shown Happening or leave this Report unassigned.",
        409,
      );

    // Existing-Happening publications lock the same rows; check their versions after locking.
    await client.query(
      "SELECT id FROM nearhood.happenings WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",
      [processing.candidate_ids],
    );
    const versions = await client.query<{ id: string; version: number }>(
      `SELECT h.id,
      COALESCE((SELECT MAX(a.version) FROM nearhood.shared_accounts a WHERE a.happening_id=h.id),0)::int AS version
      FROM nearhood.happenings h WHERE h.id=ANY($1::text[])`,
      [processing.candidate_ids],
    );
    if (
      versions.rows.some(
        (v) =>
          fresh.candidates.find((c) => c.id === v.id)?.accountVersion !==
          v.version,
      )
    )
      throw new SubmissionError(
        "Nearby evidence changed. Refresh the suggestions before deciding.",
        409,
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
    const reportObservationIds = await publishEvidence(client, {
      report,
      extraction: processing.extraction,
      happeningId,
      createHappening: choice.choice !== "match",
    });
    await recordConnections(client, {
      reportId: report.id,
      contributorId,
      happeningId,
      reportObservationIds,
      assessments: processing.assessments,
      coverage: processing.coverage,
      matchingVersion: processing.matching_version,
      snapshotFingerprint: processing.snapshot_fingerprint,
      answer: choice.choice,
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
        {
          match: "contributor_confirmed",
          create_new: "contributor_rejected_candidates",
          unsure: "contributor_unsure",
        }[choice.choice],
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
    report: SubmittedReport;
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
        (id,report_id,subject,described_state,uncertainty,spatial_scope,observed_at,source_support)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        observationId,
        report.id,
        observation.subject,
        observation.describedCondition,
        observation.uncertainty,
        observation.spatialScope,
        report.observedAt,
        JSON.stringify(observation.sourceSupport),
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

  const contributors = await client.query<{ count: number }>(
    `SELECT COUNT(DISTINCT r.contributor_id)::int AS count
    FROM nearhood.observation_memberships m
    JOIN nearhood.observations o ON o.id=m.observation_id
    JOIN nearhood.reports r ON r.id=o.report_id WHERE m.happening_id=$1`,
    [happeningId],
  );
  const claims = extraction.observations.filter((o) => o.describedCondition);
  const accountId = randomUUID();
  const version = (previousAccount?.version ?? 0) + 1;
  // The caveat holds until a different contributor's Report joins.
  const uncertainty = new Set([
    ...(contributors.rows[0].count === 1 ? [SINGLE_CONTRIBUTOR] : []),
    ...(
      previousAccount?.uncertainty ?? [
        "Unobserved conditions and extent remain unknown.",
      ]
    ).filter((item) => item !== SINGLE_CONTRIBUTOR),
  ]);
  if (input.createHappening && !claims.length)
    uncertainty.add("No condition was described in this Report.");
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

  // Software derives one claim per described condition; the original Report
  // stays linked through the supporting Observation.
  for (const observation of claims) {
    const claimId = randomUUID();
    await client.query(
      "INSERT INTO nearhood.claims(id,account_id,statement,position) VALUES ($1,$2,$3,$4)",
      [
        claimId,
        accountId,
        `${observation.subject}${observation.spatialScope ? ` (${observation.spatialScope})` : ""}: ${observation.describedCondition}`,
        nextPosition++,
      ],
    );
    await client.query(
      "INSERT INTO nearhood.claim_supports(claim_id,observation_id) VALUES ($1,$2)",
      [claimId, observationIds.get(observation.key)],
    );
  }
  return [...observationIds.values()];
}
