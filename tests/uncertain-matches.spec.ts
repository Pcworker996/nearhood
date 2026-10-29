import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { projectLatitude } from "./project-coordinates";
import {
  joinHappening,
  processFully,
  publishedHappening,
  signIn,
  submit,
} from "./uncertain-matches";

const ids = (candidates: { id: string }[]) => candidates.map((c) => c.id);

test("one same Happening is suggested even when another is unknown", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 45), lng: 140 };
  const same = await publishedHappening(page, place);
  const unknown = await publishedHappening(page, place);
  const report = await submit(
    page,
    `The remote path barrier is still up. ${randomUUID()}`,
    place,
    { [same]: { continuity: "same" }, [unknown]: { continuity: "unknown" } },
  );

  const review = await processFully(page, report.id);

  expect(review.state).toBe("match_review");
  expect(review.recommendation).toMatchObject({ kind: "match", candidateId: same });
  expect(ids(review.candidates).slice(0, 2)).toEqual([same, unknown]);
});

test("a separate grade with a conflicting chronology is an alternative, never the suggestion", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 50), lng: 140 };
  const same = await publishedHappening(page, place);
  const conflicting = await publishedHappening(page, place);
  const report = await submit(
    page,
    `The remote path barrier is still up. ${randomUUID()}`,
    place,
    {
      [conflicting]: { continuity: "separate", chronology: "conflict" },
      [same]: { continuity: "same" },
    },
  );

  const review = await processFully(page, report.id);

  expect(review.recommendation).toMatchObject({ kind: "match", candidateId: same });
  expect(ids(review.candidates)).toContain(conflicting);
});

test("a contributor who can't tell publishes the Report on its own without touching the possible match", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 65), lng: 140 };
  const possible = await publishedHappening(page, place);
  const before = await (await page.request.get(`/api/happenings/${possible}`)).json();
  const report = await submit(
    page,
    `Fencing is up along the remote path. ${randomUUID()}`,
    place,
    { [possible]: { continuity: "unknown" } },
  );
  const review = await processFully(page, report.id);
  expect(review.state).toBe("clarification");

  const answered = await page.request.post(`/api/reports/${report.id}/match`, {
    data: { choice: "unsure", candidateIdsShown: [possible] },
  });

  expect(answered.status()).toBe(200);
  const published = await answered.json();
  expect(published.state).toBe("published");
  expect(published.happeningId).toBe(report.id);
  const after = await (await page.request.get(`/api/happenings/${possible}`)).json();
  expect(after.reports).toEqual(before.reports);
  expect(after.observations).toEqual(before.observations);
  expect(after.account.claims.map((c: { statement: string }) => c.statement)).toEqual(
    before.account.claims.map((c: { statement: string }) => c.statement),
  );
});

test("repeating a can't-tell answer returns the same publication", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 68), lng: 140 };
  const possible = await publishedHappening(page, place);
  const report = await submit(
    page,
    `Fencing is up along the remote path. ${randomUUID()}`,
    place,
    { [possible]: { continuity: "unknown" } },
  );
  await processFully(page, report.id);
  const answer = { choice: "unsure", candidateIdsShown: [possible] };
  await page.request.post(`/api/reports/${report.id}/match`, { data: answer });

  const repeated = await page.request.post(`/api/reports/${report.id}/match`, {
    data: answer,
  });

  expect(repeated.status()).toBe(200);
  expect((await repeated.json()).happeningId).toBe(report.id);
  const detail = await (await page.request.get(`/api/happenings/${report.id}`)).json();
  expect(detail.reports).toHaveLength(1);
});

type Statement = { source: string; kind: string; reportId: string; displayName: string | null };
type Connection = { happeningId: string; statements: Statement[] };
async function connections(page: import("@playwright/test").Page, id: string) {
  const detail = await (await page.request.get(`/api/happenings/${id}`)).json();
  return detail.connections as Connection[];
}
const said = (c: Connection) =>
  c.statements.map((s) => `${s.source}:${s.kind}:${s.displayName ?? "-"}`).sort();

test("a can't-tell answer shows the connection on both Happenings with who suggested it", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 74), lng: 140 };
  const possible = await publishedHappening(page, place);
  const report = await submit(
    page,
    `Fencing is up along the remote path. ${randomUUID()}`,
    place,
    { [possible]: { continuity: "unknown" } },
  );
  await processFully(page, report.id);
  await page.request.post(`/api/reports/${report.id}/match`, {
    data: { choice: "unsure", candidateIdsShown: [possible] },
  });

  const fromNew = await connections(page, report.id);
  const fromPossible = await connections(page, possible);

  expect(fromNew.map((c) => c.happeningId)).toEqual([possible]);
  expect(fromPossible.map((c) => c.happeningId)).toEqual([report.id]);
  expect(said(fromNew[0])).toEqual([
    "automatic_matching:possibly_same:-",
    "contributor:unsure:Test Neighbor",
  ]);
  expect(fromNew[0].statements.every((s) => s.reportId === report.id)).toBe(true);
});

test("saying the Report is different is shown beside the automatic suggestion, not instead of it", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 76), lng: 140 };
  const possible = await publishedHappening(page, place);
  const report = await submit(
    page,
    `Fencing is up along the remote path. ${randomUUID()}`,
    place,
    { [possible]: { continuity: "unknown" } },
  );
  await processFully(page, report.id);
  await page.request.post(`/api/reports/${report.id}/match`, {
    data: { choice: "create_new", candidateIdsShown: [possible] },
  });

  const [connection] = await connections(page, possible);

  expect(connection.happeningId).toBe(report.id);
  expect(said(connection)).toEqual([
    "automatic_matching:possibly_same:-",
    "contributor:different:Test Neighbor",
  ]);
});

test("a Report confirmed into one Happening connects it with an unknown alternative", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 78), lng: 150 };
  const same = await publishedHappening(page, place);
  const unknown = await publishedHappening(page, place);
  const report = await submit(
    page,
    `The remote path barrier is still up. ${randomUUID()}`,
    place,
    { [same]: { continuity: "same" }, [unknown]: { continuity: "unknown" } },
  );
  const review = await processFully(page, report.id);
  await page.request.post(`/api/reports/${report.id}/match`, {
    data: { choice: "match", candidateId: same, candidateIdsShown: ids(review.candidates) },
  });

  const [connection] = await connections(page, same);

  expect(connection.happeningId).toBe(unknown);
  expect(said(connection)).toEqual(["automatic_matching:possibly_same:-"]);
  expect(connection.statements[0].reportId).toBe(report.id);
});

test("one Report graded the same as two Happenings connects those two Happenings", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 80), lng: 150 };
  const first = await publishedHappening(page, place);
  const second = await publishedHappening(page, place);
  const report = await submit(
    page,
    `The remote path barrier is still up. ${randomUUID()}`,
    place,
    { [first]: { continuity: "same" }, [second]: { continuity: "same" } },
  );
  const review = await processFully(page, report.id);
  expect(review.state).toBe("clarification");
  await page.request.post(`/api/reports/${report.id}/match`, {
    data: { choice: "unsure", candidateIdsShown: ids(review.candidates) },
  });

  const fromFirst = await connections(page, first);

  expect(fromFirst.map((c) => c.happeningId).sort()).toEqual([report.id, second].sort());
});

test("a new connection adds one uncertainty item to each Shared Account without changing claims", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 82), lng: 150 };
  const possible = await publishedHappening(page, place);
  const before = await (await page.request.get(`/api/happenings/${possible}`)).json();
  const report = await submit(
    page,
    `Fencing is up along the remote path. ${randomUUID()}`,
    place,
    { [possible]: { continuity: "unknown" } },
  );
  await processFully(page, report.id);
  await page.request.post(`/api/reports/${report.id}/match`, {
    data: { choice: "unsure", candidateIdsShown: [possible] },
  });

  const after = await (await page.request.get(`/api/happenings/${possible}`)).json();
  const created = await (await page.request.get(`/api/happenings/${report.id}`)).json();

  expect(after.account.version).toBe(before.account.version + 1);
  expect(after.account.origin).toBe("connection_update");
  expect(after.account.claims.map((c: { statement: string }) => c.statement)).toEqual(
    before.account.claims.map((c: { statement: string }) => c.statement),
  );
  expect(after.account.uncertainty).toEqual([
    ...before.account.uncertainty,
    `Another Happening nearby may describe the same situation: ${created.title}. Not confirmed.`,
  ]);
  expect(created.account.uncertainty).toContain(
    `Another Happening nearby may describe the same situation: ${after.title}. Not confirmed.`,
  );
});

test("every possible match is offered; can't tell needs the first five, different needs all", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 84), lng: 150 };
  const possible: string[] = [];
  for (let i = 0; i < 8; i++) possible.push(await publishedHappening(page, place));
  const grades = Object.fromEntries(possible.map((id) => [id, { continuity: "unknown" }]));
  const unsure = await submit(page, `Fencing is up. ${randomUUID()}`, place, grades);
  const different = await submit(page, `Fencing is up again. ${randomUUID()}`, place, grades);
  const review = await processFully(page, unsure.id);
  await processFully(page, different.id);
  const offered = ids(review.candidates);
  expect(offered.sort()).toEqual([...possible].sort());
  const firstFive = ids(review.candidates).slice(0, 5);

  const fourForUnsure = await page.request.post(`/api/reports/${unsure.id}/match`, {
    data: { choice: "unsure", candidateIdsShown: firstFive.slice(0, 4) },
  });
  const fiveForUnsure = await page.request.post(`/api/reports/${unsure.id}/match`, {
    data: { choice: "unsure", candidateIdsShown: firstFive },
  });
  // That publication changed the candidates' accounts, so the other review refreshes.
  const refreshed = await (
    await page.request.post(`/api/reports/${different.id}/process`, {
      data: { refresh: true },
    })
  ).json();
  const reoffered = ids(refreshed.candidates);
  const tooFewForDifferent = await page.request.post(`/api/reports/${different.id}/match`, {
    data: { choice: "create_new", candidateIdsShown: reoffered.slice(0, 5) },
  });
  const allForDifferent = await page.request.post(`/api/reports/${different.id}/match`, {
    data: { choice: "create_new", candidateIdsShown: reoffered },
  });

  expect(fourForUnsure.status()).toBe(400);
  expect(fiveForUnsure.status()).toBe(200);
  expect(tooFewForDifferent.status()).toBe(409);
  expect(allForDifferent.status()).toBe(200);
});

test("a connection to a Happening checked on only some of its Reports says so", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 86), lng: 150 };
  const busy = await publishedHappening(page, place);
  for (let i = 0; i < 3; i++) await joinHappening(page, busy, place);
  const report = await submit(
    page,
    `Fencing is up along the remote path. ${randomUUID()}`,
    place,
    { [busy]: { continuity: "unknown" } },
  );
  await processFully(page, report.id);
  await page.request.post(`/api/reports/${report.id}/match`, {
    data: { choice: "unsure", candidateIdsShown: [busy] },
  });

  const [connection] = await connections(page, report.id);
  const automatic = connection.statements.find((s) => s.source === "automatic_matching");

  expect(automatic).toMatchObject({ partialEvidence: true });
});
