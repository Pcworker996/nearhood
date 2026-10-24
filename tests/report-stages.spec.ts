import { randomUUID } from "node:crypto";
import { expect, test, type TestInfo } from "@playwright/test";
import { projectLatitude } from "./project-coordinates";
import { leaseSeconds, modelTimeoutMs } from "./server-timing";

const fixture = "http://127.0.0.1:3101";
type Page = import("@playwright/test").Page;

async function modelCalls(page: Page, text: string) {
  return (
    await page.request.get(`${fixture}/calls?text=${encodeURIComponent(text)}`)
  ).json();
}

async function saveHeld(page: Page, label: string, testInfo: TestInfo) {
  const originalText = `A cart blocks the ${label} ramp. ${randomUUID()}`;
  const report = await save(page, originalText, "success", {
    lat: projectLatitude(testInfo, 33),
    lng: -160,
  });
  await page.request.post(`${fixture}/control`, {
    data: { text: originalText, mode: "success", hold: 1 },
  });
  const started = Date.now();
  const held = page.request.post(`/api/reports/${report.id}/process`);
  await expect
    .poll(async () => (await modelCalls(page, originalText)).extraction)
    .toBe(1);
  return { id: report.id as string, originalText, held, started };
}

async function release(page: Page, text: string) {
  await page.request.post(`${fixture}/release`, { data: { text } });
}

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/?contribute=1");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByRole("button", { name: "Submit Report", exact: true }),
  ).toBeVisible();
}

async function save(
  page: import("@playwright/test").Page,
  originalText: string,
  mode: string,
  overrides = {},
) {
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text: originalText, mode, candidateId: "bridge" },
  });
  return (
    await page.request.post("/api/reports", {
      data: {
        requestKey: randomUUID(),
        originalText,
        displayName: "Test Neighbor",
        lat: 42.3328,
        lng: -83.0457,
        locationName: "Bridge",
        observedAt: null,
        provenance: "firsthand",
        sourceUrl: null,
        candidateId: null,
        ...overrides,
      },
    })
  ).json();
}

test("an overflowing candidate pool cannot turn no-match judgments into a new Happening", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await signIn(page);
  const lat = projectLatitude(testInfo, -12);
  for (let i = 0; i < 21; i++) {
    const report = await save(
      page,
      `A separate situation number ${i} is reported.`,
      "success",
      { lat, lng: 70 },
    );
    await page.request.post(`/api/reports/${report.id}/process`);
    const published = await (
      await page.request.post(`/api/reports/${report.id}/process`)
    ).json();
    expect(published.state).toBe("published");
  }
  const report = await save(
    page,
    "Another situation is reported in this dense area.",
    "success",
    { lat, lng: 70 },
  );
  await page.request.post(`/api/reports/${report.id}/process`);
  const result = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(result.state).toBe("clarification");
  expect(result.pendingReason).toBe("incomplete_coverage");
  expect(result.candidateIds).toHaveLength(20);
  expect(result.happeningId).toBeNull();
});

test("an oversized evidence packet stays unassigned without losing the saved extraction", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await signIn(page);
  const lat = projectLatitude(testInfo, 15);
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5;
    const originalText = `A branch blocks sector ${i}${" with debris".repeat(650)}.`;
    const report = await save(page, originalText, "success", {
      lat: lat + Math.cos(angle) * 0.011,
      lng: 90 + Math.sin(angle) * 0.0115,
    });
    await page.request.post(`/api/reports/${report.id}/process`);
    expect(
      (
        await (
          await page.request.post(`/api/reports/${report.id}/process`)
        ).json()
      ).state,
    ).toBe("published");
  }
  const report = await save(
    page,
    "A branch may still block one of the sectors.",
    "success",
    { lat, lng: 90 },
  );
  await page.request.post(`/api/reports/${report.id}/process`);
  const result = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(result.state).toBe("clarification");
  expect(result.pendingReason).toBe("evidence_budget");
  expect(result.extractionReady).toBe(true);
  expect(result.happeningId).toBeNull();
});

test("a saved extraction survives reload and matching failure without repeating extraction", async ({
  page,
}) => {
  await page.goto("/?contribute=1");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByRole("button", { name: "Submit Report", exact: true }),
  ).toBeVisible();
  const originalText = `A branch blocks the remote trail. ${randomUUID()}`;
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text: originalText, mode: "matching-failure" },
  });
  const report = await (
    await page.request.post("/api/reports", {
      data: {
        requestKey: randomUUID(),
        originalText,
        displayName: "Test Neighbor",
        lat: -40,
        lng: 100,
        locationName: "Remote trail",
        observedAt: null,
        provenance: "firsthand",
        sourceUrl: null,
        candidateId: null,
      },
    })
  ).json();
  const extracted = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(extracted.processingStage).toBe("matching");
  expect(extracted.extractionReady).toBe(true);
  expect(extracted.nextAction).toBe("process");
  expect(extracted.happeningId).toBeNull();
  const recovered = await (
    await page.request.get(`/api/reports/${report.id}`)
  ).json();
  expect(recovered.extractionReady).toBe(true);
  const failed = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(failed.state).toBe("pending");
  expect(failed.processingStage).toBe("matching");
  expect(failed.extractionReady).toBe(true);
  expect(failed.originalText).toBe(originalText);
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text: originalText, mode: "extraction-failure" },
  });
  const retried = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(retried.state).toBe("published");
  expect(retried.happeningId).toBe(report.id);
});

test("candidate comparison reaches a relevant Happening beyond the old nearest five", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const lat = projectLatitude(testInfo, -25);
  let targetId = "";
  for (let i = 0; i < 6; i++) {
    const seeded = await save(
      page,
      `A path segment in sector ${i} is blocked.`,
      "success",
      { lat: lat + i * 0.001, lng: 40, locationName: `Sector ${i}` },
    );
    await page.request.post(`/api/reports/${seeded.id}/process`);
    const published = await (
      await page.request.post(`/api/reports/${seeded.id}/process`)
    ).json();
    expect(published.state).toBe("published");
    targetId = seeded.id;
  }
  const originalText = "The same path at sector five is still blocked.";
  const report = await save(page, originalText, "match", {
    lat,
    lng: 40,
    locationName: "Remote sectors",
  });
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text: originalText, mode: "match", candidateId: targetId },
  });
  await page.request.post(`/api/reports/${report.id}/process`);
  const review = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(review.candidateIds.indexOf(targetId)).toBeGreaterThan(4);
  expect(review.recommendation.candidateId).toBe(targetId);
  expect(review.candidates[0].id).toBe(targetId);
  expect(review.happeningId).toBeNull();
});

test("a changed candidate account rejects an old choice until matching is refreshed", async ({
  page,
}) => {
  await signIn(page);
  const first = await save(
    page,
    "Orange barriers remain at the bridge entrance.",
    "match",
  );
  await page.request.post(`/api/reports/${first.id}/process`);
  await page.request.post(`/api/reports/${first.id}/process`);
  const second = await save(
    page,
    "The same bridge barriers are still present.",
    "match",
  );
  await page.request.post(`/api/reports/${second.id}/process`);
  await page.request.post(`/api/reports/${second.id}/process`);
  const choice = {
    choice: "match",
    candidateId: "bridge",
    candidateIdsShown: ["bridge"],
  };
  expect(
    (
      await page.request.post(`/api/reports/${second.id}/match`, {
        data: choice,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post(`/api/reports/${first.id}/match`, {
        data: choice,
      })
    ).status(),
  ).toBe(409);
  const refresh = await page.request.post(`/api/reports/${first.id}/process`, {
    data: { refresh: true },
  });
  expect((await refresh.json()).state).toBe("match_review");
  expect(
    (
      await page.request.post(`/api/reports/${first.id}/match`, {
        data: choice,
      })
    ).status(),
  ).toBe(200);
});

test("separate situations stay saved with an explanation and never acquire membership", async ({
  page,
}) => {
  await page.goto("/?contribute=1");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByRole("button", { name: "Submit Report", exact: true }),
  ).toBeVisible();
  const originalText =
    "The bridge is blocked. Across town, a streetlamp is broken.";
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text: originalText, mode: "multiple" },
  });
  const report = await (
    await page.request.post("/api/reports", {
      data: {
        requestKey: randomUUID(),
        originalText,
        displayName: "Test Neighbor",
        lat: 42.3328,
        lng: -83.0457,
        locationName: "Bridge",
        observedAt: null,
        provenance: "firsthand",
        sourceUrl: null,
        candidateId: "bridge",
      },
    })
  ).json();
  const result = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(result.state).toBe("clarification");
  expect(result.pendingReason).toBe("separate_occurrences");
  expect(result.happeningId).toBeNull();
  expect(
    (await page.request.get(`/api/happenings/${report.id}`)).status(),
  ).toBe(404);
  await page.goto(`/?contribute=1&report=${report.id}`);
  await expect(
    page.getByText(
      "Your report describes separate situations. We’ve saved it, but haven’t added it to a Happening.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Report saved · not added to a Happening", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Could you clarify?")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(originalText, { exact: true })).toBeVisible();
});

test("rejecting five displayed suggestions cannot discard an unshown plausible match", async ({
  page,
}) => {
  await page.goto("/?contribute=1");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByRole("button", { name: "Submit Report", exact: true }),
  ).toBeVisible();
  const originalText = `The nearby path is blocked. ${randomUUID()}`;
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text: originalText, mode: "many-matches" },
  });
  const report = await (
    await page.request.post("/api/reports", {
      data: {
        requestKey: randomUUID(),
        originalText,
        displayName: "Test Neighbor",
        lat: 42.3328,
        lng: -83.0457,
        locationName: "Bridge",
        observedAt: null,
        provenance: "firsthand",
        sourceUrl: null,
        candidateId: null,
      },
    })
  ).json();
  await page.request.post(`/api/reports/${report.id}/process`);
  const review = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(review.state).toBe("clarification");
  expect(review.candidateIds.length).toBeGreaterThan(5);
  expect(review.candidates).toHaveLength(5);
  const rejected = await page.request.post(`/api/reports/${report.id}/match`, {
    data: {
      choice: "create_new",
      candidateIdsShown: review.candidates.map((c: { id: string }) => c.id),
    },
  });
  expect(rejected.status()).toBe(409);
  expect(
    (await (await page.request.get(`/api/reports/${report.id}`)).json())
      .happeningId,
  ).toBeNull();
});

test("concurrent empty-search publications cannot both create a Happening", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const lat = projectLatitude(testInfo, -55);
  const a = await save(
    page,
    `A tree blocks the remote trail. ${randomUUID()}`,
    "slow",
    { lat, lng: 10 },
  );
  const b = await save(
    page,
    `The same tree blocks the remote trail. ${randomUUID()}`,
    "slow",
    { lat, lng: 10 },
  );
  await Promise.all(
    [a, b].map((r) => page.request.post(`/api/reports/${r.id}/process`)),
  );
  const results = await Promise.all(
    [a, b].map(async (r) =>
      (await page.request.post(`/api/reports/${r.id}/process`)).json(),
    ),
  );
  expect(results.map((r) => r.state).sort()).toEqual(["pending", "published"]);
  expect(results.filter((r) => r.happeningId !== null)).toHaveLength(1);
  const unassigned = results.find((r) => r.state === "pending");
  expect(
    (await page.request.get(`/api/happenings/${unassigned.id}`)).status(),
  ).toBe(404);
});

test("omitted candidate evidence prevents unsupported new-Happening creation", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const lat = projectLatitude(testInfo, -65);
  const first = await save(
    page,
    "The tree fell. The north path is blocked. The south path is clear. The cause is unknown.",
    "success",
    { lat, lng: 20 },
  );
  await page.request.post(`/api/reports/${first.id}/process`);
  expect(
    (await (await page.request.post(`/api/reports/${first.id}/process`)).json())
      .state,
  ).toBe("published");
  const second = await save(page, "A branch blocks a nearby path.", "success", {
    lat,
    lng: 20,
  });
  await page.request.post(`/api/reports/${second.id}/process`);
  const review = await (
    await page.request.post(`/api/reports/${second.id}/process`)
  ).json();
  expect(review.state).toBe("clarification");
  expect(review.pendingReason).toBe("incomplete_coverage");
  expect(review.happeningId).toBeNull();
  expect(
    (
      await page.request.post(`/api/reports/${second.id}/match`, {
        data: { choice: "create_new", candidateIdsShown: [first.id] },
      })
    ).status(),
  ).toBe(409);
});

test("Observation support is an exact localized passage and invalid source IDs never publish", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const originalText =
    "I cannot verify the cause. A branch blocks the north path.";
  const first = await save(page, originalText, "success", {
    lat: projectLatitude(testInfo, -75),
    lng: 30,
  });
  await page.request.post(`/api/reports/${first.id}/process`);
  expect(
    (await (await page.request.post(`/api/reports/${first.id}/process`)).json())
      .state,
  ).toBe("published");
  const detail = await (
    await page.request.get(`/api/happenings/${first.id}`)
  ).json();
  expect(detail.observations).toHaveLength(2);
  for (const observation of detail.observations) {
    expect(observation.sourceSupport).toHaveLength(1);
    const support = observation.sourceSupport[0];
    expect(support.text).toBe(originalText.slice(support.start, support.end));
    expect(observation.describedState).toBe(originalText);
  }
  expect(
    detail.observations
      .map((o: { sourceSupport: { text: string }[] }) =>
        o.sourceSupport[0].text.trim(),
      )
      .sort(),
  ).toEqual(
    ["I cannot verify the cause.", "A branch blocks the north path."].sort(),
  );
  const invalid = await save(page, "A lamp is broken.", "bad-source");
  const result = await (
    await page.request.post(`/api/reports/${invalid.id}/process`)
  ).json();
  expect(result.state).toBe("pending");
  expect(result.extractionReady).toBe(false);
  expect(result.happeningId).toBeNull();
});

test("a late extraction cannot replace the checkpoint saved by the request that took over its lease", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await signIn(page);
  const { id, originalText, held } = await saveHeld(page, "late", testInfo);
  await page.waitForTimeout((leaseSeconds + 1) * 1000);
  const takeover = await (
    await page.request.post(`/api/reports/${id}/process`)
  ).json();
  expect(takeover.state).toBe("saved");
  expect(takeover.extractionReady).toBe(true);
  await release(page, originalText);
  const late = await (await held).json();
  expect(late).toEqual(
    await (await page.request.get(`/api/reports/${id}`)).json(),
  );
  expect(await modelCalls(page, originalText)).toEqual({
    extraction: 2,
    matching: 0,
  });
  const published = await (
    await page.request.post(`/api/reports/${id}/process`)
  ).json();
  expect(published.state).toBe("published");
  const detail = await (await page.request.get(`/api/happenings/${id}`)).json();
  expect(detail.observations.length).toBeGreaterThan(0);
  for (const observation of detail.observations)
    expect(observation.subject).toMatch(/\(call 2\)$/);
  expect(await modelCalls(page, originalText)).toEqual({
    extraction: 2,
    matching: 1,
  });
});

test("each processing request makes one model call across a full journey", async ({
  page,
}) => {
  await signIn(page);
  const originalText = `Orange barriers block the bridge path. ${randomUUID()}`;
  const report = await save(page, originalText, "match");
  const posts = [
    await page.request.post(`/api/reports/${report.id}/process`),
    await page.request.post(`/api/reports/${report.id}/process`),
    await page.request.post(`/api/reports/${report.id}/process`, {
      data: { refresh: true },
    }),
  ];
  expect((await posts[1].json()).state).toBe("match_review");
  expect((await posts[2].json()).state).toBe("match_review");
  const calls = await modelCalls(page, originalText);
  expect(calls).toEqual({ extraction: 1, matching: 2 });
  expect(calls.extraction + calls.matching).toBe(posts.length);
});

test("an expired lease shows interrupted extraction with a retry", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await signIn(page);
  const { id, originalText, held } = await saveHeld(
    page,
    "interrupted",
    testInfo,
  );
  await page.waitForTimeout((leaseSeconds + 1) * 1000);
  expect(
    await (await page.request.get(`/api/reports/${id}`)).json(),
  ).toMatchObject({
    state: "pending",
    pendingReason: "extraction_interrupted",
    nextAction: "retry",
  });
  await release(page, originalText);
  expect((await (await held).json()).pendingReason).toBe(
    "extraction_interrupted",
  );
});

test("a provider that never answers leaves the Report pending after the model timeout", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await signIn(page);
  const { originalText, held, started } = await saveHeld(
    page,
    "timeout",
    testInfo,
  );
  const result = await (await held).json();
  const elapsed = Date.now() - started;
  await release(page, originalText);
  expect(elapsed).toBeGreaterThanOrEqual(modelTimeoutMs);
  expect(elapsed).toBeLessThan(modelTimeoutMs + 5000);
  expect(result).toMatchObject({
    state: "pending",
    pendingReason: "extraction_failed",
    nextAction: "retry",
  });
});

async function publishedHappening(
  page: Page,
  lat: number,
  lng: number,
  observedAt: string | null,
) {
  const originalText = `A barrier blocks the remote path. ${randomUUID()}`;
  const report = await save(page, originalText, "success", {
    lat,
    lng,
    observedAt,
    locationName: "Remote path",
  });
  await page.request.post(`/api/reports/${report.id}/process`);
  const published = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(published.state).toBe("published");
  expect(published.happeningId).toBe(report.id);
  return published;
}

test("a conflicting separate assessment stays unassigned until that Happening is shown", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await signIn(page);
  const lat = projectLatitude(testInfo, 70);
  const lng = 16;
  const conflicting = await publishedHappening(page, lat, lng, null);
  const other = await publishedHappening(page, lat, lng, null);
  const before = await (
    await page.request.get(`/api/happenings/${conflicting.happeningId}`)
  ).json();
  const originalText = `The remote barrier is still across the path. ${randomUUID()}`;
  const report = await save(page, originalText, "separate-conflict", {
    lat,
    lng,
    locationName: "Remote path",
  });
  await page.request.post("http://127.0.0.1:3101/control", {
    data: {
      text: originalText,
      mode: "separate-conflict",
      candidateId: conflicting.happeningId,
    },
  });
  await page.request.post(`/api/reports/${report.id}/process`);
  const review = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(review.state).toBe("clarification");
  expect(review.happeningId).toBeNull();
  expect(review.candidateIds).toContain(conflicting.happeningId);
  expect(
    review.candidates.some(
      (candidate: { id: string }) => candidate.id === conflicting.happeningId,
    ),
  ).toBe(true);
  expect(
    (await page.request.get(`/api/happenings/${report.id}`)).status(),
  ).toBe(404);
  const during = await (
    await page.request.get(`/api/happenings/${conflicting.happeningId}`)
  ).json();
  expect(during.account).toEqual(before.account);
  expect(during.reports).toHaveLength(before.reports.length);
  expect(during.observations).toHaveLength(before.observations.length);
  expect(
    (
      await page.request.post(`/api/reports/${report.id}/match`, {
        data: {
          choice: "create_new",
          candidateIdsShown: [other.happeningId],
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (await page.request.get(`/api/happenings/${report.id}`)).status(),
  ).toBe(404);
  const created = await page.request.post(`/api/reports/${report.id}/match`, {
    data: {
      choice: "create_new",
      candidateIdsShown: [conflicting.happeningId],
    },
  });
  expect(created.status()).toBe(200);
  expect((await created.json()).happeningId).toBe(report.id);
  const after = await (
    await page.request.get(`/api/happenings/${conflicting.happeningId}`)
  ).json();
  expect(after.account).toEqual(before.account);
  expect(after.reports).toHaveLength(before.reports.length);
  expect(after.observations).toHaveLength(before.observations.length);
});

test("a Happening observed 31 days earlier remains a candidate and stays unassigned", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await signIn(page);
  const lat = projectLatitude(testInfo, 72);
  const lng = 18;
  const old = await publishedHappening(
    page,
    lat,
    lng,
    new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
  );
  const originalText = `The remote barrier has returned. ${randomUUID()}`;
  const report = await save(page, originalText, "uncertain", {
    lat,
    lng,
    observedAt: new Date().toISOString(),
    locationName: "Remote path",
  });
  await page.request.post("http://127.0.0.1:3101/control", {
    data: {
      text: originalText,
      mode: "uncertain",
      candidateId: old.happeningId,
    },
  });
  await page.request.post(`/api/reports/${report.id}/process`);
  const review = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(review.candidateIds).toContain(old.happeningId);
  expect(review.state).toBe("clarification");
  expect(review.happeningId).toBeNull();
});
