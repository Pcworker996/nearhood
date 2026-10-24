import { randomUUID } from "node:crypto";
import { database } from "./database";
import type { MatchCandidate, SavedReport } from "./happenings";
import {
  EXTRACTION_VERSION,
  extractionInput,
  isPlausible,
  type CandidateAssessment,
} from "./report-model";

export class SubmissionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type ReportInput = {
  requestKey: string;
  originalText: string;
  displayName: string;
  lat: number;
  lng: number;
  locationName: string;
  observedAt: string | null;
  provenance: "firsthand" | "source_based";
  sourceUrl: string | null;
  candidateId: string | null;
};
export function parseReportInput(value: unknown): ReportInput {
  if (!value || typeof value !== "object")
    throw new SubmissionError("Provide a Report.");
  const b = value as Record<string, unknown>;
  const text = (key: string, max: number) => {
    const value = b[key];
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new SubmissionError(`Invalid ${key}.`);
    return value;
  };
  const requestKey = text("requestKey", 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestKey,
    )
  )
    throw new SubmissionError("Invalid submission key.");
  if (
    typeof b.lat !== "number" ||
    !Number.isFinite(b.lat) ||
    Math.abs(b.lat) > 90 ||
    typeof b.lng !== "number" ||
    !Number.isFinite(b.lng) ||
    Math.abs(b.lng) > 180
  )
    throw new SubmissionError("Choose a valid location.");
  if (
    b.observedAt !== null &&
    (typeof b.observedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(b.observedAt) ||
      !Number.isFinite(Date.parse(b.observedAt)) ||
      Date.parse(b.observedAt) > Date.now() + 60000)
  )
    throw new SubmissionError(
      "Choose an observation time in the past, or explicitly unknown.",
    );
  if (b.provenance !== "firsthand" && b.provenance !== "source_based")
    throw new SubmissionError("Choose firsthand or source-based.");
  if (!(
    b.candidateId === null ||
    (typeof b.candidateId === "string" && b.candidateId.length <= 200)
  ))
    throw new SubmissionError("Invalid situation context.");
  let sourceUrl: string | null = null;
  if (b.sourceUrl !== null && b.sourceUrl !== "") {
    if (
      typeof b.sourceUrl !== "string" ||
      b.sourceUrl.length > 2000 ||
      b.provenance !== "source_based"
    )
      throw new SubmissionError("Invalid source link.");
    try {
      const url = new URL(b.sourceUrl);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw Error();
      sourceUrl = url.href;
    } catch {
      throw new SubmissionError(
        "Use an HTTP or HTTPS source link without credentials.",
      );
    }
  }
  return {
    requestKey,
    originalText: text("originalText", 8000),
    displayName: text("displayName", 80).trim(),
    lat: b.lat,
    lng: b.lng,
    locationName: text("locationName", 200),
    observedAt:
      b.observedAt === null
        ? null
        : new Date(b.observedAt as string).toISOString(),
    provenance: b.provenance,
    sourceUrl,
    candidateId: b.candidateId,
  };
}

const savedSelect = `SELECT r.id, r.contributor_id AS "contributorId", r.original_text AS "originalText", c.display_name AS "displayName",
  r.observed_at AS "observedAt", r.submitted_at AS "submittedAt", r.provenance, r.source_url AS "sourceUrl",
  extensions.ST_Y(r.location::extensions.geometry) AS lat, extensions.ST_X(r.location::extensions.geometry) AS lng,
  p.location_name AS "locationName", p.candidate_id AS "candidateId", p.happening_id AS "happeningId",
  p.candidate_ids AS "candidateIds", p.candidate_packet AS candidates,
  p.recommendation, p.matching_outcome AS "matchingOutcome",
  p.decision_candidate_ids AS "decisionCandidateIds",
  p.processing_stage AS "processingStage",
  CASE WHEN p.state='processing' AND p.lease_until < now() THEN p.processing_stage || '_interrupted' ELSE p.pending_reason END AS "pendingReason",
  p.extraction_version AS "extractionVersion", p.extraction_input AS "extractionInput", p.assessments,
  CASE WHEN p.state='processing' AND p.lease_until < now() THEN 'pending' ELSE p.state END AS state
  FROM nearhood.reports r JOIN nearhood.contributors c ON c.id=r.contributor_id JOIN nearhood.report_processing p ON p.report_id=r.id`;

export function reviewSet(
  packet: MatchCandidate[],
  assessments: CandidateAssessment[],
) {
  const order = assessments
    .slice()
    .sort((a, b) => Number(!isPlausible(a)) - Number(!isPlausible(b)));
  return (
    order.length
      ? order.flatMap((a) => packet.filter((c) => c.id === a.candidateId))
      : packet
  ).slice(0, 5);
}

export async function savedReport(id: string, contributorId: string) {
  const { rows } = await database().query<
    SavedReport & {
      extractionVersion: string | null;
      extractionInput: string | null;
      assessments: CandidateAssessment[];
    }
  >(`${savedSelect} WHERE r.id=$1 AND r.contributor_id=$2`, [
    id,
    contributorId,
  ]);
  if (!rows[0]) throw new SubmissionError("Report not found.", 404);
  const {
    extractionVersion,
    extractionInput: input,
    assessments,
    ...report
  } = rows[0];
  report.candidates = reviewSet(report.candidates, assessments);
  const extractionReady =
    extractionVersion === EXTRACTION_VERSION &&
    input === extractionInput(report);
  if (
    !extractionReady &&
    ["match_review", "clarification"].includes(report.state)
  ) {
    report.state = "pending";
    report.pendingReason = "refresh_required";
    report.recommendation = null;
    report.candidates = [];
  }
  const nextAction: SavedReport["nextAction"] =
    report.state === "published"
      ? "none"
      : report.state === "processing"
        ? "wait"
        : report.state === "pending"
          ? "retry"
          : report.state === "match_review" ||
              (report.state === "clarification" &&
                report.recommendation?.kind === "uncertain")
            ? "review"
            : report.state === "clarification"
              ? "none"
              : "process";
  return { ...report, extractionReady, nextAction };
}

export async function saveReport(input: ReportInput, contributorId: string) {
  const client = await database().connect();
  let id: string;
  try {
    await client.query("BEGIN");
    // Serialize first submissions from the same verified contributor, including
    // idempotency checks and their chosen public profile.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [contributorId],
    );
    const existing = await client.query(
      "SELECT report_id, (request_body - 'clearlyNew') = $3::jsonb AS identical FROM nearhood.report_processing WHERE contributor_id=$1 AND request_key=$2",
      [contributorId, input.requestKey, JSON.stringify(input)],
    );
    if (existing.rows[0]) {
      if (!existing.rows[0].identical)
        throw new SubmissionError(
          "This submission key already saved different words. Open the saved Report.",
          409,
        );
      id = existing.rows[0].report_id;
    } else {
      if (input.candidateId) {
        const candidate = await client.query(
          "SELECT id FROM nearhood.happenings WHERE id=$1",
          [input.candidateId],
        );
        if (!candidate.rowCount)
          throw new SubmissionError("The candidate Happening was not found.");
      }
      await client.query(
        "INSERT INTO nearhood.contributors(id,display_name) VALUES ($1,$2) ON CONFLICT(id) DO NOTHING",
        [contributorId, input.displayName],
      );
      id = randomUUID();
      await client.query(
        `INSERT INTO nearhood.reports(id,contributor_id,original_text,observed_at,submitted_at,provenance,source_url,location)
        VALUES ($1,$2,$3,$4,now(),$5,$6,extensions.ST_SetSRID(extensions.ST_MakePoint($7,$8),4326)::extensions.geography)`,
        [
          id,
          contributorId,
          input.originalText,
          input.observedAt,
          input.provenance,
          input.sourceUrl,
          input.lng,
          input.lat,
        ],
      );
      await client.query(
        `INSERT INTO nearhood.report_processing(report_id,request_key,request_body,contributor_id,candidate_id,location_name)
        VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          id,
          input.requestKey,
          JSON.stringify(input),
          contributorId,
          input.candidateId,
          input.locationName,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return savedReport(id, contributorId);
}
