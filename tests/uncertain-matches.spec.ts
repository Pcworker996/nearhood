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

test("the clarification page offers can't tell and different, and can't tell publishes", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 88), lng: 150 };
  const possible = await publishedHappening(page, place);
  const report = await submit(
    page,
    `Fencing is up along the remote path. ${randomUUID()}`,
    place,
    { [possible]: { continuity: "unknown" } },
  );
  await processFully(page, report.id);

  await page.goto(`/?contribute=1&report=${report.id}`);
  const clarification = page.getByRole("region", { name: "Matching clarification" });
  await expect(
    clarification.getByRole("button", {
      name: "My Report describes a different situation from these",
    }),
  ).toBeVisible();
  await clarification
    .getByRole("button", { name: "I can't tell. Publish my Report on its own for now" })
    .click();

  await expect(page.getByText("Report saved · account published", { exact: true })).toBeVisible();
  const decided = await (await page.request.get(`/api/reports/${report.id}`)).json();
  expect(decided.happeningId).toBe(report.id);
});

test("a Happening page lists a possible connection with each statement and its Report", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 89), lng: 150 };
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
  const created = await (await page.request.get(`/api/happenings/${report.id}`)).json();

  await page.goto(`/?happening=${possible}`);
  const block = page.getByRole("region", { name: `Possible connection with ${created.title}` });

  await expect(block).toBeVisible();
  await expect(
    block.getByText("Test Neighbor couldn't tell whether their Report is about the same situation", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(block.getByText("Automatic matching found a Report may describe both", { exact: false })).toBeVisible();
  await expect(block.getByText("Not confirmed.", { exact: false })).toBeVisible();
  await expect(block.getByRole("link", { name: `View ${created.title}` })).toHaveAttribute(
    "href",
    `/?happening=${report.id}`,
  );
});

async function unsureConnection(
  page: import("@playwright/test").Page,
  place: { lat: number; lng: number },
) {
  const existing = await publishedHappening(page, place);
  const report = await submit(
    page,
    `Fencing is up along the remote path. ${randomUUID()}`,
    place,
    { [existing]: { continuity: "unknown" } },
  );
  await processFully(page, report.id);
  await page.request.post(`/api/reports/${report.id}/match`, {
    data: { choice: "unsure", candidateIdsShown: [existing] },
  });
  return { existing, reportId: report.id };
}

test("moving my only Report into a connected Happening redirects the emptied one", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, -2), lng: 150 };
  const { existing, reportId } = await unsureConnection(page, place);
  const before = await (await page.request.get(`/api/happenings/${existing}`)).json();

  const moved = await page.request.post(`/api/reports/${reportId}/move`, {
    data: { toHappeningId: existing },
  });

  expect(moved.status()).toBe(200);
  expect((await moved.json()).happeningId).toBe(existing);
  const target = await (await page.request.get(`/api/happenings/${existing}`)).json();
  expect(target.reports.map((r: { id: string }) => r.id)).toContain(reportId);
  expect(target.account.version).toBe(before.account.version + 1);
  expect(target.account.origin).toBe("membership_change");
  expect(target.connections).toEqual([]);
  const emptied = await (await page.request.get(`/api/happenings/${reportId}`)).json();
  expect(emptied).toEqual({ redirectTo: existing });
});

test("moving my Report back restores the emptied Happening with its connection", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, -4), lng: 150 };
  const { existing, reportId } = await unsureConnection(page, place);
  const statementsBefore = said((await connections(page, existing))[0]);
  await page.request.post(`/api/reports/${reportId}/move`, {
    data: { toHappeningId: existing },
  });

  const back = await page.request.post(`/api/reports/${reportId}/move`, {
    data: { toHappeningId: reportId },
  });

  expect(back.status()).toBe(200);
  const restored = await (await page.request.get(`/api/happenings/${reportId}`)).json();
  expect(restored.reports.map((r: { id: string }) => r.id)).toEqual([reportId]);
  expect(restored.account.claims.length).toBeGreaterThan(0);
  const target = await (await page.request.get(`/api/happenings/${existing}`)).json();
  expect(target.reports.map((r: { id: string }) => r.id)).not.toContain(reportId);
  expect(said(target.connections[0])).toEqual(statementsBefore);
});

test("a Report moves only by its contributor and only to a connected Happening", async ({
  page,
  browser,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, -6), lng: 150 };
  const { existing, reportId } = await unsureConnection(page, place);
  const unconnected = await publishedHappening(page, {
    lat: projectLatitude(testInfo, -8),
    lng: 150,
  });
  const other = await (await browser.newContext()).newPage();
  await signIn(other);

  const byOther = await other.request.post(`/api/reports/${reportId}/move`, {
    data: { toHappeningId: existing },
  });
  const toUnconnected = await page.request.post(`/api/reports/${reportId}/move`, {
    data: { toHappeningId: unconnected },
  });

  expect(byOther.status()).toBe(404);
  expect(toUnconnected.status()).toBe(409);
  const detail = await (await page.request.get(`/api/happenings/${reportId}`)).json();
  expect(detail.reports.map((r: { id: string }) => r.id)).toEqual([reportId]);
});

test("moving my Report out of a shared Happening leaves the other Reports' claims behind", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, -10), lng: 150 };
  const { existing, reportId } = await unsureConnection(page, place);
  await joinHappening(page, reportId, place);
  const sharedBefore = await (await page.request.get(`/api/happenings/${reportId}`)).json();
  const targetBefore = await (await page.request.get(`/api/happenings/${existing}`)).json();

  await page.request.post(`/api/reports/${reportId}/move`, {
    data: { toHappeningId: existing },
  });

  const shared = await (await page.request.get(`/api/happenings/${reportId}`)).json();
  const target = await (await page.request.get(`/api/happenings/${existing}`)).json();
  expect(shared.reports).toHaveLength(sharedBefore.reports.length - 1);
  expect(shared.account.origin).toBe("membership_change");
  expect(shared.account.claims).toHaveLength(sharedBefore.account.claims.length - 1);
  expect(target.account.claims).toHaveLength(targetBefore.account.claims.length + 1);
  expect(shared.connections.map((c: { happeningId: string }) => c.happeningId)).toEqual([existing]);
});

test("a contributor moves their Report from its page, and the old link opens where it went", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, -14), lng: 150 };
  const { existing, reportId } = await unsureConnection(page, place);
  const target = await (await page.request.get(`/api/happenings/${existing}`)).json();

  await page.goto(`/?contribute=1&report=${reportId}`);
  await page.getByRole("button", { name: `Move my Report to ${target.title}` }).click();
  await expect
    .poll(async () => (await (await page.request.get(`/api/reports/${reportId}`)).json()).happeningId)
    .toBe(existing);

  await page.goto(`/?happening=${reportId}`);
  await expect(page.getByRole("heading", { level: 1, name: target.title })).toBeVisible();
  await expect(
    page.getByText("The Happening you opened was moved into this one.", { exact: true }),
  ).toBeVisible();
});
