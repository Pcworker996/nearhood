import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { matchingCases } from "../scripts/matching-fixtures";
import type {
  MatchCandidate,
  HappeningDetail,
  SavedReport,
} from "../src/lib/happenings";
import type { ReportContext } from "../src/lib/report-model";
import { projectLatitude } from "./project-coordinates";
import { serverLog } from "./server-timing";

const fixture = "http://127.0.0.1:3101";
const log = new URL(
  "../docs/reviews/artifacts/2026-10-27-issue-4-matching/attempts.jsonl",
  import.meta.url,
);
const replayRows = (await readFile(log, "utf8")).trim().split("\n");
// Rebase recorded dates together so real submission validation sees past observations.
const replayOffset = Date.now() - Date.parse("2026-11-04T00:00:00Z");
const replayObservedAt = (value: string | null) =>
  value === null
    ? null
    : new Date(Date.parse(value) + replayOffset).toISOString();
function object(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
}
function replay(caseId: string, trial: number, ids: Map<string, string>) {
  const row = replayRows
    .map((line) => object(JSON.parse(line)))
    .find((r) => r.caseId === caseId && r.trial === trial);
  assert.ok(row);
  const response = object(object(row.captured).response);
  assert.ok(Array.isArray(response.choices));
  const content = object(object(response.choices[0]).message).content;
  assert.equal(typeof content, "string");
  const output = object(JSON.parse(String(content)));
  assert.ok(Array.isArray(output.assessments));
  return JSON.stringify({
    ...output,
    assessments: output.assessments.map((value: unknown) => {
      const a = object(value);
      assert.equal(typeof a.candidateId, "string");
      assert.ok(Array.isArray(a.evidenceIds));
      const candidateId = ids.get(String(a.candidateId));
      assert.ok(candidateId);
      const evidenceIds = a.evidenceIds.map((id: unknown) => {
        assert.equal(typeof id, "string");
        const mapped = ids.get(String(id));
        assert.ok(mapped);
        return mapped;
      });
      return { ...a, candidateId, evidenceIds };
    }),
  });
}

async function failureLog(reportId: string) {
  return (await readFile(serverLog, "utf8"))
    .split("\n")
    .findLast((line) => line.includes(`Report ${reportId} `));
}
async function signIn(page: Page) {
  await page.goto("/?contribute=1");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByRole("button", { name: "Submit Report", exact: true }),
  ).toBeVisible();
}
async function control(
  page: Page,
  text: string,
  mode = "success",
  matchingReplay?: string,
) {
  expect(
    (
      await page.request.post(`${fixture}/control`, {
        data: { text, mode, matchingReplay },
      })
    ).ok(),
  ).toBe(true);
}
async function save(page: Page, report: ReportContext): Promise<SavedReport> {
  const response = await page.request.post("/api/reports", {
    data: {
      ...report,
      requestKey: randomUUID(),
      displayName: "State test contributor",
      candidateId: null,
    },
  });
  const saved: SavedReport = await response.json();
  expect(response.ok(), JSON.stringify(saved)).toBe(true);
  expect(saved.state).toBe("saved");
  expect(saved.happeningId).toBeNull();
  return saved;
}
async function advance(page: Page, id: string): Promise<SavedReport> {
  const response = await page.request.post(`/api/reports/${id}/process`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function detail(page: Page, id: string): Promise<HappeningDetail> {
  const response = await page.request.get(`/api/happenings/${id}`);
  expect(response.status()).toBe(200);
  return response.json();
}
async function persisted(
  page: Page,
  expected: SavedReport,
  history: SavedReport[],
) {
  const response = await page.request.get(`/api/reports/${expected.id}`);
  expect(response.ok()).toBe(true);
  const recovered: SavedReport = await response.json();
  expect(recovered.state).toBe(expected.state);
  expect(recovered.happeningId).toBe(expected.happeningId);
  expect(recovered.originalText).toBe(expected.originalText);
  expect(recovered.extractionReady).toBe(expected.extractionReady);
  history.push(recovered);
}
async function seed(
  page: Page,
  candidate: MatchCandidate,
  lat: number,
  lng: number,
  ids: Map<string, string>,
) {
  // This suite verifies publication state, not model reasoning over the original packet.
  // Short supports keep the real retrieval packet inside its production input budget.
  const originalText = candidate.evidence
    .map((e) => e.originalText.match(/^[^.!?]+[.!?]?/)?.[0] ?? e.originalText)
    .join("\n");
  await control(page, originalText);
  const saved = await save(page, {
    originalText,
    lat,
    lng,
    locationName: candidate.locationName,
    observedAt: replayObservedAt(candidate.evidence[0].observedAt),
    provenance: "firsthand",
    sourceUrl: null,
  });
  await advance(page, saved.id);
  const published = await advance(page, saved.id);
  expect(published.state).toBe("published");
  const publicEvidence = await detail(page, saved.id);
  expect(publicEvidence.observations.length).toBeGreaterThanOrEqual(
    candidate.evidence.length,
  );
  ids.set(candidate.id, saved.id);
  for (const [i, e] of candidate.evidence.entries())
    ids.set(e.observationId, publicEvidence.observations[i].id);
  return publicEvidence;
}
const scenarios: {
  id: string;
  state: SavedReport["state"];
  confirm?: boolean;
}[] = [
  { id: "T01", state: "match_review", confirm: true },
  { id: "N01", state: "published" },
  { id: "T02", state: "clarification", confirm: true },
  { id: "D03", state: "clarification" },
  { id: "S03", state: "clarification" },
  { id: "U04", state: "match_review" },
  // One same plus unknown candidates is suggested since ADR 0008 (#22).
  { id: "P03", state: "match_review" },
  { id: "A02-remove-identity", state: "pending" },
];

for (const [index, scenario] of scenarios.entries()) {
  test(`recorded ${scenario.id} matching response persists ${scenario.state}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    await signIn(page);
    const c = matchingCases.find((c) => c.id === scenario.id)!;
    const lat =
      -65 + index * 2 + (testInfo.project.name === "mobile-chromium" ? 0.5 : 0);
    const lng = -120;
    const ids = new Map<string, string>();
    const before: HappeningDetail[] = [];
    for (const candidate of c.input[2])
      before.push(await seed(page, candidate, lat, lng, ids));
    const report = {
      ...c.input[0],
      lat,
      lng,
      observedAt: replayObservedAt(c.input[0].observedAt),
    };
    await control(page, report.originalText, "success", replay(c.id, 1, ids));
    const saved = await save(page, report);
    const history = [saved];
    const checkpoint = await advance(page, saved.id);
    expect(checkpoint.state).toBe("saved");
    expect(checkpoint.processingStage).toBe("matching");
    expect(checkpoint.extractionReady).toBe(true);
    await persisted(page, checkpoint, history);
    const matched = await advance(page, saved.id);
    expect(matched.state).toBe(scenario.state);
    expect(matched.originalText).toBe(report.originalText);
    await persisted(page, matched, history);
    // Publication into an existing Happening is never an effect of matching alone.
    for (const previous of before) {
      const after = await detail(page, previous.id);
      expect(after.account).toEqual(previous.account);
      expect(after.reports).toEqual(previous.reports);
      expect(after.observations).toEqual(previous.observations);
    }
    if (scenario.state === "published") {
      expect(matched.happeningId).toBe(saved.id);
      const published = await detail(page, saved.id);
      expect(published.reports.filter((r) => r.id === saved.id)).toHaveLength(
        1,
      );
      expect(
        published.reports.find((r) => r.id === saved.id)?.originalText,
      ).toBe(report.originalText);
      expect((await advance(page, saved.id)).state).toBe("published");
      expect((await detail(page, saved.id)).observations).toEqual(
        published.observations,
      );
    } else {
      expect(matched.happeningId).toBeNull();
      expect(
        (await page.request.get(`/api/happenings/${saved.id}`)).status(),
      ).toBe(404);
    }
    if (scenario.confirm) {
      const targetId = ids.get(c.input[2][0].id)!;
      const choice = {
        choice: "match",
        candidateId: targetId,
        candidateIdsShown: matched.candidates.map((candidate) => candidate.id),
      };
      const confirmedResponse = await page.request.post(
        `/api/reports/${saved.id}/match`,
        { data: choice },
      );
      expect(confirmedResponse.status()).toBe(200);
      const confirmed: SavedReport = await confirmedResponse.json();
      expect(confirmed.state).toBe("published");
      expect(confirmed.happeningId).toBe(targetId);
      await persisted(page, confirmed, history);
      const published = await detail(page, targetId);
      expect(published.reports.filter((r) => r.id === saved.id)).toHaveLength(
        1,
      );
      expect(published.observations.some((o) => o.reportId === saved.id)).toBe(
        true,
      );
      expect(
        (
          await page.request.post(`/api/reports/${saved.id}/match`, {
            data: choice,
          })
        ).status(),
      ).toBe(200);
      expect((await detail(page, targetId)).reports).toEqual(published.reports);
      expect((await detail(page, targetId)).observations).toEqual(
        published.observations,
      );
    }
    if (c.id === "P03") {
      // The one same candidate is suggested; unshown unknown ones still block rejection.
      expect(matched.pendingReason).toBeNull();
      expect(matched.recommendation?.kind).toBe("match");
      const rejected = await page.request.post(
        `/api/reports/${saved.id}/match`,
        {
          data: {
            choice: "create_new",
            candidateIdsShown: matched.candidates.map(
              (candidate) => candidate.id,
            ),
          },
        },
      );
      expect(rejected.status()).toBe(409);
      await persisted(page, matched, history);
    }
    if (c.id === "A02-remove-identity") {
      expect(matched.pendingReason).toBe("matching_failed");
      expect(matched.extractionReady).toBe(true);
      // The cause, the output's shape and (outside production) the output are kept.
      await expect
        .poll(() => failureLog(saved.id))
        .toMatch(
          /matching failed: Incomplete candidate assessment \(1 of 2\) \(assessments: 1; reason lengths: \d+\) \{"assessments"/,
        );
      await control(page, report.originalText, "success", replay(c.id, 2, ids));
      const retried = await advance(page, saved.id);
      expect(retried.state).toBe("clarification");
      expect(retried.extractionReady).toBe(true);
      expect(retried.happeningId).toBeNull();
      await persisted(page, retried, history);
    }
    await attach(testInfo, c.id, history);
  });
}

async function attach(
  testInfo: TestInfo,
  source: string,
  history: SavedReport[],
) {
  const path = testInfo.outputPath("saved-report-state-transitions.json");
  const body = Buffer.from(
    JSON.stringify(
      {
        source,
        project: testInfo.project.name,
        externalServices:
          "recorded matching or controlled fixture; no new live inference",
        states: history.map((r) => ({
          id: r.id,
          state: r.state,
          processingStage: r.processingStage,
          extractionReady: r.extractionReady,
          happeningId: r.happeningId,
          pendingReason: r.pendingReason,
          nextAction: r.nextAction,
        })),
      },
      null,
      2,
    ),
  );
  await writeFile(path, body);
  await testInfo.attach("saved-report-state-transitions", {
    path,
    contentType: "application/json",
  });
}

test("a model that stops after one assessment is still made to assess every candidate", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await signIn(page);
  const c = matchingCases.find((c) => c.id === "A01")!;
  expect(c.input[2].length).toBeGreaterThan(1);
  const lat = projectLatitude(testInfo, 30);
  const lng = -120;
  const ids = new Map<string, string>();
  for (const candidate of c.input[2])
    await seed(page, candidate, lat, lng, ids);
  const report: ReportContext = {
    ...c.input[0],
    lat,
    lng,
    observedAt: replayObservedAt(c.input[0].observedAt),
  };
  await control(page, report.originalText, "stops-early");
  const saved = await save(page, report);
  const history = [saved];
  await persisted(page, await advance(page, saved.id), history);
  const matched = await advance(page, saved.id);
  expect(matched.pendingReason).not.toBe("matching_failed");
  expect(matched.state).toBe("published");
  expect(matched.happeningId).toBe(saved.id);
  await persisted(page, matched, history);
  await attach(testInfo, "model stops after one assessment", history);
});

test("provider failure stays pending; matching retry with empty search publishes once", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const originalText = `A cart blocks the isolated test ramp. ${randomUUID()}`;
  const report: ReportContext = {
    originalText,
    lat: -42 + (testInfo.project.name === "mobile-chromium" ? 0.5 : 0),
    lng: -120,
    locationName: "Isolated test ramp",
    observedAt: null,
    provenance: "firsthand",
    sourceUrl: null,
  };
  await control(page, originalText, "matching-failure");
  const saved = await save(page, report);
  const history = [saved];
  await persisted(page, await advance(page, saved.id), history);
  const failed = await advance(page, saved.id);
  expect(failed.state).toBe("pending");
  expect(failed.pendingReason).toBe("matching_failed");
  expect(failed.extractionReady).toBe(true);
  expect(failed.happeningId).toBeNull();
  expect((await page.request.get(`/api/happenings/${saved.id}`)).status()).toBe(
    404,
  );
  await persisted(page, failed, history);
  // Output cut off mid-string cannot be parsed; its length is still recorded.
  await control(
    page,
    originalText,
    "success",
    '{"assessments":[{"reason":"cut',
  );
  const unparsed = await advance(page, saved.id);
  expect(unparsed.pendingReason).toBe("matching_failed");
  await expect
    .poll(() => failureLog(saved.id))
    .toMatch(/matching failed: .*\(unparsed output: 30 characters\)/);
  await control(
    page,
    originalText,
    "success",
    JSON.stringify({ assessments: [] }),
  );
  const published = await advance(page, saved.id);
  expect(published.state).toBe("published");
  expect(published.happeningId).toBe(saved.id);
  await persisted(page, published, history);
  const publicEvidence = await detail(page, saved.id);
  expect(publicEvidence.reports.filter((r) => r.id === saved.id)).toHaveLength(
    1,
  );
  expect((await advance(page, saved.id)).state).toBe("published");
  expect((await detail(page, saved.id)).observations).toEqual(
    publicEvidence.observations,
  );
  const counts = await (
    await page.request.get(
      `${fixture}/calls?text=${encodeURIComponent(originalText)}`,
    )
  ).json();
  expect(counts).toEqual({ extraction: 1, matching: 3 });
  await attach(
    testInfo,
    "controlled provider failure and empty search",
    history,
  );
});
