import { Pool } from "pg";
import type {
  Bounds,
  ClaimEvidence,
  Happening,
  HappeningDetail,
  Observation,
  Report,
  SharedAccount,
} from "./happenings";
import { poolConfig } from "./postgres-config";

const globalDatabase = globalThis as typeof globalThis & {
  nearhoodPool?: Pool;
};
function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  globalDatabase.nearhoodPool ??= new Pool({
    ...poolConfig(process.env.DATABASE_URL),
    max: 5,
  });
  return globalDatabase.nearhoodPool;
}

const happeningSelect = `SELECT h.id, h.title, h.category, h.location_name AS "locationName", h.status, h.demo,
  extensions.ST_Y(h.location::extensions.geometry) AS lat, extensions.ST_X(h.location::extensions.geometry) AS lng,
  h.starts_at AS "startsAt", h.ends_at AS "endsAt",
  (SELECT count(DISTINCT r.contributor_id)::int FROM nearhood.observation_memberships m
   JOIN nearhood.observations o ON o.id=m.observation_id JOIN nearhood.reports r ON r.id=o.report_id WHERE m.happening_id=h.id) AS "contributorCount"
  FROM nearhood.happenings h`;

async function currentAccount(id: string): Promise<SharedAccount | null> {
  const { rows } = await database().query<SharedAccount>(
    `SELECT id, version, published_at AS "publishedAt", origin, uncertainty
    FROM nearhood.shared_accounts WHERE happening_id=$1 ORDER BY version DESC LIMIT 1`,
    [id],
  );
  const account = rows[0];
  if (!account) return null;
  const claims = await database().query(
    `SELECT id, statement FROM nearhood.claims WHERE account_id=$1 ORDER BY position, id`,
    [account.id],
  );
  return { ...account, claims: claims.rows };
}

export async function listHappenings(bounds: Bounds): Promise<Happening[]> {
  const { rows } = await database().query<Happening>(
    `${happeningSelect} WHERE
    extensions.ST_Y(h.location::extensions.geometry) BETWEEN $2 AND $4 AND
    (CASE WHEN $1::double precision <= $3::double precision THEN extensions.ST_Intersects(h.location::extensions.geometry, extensions.ST_MakeEnvelope($1::double precision,$2::double precision,$3::double precision,$4::double precision,4326))
     ELSE extensions.ST_X(h.location::extensions.geometry) >= $1 OR extensions.ST_X(h.location::extensions.geometry) <= $3 END)
    ORDER BY h.title`,
    [bounds.west, bounds.south, bounds.east, bounds.north],
  );
  return Promise.all(
    rows.map(async (h) => ({ ...h, account: await currentAccount(h.id) })),
  );
}

export async function happeningDetail(
  id: string,
): Promise<HappeningDetail | null> {
  const { rows } = await database().query<Happening>(
    `${happeningSelect} WHERE h.id=$1`,
    [id],
  );
  if (!rows[0]) return null;
  const [account, reports, observations] = await Promise.all([
    currentAccount(id),
    database().query<Report>(
      `SELECT DISTINCT r.id, r.contributor_id AS "contributorId", c.display_name AS "displayName", r.original_text AS "originalText",
      r.observed_at AS "observedAt", r.submitted_at AS "submittedAt", r.provenance, r.source_url AS "sourceUrl",
      extensions.ST_Y(r.location::extensions.geometry) AS lat, extensions.ST_X(r.location::extensions.geometry) AS lng
      FROM nearhood.reports r JOIN nearhood.contributors c ON c.id=r.contributor_id
      JOIN nearhood.observations o ON o.report_id=r.id JOIN nearhood.observation_memberships m ON m.observation_id=o.id
      WHERE m.happening_id=$1 ORDER BY "observedAt" DESC NULLS LAST, r.id`,
      [id],
    ),
    database().query<Observation>(
      `SELECT o.id, o.report_id AS "reportId", o.subject, o.described_state AS "describedState",
      o.spatial_scope AS "spatialScope", o.observed_at AS "observedAt" FROM nearhood.observations o
      JOIN nearhood.observation_memberships m ON m.observation_id=o.id WHERE m.happening_id=$1
      ORDER BY o.observed_at DESC NULLS LAST, o.id`,
      [id],
    ),
  ]);
  return {
    ...rows[0],
    account,
    reports: reports.rows,
    observations: observations.rows,
  };
}

export async function claimEvidence(
  id: string,
  claimId: string,
): Promise<ClaimEvidence | null> {
  const detail = await happeningDetail(id);
  const claim = detail?.account?.claims.find((c) => c.id === claimId);
  if (!detail || !claim) return null;
  const { rows } = await database().query<{ observation_id: string }>(
    `SELECT observation_id FROM nearhood.claim_supports WHERE claim_id=$1`,
    [claimId],
  );
  const supported = new Set(rows.map((r) => r.observation_id));
  const evidence: ClaimEvidence["evidence"] = [];
  for (const observation of detail.observations) {
    if (!supported.has(observation.id)) continue;
    const report = detail.reports.find((r) => r.id === observation.reportId);
    if (report) evidence.push({ observation, report });
  }
  return { claim, evidence };
}
