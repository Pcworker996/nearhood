import { expect, test } from "@playwright/test";

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
