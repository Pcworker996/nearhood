import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

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
}) => {
  test.setTimeout(60000);
  await signIn(page);
  const lat = -12 + Math.random();
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
}) => {
  test.setTimeout(60000);
  await signIn(page);
  const lat = 15 + Math.random();
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
}) => {
  await signIn(page);
  const lat = -25 + Math.random();
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
}) => {
  await signIn(page);
  const lat = -55 + Math.random();
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
}) => {
  await signIn(page);
  const lat = -65 + Math.random();
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
}) => {
  await signIn(page);
  const originalText =
    "I cannot verify the cause. A branch blocks the north path.";
  const first = await save(page, originalText, "success", {
    lat: -75 + Math.random(),
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
