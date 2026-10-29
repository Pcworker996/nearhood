import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
import { database } from "./database";
import type { MatchCandidate, MatchEvidence } from "./happenings";

export const MATCHING_SCOPE = {
  radiusMeters: 1500,
  maxCandidates: 20,
  evidenceReportsPerCandidate: 3,
} as const;

type CandidateRow = Omit<MatchCandidate, "evidence"> & {
  timeDistanceSeconds: number | null;
};
type EvidenceRow = MatchEvidence & {
  happeningId: string;
  evidenceCount: number;
};

export async function nearbyCandidates(
  input: {
    lat: number;
    lng: number;
    observedAt: string | null;
    candidateHint: string | null;
  },
  query: Pick<PoolClient, "query"> = database(),
): Promise<CandidateSearch> {
  const { rows: candidates } = await query.query<CandidateRow>(
    `WITH submitted AS (
      SELECT extensions.ST_SetSRID(extensions.ST_MakePoint($1,$2),4326)::extensions.geography AS location
    )
    SELECT h.id, h.title, h.category, h.location_name AS "locationName",
      (SELECT COALESCE(MAX(a.version),0)::int FROM nearhood.shared_accounts a WHERE a.happening_id=h.id) AS "accountVersion",
      extensions.ST_Y(h.location::extensions.geometry) AS lat,
      extensions.ST_X(h.location::extensions.geometry) AS lng,
      LEAST(extensions.ST_Distance(h.location, submitted.location),
        COALESCE(MIN(extensions.ST_Distance(r.location, submitted.location)),
          extensions.ST_Distance(h.location, submitted.location))) AS "distanceMeters",
      MIN(ABS(EXTRACT(EPOCH FROM (o.observed_at-$3::timestamptz))))
        FILTER (WHERE o.observed_at IS NOT NULL) AS "timeDistanceSeconds"
    FROM nearhood.happenings h CROSS JOIN submitted
    LEFT JOIN nearhood.observation_memberships m ON m.happening_id=h.id
    LEFT JOIN nearhood.observations o ON o.id=m.observation_id
    LEFT JOIN nearhood.reports r ON r.id=o.report_id
    WHERE extensions.ST_DWithin(h.location, submitted.location, $4::double precision)
      OR extensions.ST_DWithin(r.location, submitted.location, $4::double precision)
    GROUP BY h.id, submitted.location
    HAVING LEAST(extensions.ST_Distance(h.location, submitted.location),
        COALESCE(MIN(extensions.ST_Distance(r.location, submitted.location)),
          extensions.ST_Distance(h.location, submitted.location))) <= $4::double precision
      AND COUNT(DISTINCT o.id) > 0
    ORDER BY CASE WHEN $5::text IS NOT NULL AND h.id=$5 THEN 0 ELSE 1 END,
      "timeDistanceSeconds" ASC NULLS LAST, "distanceMeters" ASC, h.id
    LIMIT $6::int`,
    [
      input.lng,
      input.lat,
      input.observedAt,
      MATCHING_SCOPE.radiusMeters,
      input.candidateHint,
      MATCHING_SCOPE.maxCandidates + 1,
    ],
  );
  const poolTruncated = candidates.length > MATCHING_SCOPE.maxCandidates;
  const omittedCandidateIds = candidates
    .slice(MATCHING_SCOPE.maxCandidates)
    .map((c) => c.id);
  candidates.splice(MATCHING_SCOPE.maxCandidates);
  if (!candidates.length)
    return {
      candidates: [],
      coverage: {
        poolTruncated: false,
        omittedCandidateIds: [],
        omittedEvidence: {},
      },
      fingerprint: snapshotFingerprint([], {
        poolTruncated: false,
        omittedCandidateIds: [],
        omittedEvidence: {},
      }),
    };

  // Evidence is selected by Report: every Observation of a chosen Report travels
  // with it, so splitting one Report into scoped Observations omits nothing.
  const { rows: evidence } = await query.query<EvidenceRow>(
    `WITH requested AS (
      SELECT id, ordinality FROM unnest($1::text[]) WITH ORDINALITY AS items(id, ordinality)
    ), member_reports AS (
      SELECT m.happening_id, r.id AS report_id, r.submitted_at, r.observed_at
      FROM requested q
      JOIN nearhood.observation_memberships m ON m.happening_id=q.id
      JOIN nearhood.observations o ON o.id=m.observation_id
      JOIN nearhood.reports r ON r.id=o.report_id
      GROUP BY m.happening_id, r.id
    ), counted AS (
      SELECT *, MIN(submitted_at) OVER (PARTITION BY happening_id) AS first_submitted,
        COUNT(*) OVER (PARTITION BY happening_id)::int AS report_count
      FROM member_reports
    ), ranked AS (
      SELECT happening_id, report_id, report_count,
        ROW_NUMBER() OVER (PARTITION BY happening_id ORDER BY
          CASE WHEN submitted_at=first_submitted THEN 0 ELSE 1 END,
          CASE WHEN $2::timestamptz IS NOT NULL AND observed_at IS NULL THEN 1 ELSE 0 END,
          CASE WHEN $2::timestamptz IS NOT NULL AND observed_at IS NOT NULL
            THEN ABS(EXTRACT(EPOCH FROM (observed_at-$2::timestamptz))) END ASC NULLS LAST,
          observed_at DESC NULLS LAST, submitted_at DESC, report_id) AS report_position
      FROM counted
    )
    SELECT ranked.report_count AS "evidenceCount", ranked.happening_id AS "happeningId",
      o.id AS "observationId", r.id AS "reportId",
      r.original_text AS "originalText", c.display_name AS "displayName",
      r.observed_at AS "observedAt", r.submitted_at AS "submittedAt", r.provenance,
      r.source_url AS "sourceUrl", COALESCE(p.location_name,h.location_name) AS "reportLocationName",
      extensions.ST_Y(r.location::extensions.geometry) AS lat,
      extensions.ST_X(r.location::extensions.geometry) AS lng,
      o.subject, o.described_state AS "describedState", o.spatial_scope AS "spatialScope"
    FROM ranked
    JOIN requested q ON q.id=ranked.happening_id
    JOIN nearhood.observation_memberships m ON m.happening_id=ranked.happening_id
    JOIN nearhood.observations o ON o.id=m.observation_id AND o.report_id=ranked.report_id
    JOIN nearhood.reports r ON r.id=ranked.report_id
    JOIN nearhood.contributors c ON c.id=r.contributor_id
    JOIN nearhood.happenings h ON h.id=ranked.happening_id
    LEFT JOIN nearhood.report_processing p ON p.report_id=r.id
    WHERE ranked.report_position <= $3::int
    ORDER BY q.ordinality, ranked.report_position, o.id`,
    [
      candidates.map((candidate) => candidate.id),
      input.observedAt,
      MATCHING_SCOPE.evidenceReportsPerCandidate,
    ],
  );
  const evidenceByHappening = new Map<string, MatchEvidence[]>();
  const omittedEvidence: Record<string, number> = {};
  for (const item of evidence) {
    const { happeningId, evidenceCount, ...itemEvidence } = item;
    if (evidenceCount > MATCHING_SCOPE.evidenceReportsPerCandidate)
      omittedEvidence[happeningId] =
        evidenceCount - MATCHING_SCOPE.evidenceReportsPerCandidate;
    const current = evidenceByHappening.get(happeningId) ?? [];
    current.push(itemEvidence);
    evidenceByHappening.set(happeningId, current);
  }
  const packet = candidates.map(
    ({ timeDistanceSeconds: _timeDistanceSeconds, ...candidate }) => ({
      ...candidate,
      distanceMeters: Math.round(candidate.distanceMeters),
      evidence: evidenceByHappening.get(candidate.id) ?? [],
    }),
  );
  const coverage = { poolTruncated, omittedCandidateIds, omittedEvidence };
  return {
    candidates: packet,
    coverage,
    fingerprint: snapshotFingerprint(packet, coverage),
  };
}

export type CandidateSearch = {
  candidates: MatchCandidate[];
  coverage: {
    poolTruncated: boolean;
    omittedCandidateIds: string[];
    omittedEvidence: Record<string, number>;
  };
  fingerprint: string;
};
export function snapshotFingerprint(
  candidates: MatchCandidate[],
  coverage: CandidateSearch["coverage"],
) {
  return createHash("sha256")
    .update(JSON.stringify({ candidates, coverage }))
    .digest("hex");
}
