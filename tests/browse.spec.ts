import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { projectLatitude } from "./project-coordinates";

test("selecting a map marker opens its preview even when highlights are collapsed", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", {
      name: "Select map marker: Eastbank footbridge closure",
    })
    .waitFor();
  await page
    .getByRole("button", { name: /Nearby highlights.*happenings in view/ })
    .click();
  await page
    .getByRole("button", {
      name: "Select map marker: Eastbank footbridge closure",
    })
    .click();
  await expect(
    page.getByRole("button", { name: "View full details" }),
  ).toBeVisible();
});

// Agreed seam: the browser application with its real HTTP API and PostgreSQL.
// Only external map tile requests may be controlled; application data is never mocked.
test("a public reader follows a provisional claim to its original Reports after reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Fictional Northbank demo data", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preview Eastbank footbridge closure" })
    .click();
  await page.getByRole("button", { name: "View full details" }).click();
  await expect(
    page.getByRole("heading", { name: "Current account" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Barriers were observed at both bridge entrances.",
    })
    .click();
  const panel = page.getByRole("dialog", { name: "Evidence for this claim" });
  await expect(
    panel.getByText(
      "Both entrances have orange barriers across the path. I had to turn back.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(panel.getByText("Mara L.", { exact: true })).toBeVisible();
  await expect(
    panel.getByText("Observed", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    panel.getByText("Submitted", { exact: true }).first(),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Open full evidence timeline" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Evidence timeline" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Eastbank footbridge closure" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await expect(
    page.getByText(
      "Both entrances have orange barriers across the path. I had to turn back.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("public browsing survives denied location and keeps distances labeled from map center", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(
    page.getByText(
      "Location was not shared. You can keep browsing; distances are from map center.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview Eastbank footbridge closure" }),
  ).toContainText("from map center");
  await expect(
    page.getByRole("button", {
      name: "Preview Streetlamp outage on Alder at 3rd",
    }),
  ).toBeVisible();
});

test("a reader leaves the demo area without invented happenings and can return", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 0, longitude: 0 });
  await page.goto("/");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(
    page.getByRole("heading", { name: "No happenings here yet" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview Eastbank footbridge closure" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Select map marker: Eastbank footbridge closure",
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Return to demo" }).click();
  await expect(
    page.getByRole("button", { name: "Preview Eastbank footbridge closure" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Select map marker: Eastbank footbridge closure",
    }),
  ).toBeAttached();
});

test("a source-based activity preserves unknown observation time and separates its announced schedule", async ({
  page,
}) => {
  await page.goto("/?happening=picnic");
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  await expect(
    page.getByText("Source-based report — contributor-declared", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Observation time unknown", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /The schedule does not establish that the activity occurred/,
    ),
  ).toBeVisible();
  await expect(page.getByText(/End time unknown/)).toBeVisible();
  await page
    .getByRole("button", { name: "Current account", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "A stretch-and-picnic activity was announced for October 8 at 4:30 pm.",
    })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Derived Observation", { exact: true }),
  ).toBeVisible();
});

test("claim evidence is specific to the selected claim and cannot cross Happening boundaries", async ({
  page,
}) => {
  await page.goto("/?happening=bridge");
  await page
    .getByRole("button", {
      name: "No reopening time was posted at the south entrance.",
    })
    .click();
  const panel = page.getByRole("dialog", { name: "Evidence for this claim" });
  await expect(
    panel.getByText(
      "We saw the closure from the south entrance. No posted reopening time yet.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    panel.getByText(
      "Both entrances have orange barriers across the path. I had to turn back.",
      { exact: true },
    ),
  ).toHaveCount(0);
  const status = await page.evaluate(
    async () =>
      (await fetch("/api/happenings/lamp/claims/bridge-barriers")).status,
  );
  expect(status).toBe(404);
});

async function movePublishedReport(id: string, lng: number, lat: number) {
  const client = new Client({
    connectionString:
      process.env.TEST_DATABASE_URL ??
      "postgresql://127.0.0.1:55432/nearhood_test",
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE nearhood.reports
       SET location = extensions.ST_SetSRID(extensions.ST_MakePoint($2, $3), 4326)::extensions.geography
       WHERE id = $1`,
      [id, lng, lat],
    );
    await client.query(
      `UPDATE nearhood.happenings
       SET location = extensions.ST_SetSRID(extensions.ST_MakePoint($2, $3), 4326)::extensions.geography
       WHERE id = $1`,
      [id, lng, lat],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

test("a second published Happening at the footbridge covers the seeded marker", async ({
  page,
}, testInfo) => {
  await page.goto("/?contribute=1");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByRole("button", { name: "Submit Report", exact: true }),
  ).toBeVisible();
  const originalText = `A new pothole is in the footbridge deck. ${randomUUID()}`;
  await page.request.post("http://127.0.0.1:3101/control", {
    data: { text: originalText, mode: "success" },
  });
  const report = await (
    await page.request.post("/api/reports", {
      data: {
        requestKey: randomUUID(),
        originalText,
        displayName: "Test Neighbor",
        lat: projectLatitude(testInfo, 78),
        lng: 16,
        locationName: "Eastbank footbridge",
        observedAt: new Date().toISOString(),
        provenance: "firsthand",
        sourceUrl: null,
        candidateId: null,
      },
    })
  ).json();
  await page.request.post(`/api/reports/${report.id}/process`);
  const published = await (
    await page.request.post(`/api/reports/${report.id}/process`)
  ).json();
  let parkedId: string | null = null;
  try {
    if (
      published.state === "published" &&
      typeof published.happeningId === "string"
    )
      parkedId = published.happeningId;
    expect(published.state).toBe("published");
    expect(published.happeningId).toBe(report.id);
    // Earlier tests add Observations to the seeded bridge, and omitted
    // evidence then blocks a no-match publication at its coordinates.
    await movePublishedReport(report.id, -83.0457, 42.3328);
    await page.goto("/");
    await page
      .getByRole("button", { name: /Nearby highlights.*happenings in view/ })
      .click();
    // Overlapping markers at one position. ../docs/issues/17.md
    test.fail();
    await page
      .getByRole("button", {
        name: "Select map marker: Eastbank footbridge closure",
      })
      .click({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: "View full details" }),
    ).toBeVisible();
  } finally {
    // The other project runs this file afterwards. A pin left on the
    // footbridge covers the seeded marker for every later click.
    if (parkedId) await movePublishedReport(parkedId, 179, -89);
  }
});
