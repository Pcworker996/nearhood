import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { database } from "../src/lib/database";
import { EXTRACTION_VERSION, LEASE_SECONDS } from "../src/lib/report-model";
import { acquireLease } from "../src/lib/report-processing";

type Stage = "extraction" | "matching";
type Row = {
  state: string;
  lease?: "expired" | "unexpired";
  version: string | null;
  input: string | null;
};

const contributorId = `lease-test-${randomUUID()}`;
const input = "current-extraction-input";
const compatible = { version: EXTRACTION_VERSION, input };
const older = [
  { version: null, input: null },
  { version: "report-extraction-v5", input },
  { version: EXTRACTION_VERSION, input: "edited-report-input" },
  { version: "unversioned", input },
];
const newer = { version: "report-extraction-v99", input };
const leasable: Pick<Row, "state" | "lease">[] = [
  { state: "saved" },
  { state: "pending" },
  { state: "processing", lease: "expired" },
];
const reviewed: Pick<Row, "state">[] = [
  { state: "match_review" },
  { state: "clarification" },
];

const cases: {
  line: string;
  row: Row;
  refresh: boolean;
  expected: Stage | null;
}[] = [
  ...[false, true].map((refresh) => ({
    line: "published",
    row: { state: "published", ...compatible },
    refresh,
    expected: null,
  })),
  ...[compatible, ...older].map((checkpoint) => ({
    line: "processing with an unexpired lease",
    row: { state: "processing", lease: "unexpired" as const, ...checkpoint },
    refresh: true,
    expected: null,
  })),
  ...leasable.flatMap((row) => [
    ...[false, true].map((refresh) => ({
      line: "leasable and compatible",
      row: { ...row, ...compatible },
      refresh,
      expected: "matching" as const,
    })),
    ...older.map((checkpoint) => ({
      line: "leasable, incompatible and not newer",
      row: { ...row, ...checkpoint },
      refresh: false,
      expected: "extraction" as const,
    })),
    {
      line: "leasable with a newer checkpoint",
      row: { ...row, ...newer },
      refresh: true,
      expected: null,
    },
  ]),
  ...reviewed.flatMap((row) => [
    {
      line: "reviewed, compatible, no refresh",
      row: { ...row, ...compatible },
      refresh: false,
      expected: null,
    },
    {
      line: "reviewed, compatible, refresh",
      row: { ...row, ...compatible },
      refresh: true,
      expected: "matching" as const,
    },
    ...older.flatMap((checkpoint) =>
      [false, true].map((refresh) => ({
        line: "reviewed, incompatible and not newer",
        row: { ...row, ...checkpoint },
        refresh,
        expected: "extraction" as const,
      })),
    ),
    ...[false, true].map((refresh) => ({
      line: "reviewed with a newer checkpoint",
      row: { ...row, ...newer },
      refresh,
      expected: null,
    })),
  ]),
];

async function insert(row: Row) {
  const id = randomUUID();
  await database().query(
    `INSERT INTO nearhood.reports(id,contributor_id,original_text,observed_at,submitted_at,provenance,source_url,location)
    VALUES ($1,$2,'A lease test Report.',NULL,now(),'firsthand',NULL,
      extensions.ST_SetSRID(extensions.ST_MakePoint(0,0),4326)::extensions.geography)`,
    [id, contributorId],
  );
  await database().query(
    `INSERT INTO nearhood.report_processing(report_id,request_key,request_body,contributor_id,location_name,
      state,attempt,lease_until,processing_stage,pending_reason,extraction_version,extraction_input)
    VALUES ($1,$2,'{}'::jsonb,$3,'Lease test',$4,
      CASE WHEN $5::text IS NULL THEN NULL ELSE gen_random_uuid() END,
      CASE $5::text WHEN 'expired' THEN now()-interval '1 second' WHEN 'unexpired' THEN now()+interval '1 minute' END,
      CASE WHEN $6::text IS NULL THEN 'extraction' ELSE 'matching' END,
      CASE WHEN $4='pending' THEN 'extraction_failed' END,$6,$7)`,
    [
      id,
      randomUUID(),
      contributorId,
      row.state,
      row.lease ?? null,
      row.version,
      row.input,
    ],
  );
  return id;
}

async function stored(id: string) {
  const { rows } = await database().query<{
    row: Record<string, unknown>;
    remaining: number | null;
  }>(
    `SELECT to_jsonb(p) AS row, extract(epoch FROM p.lease_until-now())::float AS remaining
    FROM nearhood.report_processing p WHERE report_id=$1`,
    [id],
  );
  return rows[0];
}

async function lockWait() {
  for (let i = 0; i < 100; i++) {
    const { rows } = await database().query<{ waiting: number }>(
      `SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname=current_database() AND wait_event_type='Lock'`,
    );
    if (rows[0].waiting) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error("The lease never waited for the locked row");
}

before(async () => {
  await database().query(
    "INSERT INTO nearhood.contributors(id,display_name) VALUES ($1,'Lease Tester')",
    [contributorId],
  );
});

after(async () => {
  await database().query(
    "DELETE FROM nearhood.report_processing WHERE contributor_id=$1",
    [contributorId],
  );
  await database().query(
    "DELETE FROM nearhood.reports WHERE contributor_id=$1",
    [contributorId],
  );
  await database().query("DELETE FROM nearhood.contributors WHERE id=$1", [
    contributorId,
  ]);
  await database().end();
});

for (const { line, row, refresh, expected } of cases)
  test(`${line}: ${row.state}${row.lease ? ` (${row.lease} lease)` : ""}, ${row.version ?? "no checkpoint"}${row.input === "edited-report-input" ? " for edited input" : ""}, refresh=${refresh} -> ${expected}`, async () => {
    const id = await insert(row);
    const beforeLease = await stored(id);
    const attempt = randomUUID();
    const stage = await acquireLease({
      id,
      contributorId,
      attempt,
      refresh,
      extractionInput: input,
    });
    assert.equal(stage, expected);
    const afterLease = await stored(id);
    if (expected === null) {
      assert.deepEqual(afterLease.row, beforeLease.row);
      return;
    }
    assert.equal(afterLease.row.state, "processing");
    assert.equal(afterLease.row.attempt, attempt);
    assert.equal(afterLease.row.processing_stage, expected);
    assert.equal(afterLease.row.pending_reason, null);
    assert.ok(
      afterLease.remaining! > LEASE_SECONDS - 5 &&
        afterLease.remaining! <= LEASE_SECONDS,
      `lease lasts ${LEASE_SECONDS} seconds (remaining ${afterLease.remaining})`,
    );
  });

test("a request that read the Report before its review was saved leaves the review unchanged", async () => {
  const id = await insert({ state: "saved", version: null, input: null });
  const blocker = await database().connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query(
      "SELECT 1 FROM nearhood.report_processing WHERE report_id=$1 FOR UPDATE",
      [id],
    );
    const lease = acquireLease({
      id,
      contributorId,
      attempt: randomUUID(),
      refresh: false,
      extractionInput: input,
    });
    await lockWait();
    await blocker.query(
      `UPDATE nearhood.report_processing SET state='match_review', processing_stage='matching',
      extraction_version=$2, extraction_input=$3, recommendation='{"kind":"match","candidateId":"x","evidenceIds":[]}'::jsonb
      WHERE report_id=$1`,
      [id, EXTRACTION_VERSION, input],
    );
    const { rows } = await blocker.query(
      "SELECT to_jsonb(p) AS row FROM nearhood.report_processing p WHERE report_id=$1",
      [id],
    );
    await blocker.query("COMMIT");
    assert.equal(await lease, null);
    assert.deepEqual((await stored(id)).row, rows[0].row);
  } finally {
    blocker.release();
  }
});
