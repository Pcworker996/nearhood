import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/?contribute=1");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByRole("button", { name: "Submit Report", exact: true }),
  ).toBeVisible();
}

function submission(text: string, overrides = {}) {
  return {
    requestKey: randomUUID(),
    originalText: text,
    displayName: "Test Neighbor",
    lat: 42.335,
    lng: -83.05,
    locationName: "North path",
    observedAt: null,
    provenance: "firsthand",
    sourceUrl: null,
    candidateId: null,
    ...overrides,
  };
}

// Confirmed seam: real application HTTP API and PostgreSQL, with external
// authentication/model services controlled by HTTP fixtures in later journeys.
test("contributors are not asked to classify a Report as new", async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByLabel("This is a clearly new situation")).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Submit Report", exact: true }),
  ).toBeVisible();
});

test("a semantic match is recommended with evidence but attached only after confirmation", async ({
  page,
}) => {
  await signIn(page);
  const text = "The stretch class is taking place near the west gate.";
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text, mode: "match", candidateId: "picnic" },
  });
  const before = await (
    await page.request.get("/api/happenings/picnic")
  ).json();
  const report = await (
    await page.request.post("/api/reports", {
      data: submission(text, {
        lat: 42.3352,
        lng: -83.0513,
        locationName: "Canal Green west gate",
        observedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        candidateId: "picnic",
      }),
    })
  ).json();
  const reviewed = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(reviewed.state).toBe("match_review");
  expect(reviewed.candidateIds).toContain("picnic");
  expect(reviewed.candidates).toHaveLength(5);
  expect(reviewed.candidates[0].id).toBe("picnic");
  expect(
    reviewed.candidates.find(
      (candidate: { id: string }) => candidate.id === "picnic",
    ).category,
  ).toBe("activity");
  expect(reviewed.recommendation).toEqual({
    kind: "match",
    candidateId: "picnic",
    evidenceIds: expect.any(Array),
  });
  const picnic = reviewed.candidates.find(
    (candidate: { id: string }) => candidate.id === "picnic",
  );
  const citedEvidence = picnic.evidence.find(
    (item: { observationId: string }) =>
      reviewed.recommendation.evidenceIds.includes(item.observationId),
  );
  expect(citedEvidence?.originalText).toBeTruthy();
  expect(
    (
      await page.request.post(`/api/reports/${report.id}/match`, {
        data: {
          choice: "match",
          candidateId: "not-supplied",
          candidateIdsShown: ["not-supplied"],
        },
      })
    ).status(),
  ).toBe(400);
  const afterReview = await (
    await page.request.get("/api/happenings/picnic")
  ).json();
  expect(afterReview.account).toEqual(before.account);
  expect(afterReview.reports).toHaveLength(before.reports.length);

  await page.goto(`/?contribute=1&report=${report.id}`);
  await expect(
    page.getByText("Suggested Happening", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Match review" })
      .getByText(citedEvidence.originalText, { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Match review" })
      .getByText(
        citedEvidence.provenance === "source_based"
          ? "Source-based · contributor-declared"
          : "Firsthand · contributor-declared",
      ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use this Happening", exact: true })
    .click();
  await expect(
    page.getByText("Report saved · account published", { exact: true }),
  ).toBeVisible();
  const attached = await (
    await page.request.get("/api/happenings/picnic")
  ).json();
  expect(attached.reports).toHaveLength(before.reports.length + 1);
  expect(
    attached.reports.map((item: { originalText: string }) => item.originalText),
  ).toContain(text);
  expect(attached.account.version).toBe(before.account.version + 1);
  const repeated = await (
    await page.request.post(`/api/reports/${report.id}/match`, {
      data: {
        choice: "match",
        candidateId: "picnic",
        candidateIdsShown: ["picnic"],
      },
    })
  ).json();
  expect(repeated.state).toBe("published");
  expect(
    (await (await page.request.get("/api/happenings/picnic")).json()).account
      .version,
  ).toBe(before.account.version + 1);
});

test("an uncertain match asks a focused question and records the contributor's answer", async ({
  page,
}) => {
  await signIn(page);
  const text = "A barrier is near the footbridge entrance.";
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text, mode: "uncertain", candidateId: "bridge" },
  });
  const report = await (
    await page.request.post("/api/reports", {
      data: submission(text, {
        lat: 42.336,
        lng: -83.0457,
        locationName: "North footbridge approach",
        observedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        candidateId: "bridge",
      }),
    })
  ).json();
  const clarification = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(clarification.state).toBe("clarification");
  expect(clarification.recommendation.kind).toBe("uncertain");
  expect(
    (await page.request.get(`/api/happenings/${report.id}`)).status(),
  ).toBe(404);

  await page.goto(`/?contribute=1&report=${report.id}`);
  await expect(
    page.getByText("Could you clarify?", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Was this at the footbridge, or at a different nearby crossing?",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "None of these describe what I reported" })
    .click();
  await expect(
    page.getByText("Report saved · account published", { exact: true }),
  ).toBeVisible();
  const decided = await (
    await page.request.get(`/api/reports/${report.id}`)
  ).json();
  expect(decided.matchingOutcome).toBe("create_new");
  expect(decided.decisionCandidateIds).toEqual(decided.candidateIds);
  expect(decided.happeningId).toBe(report.id);
});

test("a successful empty nearby search creates a Happening without a newness question", async ({
  page,
}) => {
  await signIn(page);
  const text = "A branch blocks the rural trail.";
  const lat = -60 + Math.random() * 120;
  const lng = -180 + Math.random() * 360;
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text, mode: "uncertain" },
  });
  const report = await (
    await page.request.post("/api/reports", {
      data: submission(text, {
        lat,
        lng,
        locationName: `Remote test location ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
        observedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }),
    })
  ).json();
  const processed = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(processed.state).toBe("published");
  expect(processed.candidateIds).toEqual([]);
  expect(processed.matchingOutcome).toBe("create_new");
  expect(processed.happeningId).toBe(report.id);
  expect(
    (await page.request.get(`/api/happenings/${report.id}`)).status(),
  ).toBe(200);
});

test("public readers can browse but cannot submit or process Reports", async ({
  request,
}) => {
  const browse = await request.get(
    "/api/happenings?west=-83.2&south=42.2&east=-82.9&north=42.5",
  );
  expect(browse.status()).toBe(200);
  const save = await request.post("/api/reports", {
    data: { originalText: "A fallen tree blocks the path." },
  });
  expect(save.status()).toBe(401);
  const process = await request.post("/api/reports/not-mine/process", {
    data: {},
  });
  expect(process.status()).toBe(401);
});

test("a Google contributor keeps a draft and chosen name, then reloads a saved Report after processing failure", async ({
  page,
}, testInfo) => {
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text: "A fallen tree blocks the north path.", mode: "failure" },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Contribute", exact: true }).click();
  await page
    .getByLabel("What did you observe?")
    .fill("A fallen tree blocks the north path.");
  await page.getByLabel("Public display name").fill("River Neighbor");
  await page.getByLabel("Observation time").selectOption("unknown");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByLabel("What did you observe?")).toHaveValue(
    "A fallen tree blocks the north path.",
  );
  await expect(page.getByLabel("Public display name")).toHaveValue(
    "River Neighbor",
  );
  await page
    .getByRole("button", { name: "Submit Report", exact: true })
    .click();
  await expect(
    page.getByText("Report saved · account update pending", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("A fallen tree blocks the north path.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Observation time unknown", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("private-address@example.test")).toHaveCount(0);
  await expect(page.getByText("Private Google Name")).toHaveCount(0);
  const reportId = new URL(page.url()).searchParams.get("report")!;
  await page.screenshot({
    path: `.local/issue-4-pending-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text: "A fallen tree blocks the north path.", mode: "success" },
  });
  await page.getByRole("button", { name: "Retry account update" }).click();
  await expect(
    page.getByText("Report saved · account published", { exact: true }),
  ).toBeVisible();
  const published = await (
    await page.request.get(`/api/happenings/${reportId}`)
  ).json();
  expect(published.reports).toHaveLength(1);
  expect(published.account.version).toBe(1);
  await page.request.post(`/api/reports/${reportId}/process`);
  const repeated = await (
    await page.request.get(`/api/happenings/${reportId}`)
  ).json();
  expect(repeated.reports).toHaveLength(1);
  expect(repeated.account.version).toBe(1);
  await page.goto(`/?happening=${reportId}`);
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await expect(page.getByText("River Neighbor", { exact: true })).toBeVisible();
  await expect(
    page.getByText("A fallen tree blocks the north path.", { exact: true }),
  ).toBeVisible();
  await page.goto("/?happening=lamp");
  const lamp = await (await page.request.get("/api/happenings/lamp")).json();
  await page.getByRole("button", { name: "Add an update" }).click();
  await expect(page.getByLabel("What did you observe?")).toHaveValue("");
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue(
    String(lamp.lat),
  );
});

test("model claims cannot strip uncertainty around abbreviations or line breaks", async ({
  page,
}) => {
  await signIn(page);
  for (const text of [
    "I cannot confirm that Dr. Smith saw flooding.",
    "I cannot confirm:\nThe road is closed.",
  ]) {
    await page.request.post("http://127.0.0.1:3101/control", {
      data: { text, mode: "drop-qualification" },
    });
    const report = await (
      await page.request.post("/api/reports", { data: submission(text) })
    ).json();
    const rejected = await (
      await page.request.post(`/api/reports/${report.id}/process`)
    ).json();
    expect(rejected.state).toBe("pending");
    await page.request.post("http://127.0.0.1:3101/control", {
      data: { text, mode: "success" },
    });
    const result = await (
      await page.request.post(`/api/reports/${report.id}/process`)
    ).json();
    expect(result.state).toBe("published");
    const detail = await (
      await page.request.get(`/api/happenings/${report.id}`)
    ).json();
    expect(detail.account.claims).toHaveLength(1);
    expect(detail.account.claims[0].statement).toBe(text);
    expect(detail.reports[0].originalText).toBe(text);
    const evidence = await (
      await page.request.get(
        `/api/happenings/${report.id}/claims/${detail.account.claims[0].id}`,
      )
    ).json();
    for (const pair of evidence.evidence)
      expect(pair.observation.describedState).toBe(text);
  }
});

test("processing begins after the original is saved and concurrent retries publish it only once", async ({
  page,
}) => {
  await signIn(page);
  const text = "A large branch blocks the east path.";
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text, mode: "slow" },
  });
  await page.getByLabel("What did you observe?").fill(text);
  await page.getByLabel("Public display name").fill("Path Walker");
  await page.getByLabel("Observation time").selectOption("now");
  const saveResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/reports") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Submit Report", exact: true })
    .click();
  const receipt = await (await saveResponse).json();
  expect(receipt.state).toBe("saved");
  expect(receipt.originalText).toBe(text);
  expect(receipt.observedAt).not.toBeNull();
  await expect(
    page.getByText("Report saved · updating the account", { exact: true }),
  ).toBeVisible();
  await Promise.all([
    page.request.post(`/api/reports/${receipt.id}/process`),
    page.request.post(`/api/reports/${receipt.id}/process`),
  ]);
  await expect(
    page.getByText("Report saved · account published", { exact: true }),
  ).toBeVisible();
  const detail = await (
    await page.request.get(`/api/happenings/${receipt.id}`)
  ).json();
  expect(detail.reports).toHaveLength(1);
  expect(detail.observations).toHaveLength(1);
  expect(detail.account.version).toBe(1);
});

test("a long Report can publish multiple scoped Observations without model echoing its evidence", async ({
  page,
}) => {
  await signIn(page);
  const text = `The north entrance is blocked${" with a barrier".repeat(220)}. The south entrance is blocked${" with a barrier".repeat(220)}.`;
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text, mode: "success" },
  });
  const report = await (
    await page.request.post("/api/reports", { data: submission(text) })
  ).json();
  const result = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  expect(result.state).toBe("published");
  const detail = await (
    await page.request.get(`/api/happenings/${report.id}`)
  ).json();
  expect(detail.observations).toHaveLength(2);
  expect(detail.account.claims).toHaveLength(1);
  expect(detail.account.claims[0].statement).toBe(text);
  expect(
    detail.observations
      .map((o: { spatialScope: string }) => o.spatialScope)
      .sort(),
  ).toEqual(["north entrance", "south entrance"]);
});

test("cancelled Google sign-in keeps a chosen-time source-based draft on the same origin", async ({
  page,
}) => {
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { cancelNextSignIn: true },
  });
  await page.goto("/?contribute=1");
  await page
    .getByLabel("What did you observe?")
    .fill("The notice describes a closed entrance.");
  await page.getByLabel("Public display name").fill("Draft Author");
  await page.getByLabel("Observation time").selectOption("chosen");
  await page
    .getByLabel("Observed at (your local time)")
    .fill("2026-10-18T09:30");
  await page.getByLabel("How do you know?").selectOption("source_based");
  await page
    .getByLabel("Source link (optional)")
    .fill("https://example.test/notice");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Sign-in did not complete" }),
  ).toBeVisible();
  await expect(page.getByLabel("What did you observe?")).toHaveValue(
    "The notice describes a closed entrance.",
  );
  await expect(page.getByLabel("Observed at (your local time)")).toHaveValue(
    "2026-10-18T09:30",
  );
  await expect(page.getByLabel("Source link (optional)")).toHaveValue(
    "https://example.test/notice",
  );
});

test("a source-based Report produces distinct claim evidence with unknown observation time and private email", async ({
  page,
  browser,
}) => {
  await signIn(page);
  const text = "The north path is blocked. The south path has a barrier.";
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text, mode: "success" },
  });
  await page.getByLabel("What did you observe?").fill(text);
  await page.getByLabel("Public display name").fill("Chosen Public Name");
  await page.getByLabel("Observation time").selectOption("unknown");
  await page.getByLabel("How do you know?").selectOption("source_based");
  await page
    .getByLabel("Source link (optional)")
    .fill("https://example.test/community-notice");
  await page.getByLabel("Latitude", { exact: true }).fill("44.25");
  await page.getByLabel("Longitude", { exact: true }).fill("-85.25");
  await page
    .getByRole("button", { name: "Submit Report", exact: true })
    .click();
  await expect(
    page.getByText("Report saved · account published", { exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).searchParams.get("report")!;
  const detail = await (await page.request.get(`/api/happenings/${id}`)).json();
  expect(detail).toMatchObject({
    category: "disruption",
    status: "Reports received",
    contributorCount: 1,
    lat: 44.25,
    lng: -85.25,
  });
  expect(detail.observations).toHaveLength(2);
  expect(detail.reports[0]).toMatchObject({
    originalText: text,
    displayName: "Chosen Public Name",
    observedAt: null,
    sourceUrl: "https://example.test/community-notice",
    provenance: "source_based",
  });
  expect(JSON.stringify(detail)).not.toContain("private-address@example.test");
  const publicContext = await browser.newContext();
  const reader = await publicContext.newPage();
  await reader.goto(`/?happening=${id}`);
  await reader.getByRole("button", { name: text, exact: true }).click();
  const evidence = reader.getByRole("dialog");
  await expect(
    evidence.getByText("Derived Observation", { exact: true }),
  ).toHaveCount(2);
  await expect(
    evidence.getByText("Observation time unknown", { exact: true }),
  ).toHaveCount(2);
  await expect(
    evidence.getByRole("link", { name: "Open source link" }),
  ).toHaveCount(2);
  const supports = await (
    await reader.request.get(
      `/api/happenings/${id}/claims/${detail.account.claims[0].id}`,
    )
  ).json();
  expect(supports.evidence).toHaveLength(2);
  expect(supports.evidence[0].observation.describedState).toBe(text);
  expect(
    supports.evidence
      .map(
        (e: { observation: { spatialScope: string } }) =>
          e.observation.spatialScope,
      )
      .sort(),
  ).toEqual(["north path", "south path"]);
  expect((await reader.request.get(`/api/reports/${id}`)).status()).toBe(401);
  await publicContext.close();
});

test("unsupported model output stays private and retryable without a no-match marker", async ({
  page,
  browser,
}) => {
  await signIn(page);
  for (const mode of ["unsupported", "bad-reference"]) {
    const text = `A branch blocks the ${mode} path.`;
    await page.request.post("http://127.0.0.1:3101/control", {
      data: { text, mode },
    });
    const input = submission(text);
    const first = await page.request.post("/api/reports", { data: input });
    expect(first.status()).toBe(201);
    const report = await first.json();
    expect(report.state).toBe("saved");
    const replay = await (
      await page.request.post("/api/reports", { data: input })
    ).json();
    expect(replay.id).toBe(report.id);
    expect(
      (
        await page.request.post("/api/reports", {
          data: { ...input, originalText: "Changed words." },
        })
      ).status(),
    ).toBe(409);
    const result = await (
      await page.request.post(`/api/reports/${report.id}/process`)
    ).json();
    expect(result.state).toBe("pending");
    expect(
      (await page.request.get(`/api/happenings/${report.id}`)).status(),
    ).toBe(404);
    const ownerReport = await (
      await page.request.get(`/api/reports/${report.id}`)
    ).json();
    expect(ownerReport.state).toBe("pending");
    expect(ownerReport.originalText).toBe(text);
    expect(ownerReport.matchingOutcome).toBeNull();
    const other = await browser.newContext();
    const stranger = await other.newPage();
    await signIn(stranger);
    expect(
      (await stranger.request.get(`/api/reports/${report.id}`)).status(),
    ).toBe(404);
    expect(
      (
        await stranger.request.post(`/api/reports/${report.id}/process`)
      ).status(),
    ).toBe(404);
    await other.close();
  }
});

test("a selected Happening stays unchanged until the contributor confirms the match", async ({
  page,
}) => {
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text: "The south entrance looks different.", mode: "failure" },
  });
  await page.goto("/?happening=bridge");
  const before = await (
    await page.request.get("/api/happenings/bridge")
  ).json();
  await page.getByRole("button", { name: "Add an update" }).click();
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue(
    String(before.lat),
  );
  await page
    .getByLabel("What did you observe?")
    .fill("The south entrance looks different.");
  await page.getByLabel("Public display name").fill("Another Neighbor");
  await page.getByLabel("Observation time").selectOption("unknown");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page
    .getByRole("button", { name: "Submit Report", exact: true })
    .click();
  await expect(
    page.getByText("Report saved · account update pending", { exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).searchParams.get("report")!;
  expect((await page.request.get(`/api/happenings/${id}`)).status()).toBe(404);
  const after = await (await page.request.get("/api/happenings/bridge")).json();
  expect(after.account).toEqual(before.account);
  expect(after.reports).toEqual(before.reports);
  await page.request.post("http://127.0.0.1:3101/control", {
    data: {
      text: "The south entrance looks different.",
      mode: "match",
      candidateId: "bridge",
    },
  });
  await page.getByRole("button", { name: "Retry account update" }).click();
  await expect(
    page.getByText("Suggested Happening", { exact: true }),
  ).toBeVisible();
  expect((await page.request.get(`/api/happenings/${id}`)).status()).toBe(404);
  const afterReview = await (
    await page.request.get("/api/happenings/bridge")
  ).json();
  expect(afterReview.account).toEqual(before.account);
  expect(afterReview.reports).toHaveLength(before.reports.length);
  await page
    .getByRole("button", { name: "Use this Happening", exact: true })
    .click();
  await expect(
    page.getByText("Report saved · account published", { exact: true }),
  ).toBeVisible();
  const attached = await (
    await page.request.get("/api/happenings/bridge")
  ).json();
  expect(attached.reports).toHaveLength(before.reports.length + 1);
  expect(attached.account.version).toBe(before.account.version + 1);
  expect(
    attached.reports.map((item: { originalText: string }) => item.originalText),
  ).toContain("The south entrance looks different.");
});

test("invalid contribution metadata and cross-origin writes are rejected without losing public browsing", async ({
  page,
}) => {
  await signIn(page);
  for (const overrides of [
    { observedAt: undefined },
    { observedAt: "2099-01-01T00:00:00Z" },
    { lat: 91 },
    { provenance: "verified" },
    { sourceUrl: "javascript:alert(1)", provenance: "source_based" },
  ]) {
    expect(
      (
        await page.request.post("/api/reports", {
          data: submission("A branch blocks the path.", overrides),
        })
      ).status(),
    ).toBe(400);
  }
  expect(
    (
      await page.request.post("/api/reports", {
        headers: { Origin: "https://unrelated.example" },
        data: submission("A branch blocks the path."),
      })
    ).status(),
  ).toBe(403);
});
