import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { projectLatitude } from "./project-coordinates";
import { placePin, roadAt } from "./place-pin";

async function processSaved(page: Page, id: string) {
  let response = await page.request.post(`/api/reports/${id}/process`);
  const report = await response.json();
  if (report.nextAction === "process")
    response = await page.request.post(`/api/reports/${id}/process`);
  return response;
}

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
    page.getByText("Describe one situation per Report.", { exact: false }),
  ).toBeVisible();
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
  const reviewed = await (await processSaved(page, report.id)).json();
  expect(reviewed.state).toBe("match_review");
  expect(reviewed.candidateIds).toContain("picnic");
  // Only possible matches are offered; the others were graded separate.
  expect(reviewed.candidates.map((c: { id: string }) => c.id)).toEqual(["picnic"]);
  expect(
    reviewed.candidates.find(
      (candidate: { id: string }) => candidate.id === "picnic",
    ).category,
  ).toBe("activity");
  expect(reviewed.recommendation).toMatchObject({
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
}, testInfo) => {
  await signIn(page);
  // Isolate rejection from histories added by the other browser project.
  const lat = projectLatitude(testInfo, 5);
  const candidates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const words = `A barrier blocks remote sector ${i}.`;
    await page.request.post("http://127.0.0.1:3101/control", {
      data: { text: words, mode: "success" },
    });
    const seeded = await (
      await page.request.post("/api/reports", {
        data: submission(words, { lat, lng: 125 }),
      })
    ).json();
    expect((await (await processSaved(page, seeded.id)).json()).state).toBe(
      "published",
    );
    candidates.push(seeded.id);
  }
  const text = "A barrier is near the footbridge entrance.";
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text, mode: "uncertain", candidateId: candidates[0] },
  });
  const report = await (
    await page.request.post("/api/reports", {
      data: submission(text, {
        lat,
        lng: 125,
        locationName: "North footbridge approach",
        observedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        candidateId: candidates[0],
      }),
    })
  ).json();
  const clarification = await (await processSaved(page, report.id)).json();
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
      "Which of these nearby situations describes what you reported?",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "My Report describes a different situation from these",
    })
    .click();
  await expect(
    page.getByText("Report saved · account published", { exact: true }),
  ).toBeVisible();
  const decided = await (
    await page.request.get(`/api/reports/${report.id}`)
  ).json();
  expect(decided.matchingOutcome).toBe("create_new");
  // Only the one possible match was offered and shown.
  expect(decided.decisionCandidateIds).toEqual([candidates[0]]);
  expect(decided.candidateIds).toEqual(
    expect.arrayContaining(decided.decisionCandidateIds),
  );
  expect(decided.happeningId).toBe(report.id);
});

test("a successful empty nearby search creates a Happening without a newness question", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const text = "A branch blocks the rural trail.";
  const lat = projectLatitude(testInfo, -45);
  const lng = 4;
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
  const processed = await (await processSaved(page, report.id)).json();
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
  await placePin(page, projectLatitude(testInfo, 8), 130);
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
  await expect(page.getByText(`Pin: Near ${roadAt(lamp.lat)}`)).toBeVisible();
});

test("hedged Reports publish no condition and keep the qualification beside the original words", async ({
  page,
}, testInfo) => {
  await signIn(page);
  for (const text of [
    "I cannot confirm that Dr. Smith saw flooding.",
    "I cannot confirm:\nThe road is closed.",
  ]) {
    await page.request.post("http://127.0.0.1:3101/control", {
      data: { text, mode: "drop-qualification" },
    });
    const report = await (
      await page.request.post("/api/reports", {
        data: submission(text, {
          lat: projectLatitude(testInfo, -30),
          lng: 110,
        }),
      })
    ).json();
    const rejected = await (await processSaved(page, report.id)).json();
    expect(rejected.state).toBe("pending");
    await page.request.post("http://127.0.0.1:3101/control", {
      data: { text, mode: "success" },
    });
    const result = await (await processSaved(page, report.id)).json();
    expect(result.state).toBe("published");
    const detail = await (
      await page.request.get(`/api/happenings/${report.id}`)
    ).json();
    expect(detail.reports[0].originalText).toBe(text);
    expect(detail.account.claims).toHaveLength(0);
    expect(detail.account.uncertainty).toContain(
      "No condition was described in this Report.",
    );
    const hedge = detail.observations.find(
      (o: { uncertainty: string | null }) => o.uncertainty,
    );
    expect(hedge.describedState).toBeNull();
    expect(hedge.uncertainty).toContain("I cannot confirm");
  }
});

test("processing begins after the original is saved and concurrent retries publish it only once", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const text = "A large branch blocks the east path.";
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text, mode: "slow" },
  });
  await page.getByLabel("What did you observe?").fill(text);
  await page.getByLabel("Public display name").fill("Path Walker");
  await page.getByLabel("Observation time").selectOption("now");
  await placePin(page, projectLatitude(testInfo, -35), 110);
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
}, testInfo) => {
  await signIn(page);
  const text = `The north entrance is blocked${" with a barrier".repeat(220)}. The south entrance is blocked${" with a barrier".repeat(220)}.`;
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text, mode: "success" },
  });
  const report = await (
    await page.request.post("/api/reports", {
      data: submission(text, { lat: projectLatitude(testInfo, -40), lng: 110 }),
    })
  ).json();
  const result = await (await processSaved(page, report.id)).json();
  expect(result.state).toBe("published");
  const detail = await (
    await page.request.get(`/api/happenings/${report.id}`)
  ).json();
  expect(detail.observations).toHaveLength(2);
  expect(detail.account.claims).toHaveLength(2);
  for (const claim of detail.account.claims) {
    expect(claim.statement).not.toBe(text);
    expect(claim.statement).toContain("blocked with a barrier");
  }
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
  await placePin(page, 44.25, -85.25);
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
  await reader
    .getByRole("button", {
      name: detail.account.claims[0].statement,
      exact: true,
    })
    .click();
  const evidence = reader.getByRole("dialog");
  await expect(
    evidence.getByText("Derived Observation", { exact: true }),
  ).toHaveCount(1);
  await expect(
    evidence.getByText("Observation time unknown", { exact: true }),
  ).toHaveCount(1);
  await expect(
    evidence.getByRole("link", { name: "Open source link" }),
  ).toHaveCount(1);
  await expect(evidence.getByText(text, { exact: true })).toBeVisible();
  // One derived claim per scoped Observation, each traced to the original Report.
  expect(detail.account.claims).toHaveLength(2);
  const supports = await Promise.all(
    detail.account.claims.map(async (claim: { id: string }) =>
      (
        await reader.request.get(`/api/happenings/${id}/claims/${claim.id}`)
      ).json(),
    ),
  );
  for (const support of supports) {
    expect(support.evidence).toHaveLength(1);
    expect(support.evidence[0].report.originalText).toBe(text);
    expect(support.evidence[0].observation.describedState).not.toBe(text);
  }
  expect(
    supports
      .map(
        (s: { evidence: { observation: { spatialScope: string } }[] }) =>
          s.evidence[0].observation.spatialScope,
      )
      .sort(),
  ).toEqual(["north path", "south path"]);
  expect(
    supports
      .map(
        (s: { evidence: { observation: { describedState: string } }[] }) =>
          s.evidence[0].observation.describedState,
      )
      .sort(),
  ).toEqual(["a barrier", "blocked"]);
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
    const result = await (await processSaved(page, report.id)).json();
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

test("identical concurrent confirmations publish once and other contributors cannot confirm", async ({
  page,
  browser,
}, testInfo) => {
  await signIn(page);
  const lat = projectLatitude(testInfo, 22);
  const earlier = `A barrier blocks the remote crossing. ${randomUUID()}`;
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text: earlier, mode: "success" },
  });
  const happening = await (
    await page.request.post("/api/reports", {
      data: submission(earlier, { lat, lng: -170 }),
    })
  ).json();
  expect((await (await processSaved(page, happening.id)).json()).state).toBe(
    "published",
  );
  const text = `The crossing barrier is still there. ${randomUUID()}`;
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text, mode: "match", candidateId: happening.id },
  });
  const report = await (
    await page.request.post("/api/reports", {
      data: submission(text, { lat, lng: -170 }),
    })
  ).json();
  expect((await (await processSaved(page, report.id)).json()).state).toBe(
    "match_review",
  );
  const before = await (
    await page.request.get(`/api/happenings/${happening.id}`)
  ).json();
  const choice = {
    choice: "match",
    candidateId: happening.id,
    candidateIdsShown: [happening.id],
  };
  const confirmations = await Promise.all(
    [1, 2].map(() =>
      page.request.post(`/api/reports/${report.id}/match`, { data: choice }),
    ),
  );
  expect(confirmations.map((r) => r.status())).toEqual([200, 200]);
  const after = await (
    await page.request.get(`/api/happenings/${happening.id}`)
  ).json();
  expect(after.account.version).toBe(before.account.version + 1);
  expect(after.reports).toHaveLength(before.reports.length + 1);
  expect(
    (
      await page.request.post(`/api/reports/${report.id}/match`, {
        data: { choice: "create_new", candidateIdsShown: [happening.id] },
      })
    ).status(),
  ).toBe(409);
  const other = await browser.newContext();
  const stranger = await other.newPage();
  await signIn(stranger);
  expect(
    (
      await stranger.request.post(`/api/reports/${report.id}/match`, {
        data: choice,
      })
    ).status(),
  ).toBe(404);
  await other.close();
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
  await expect(
    page.getByText(`Pin: Near ${roadAt(before.lat)}`),
  ).toBeVisible();
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
