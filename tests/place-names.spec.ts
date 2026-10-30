import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { projectLatitude } from "./project-coordinates";

// Issue #27: the contribution pin names its street-level place and can be
// moved by searching. MapTiler Geocoding is the external fixture.
const fixture = "http://127.0.0.1:3101";

async function signIn(page: Page) {
  await page.goto("/?contribute=1");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByRole("button", { name: "Submit Report", exact: true }),
  ).toBeVisible();
}
const roadAt = (lat: number) => `Fixture Road ${lat.toFixed(3)}, Fixture City`;

test("the pin names its street, suggests it until the contributor writes their own, and moves to a searched place", async ({
  page,
}, testInfo) => {
  const lat = projectLatitude(testInfo, 11);
  const library = {
    query: `Fixture Library ${testInfo.project.name}`,
    name: `Fixture Library ${testInfo.project.name}, Fixture City`,
    lat: projectLatitude(testInfo, 11),
    lng: 140.01,
  };
  await page.request.post(`${fixture}/geocoding-control`, {
    data: { place: library },
  });
  await signIn(page);
  const description = page.getByLabel("Location description");
  await page.getByLabel("Latitude", { exact: true }).fill(String(lat));
  await page.getByLabel("Longitude", { exact: true }).fill("140");
  await expect(page.getByText(`Pin: Near ${roadAt(lat)}`)).toBeVisible();
  await expect(description).toHaveValue(roadAt(lat));
  await expect(page.getByText("Suggested from the map.")).toBeVisible();

  // Reverse lookups stay at street level: no address points or POIs.
  const requests = await (
    await page.request.get(`${fixture}/geocoding-requests`)
  ).json();
  expect(requests.at(-1).params).toMatchObject({
    types: "address,poi",
    excludeTypes: "true",
  });

  // Tapping the map moves the pin and replaces an untouched suggestion.
  // Away from the zoom control (top left), attribution and the pin itself.
  const map = page.locator(".contribution-pin .leaflet-container");
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width * 0.75, y: box.height * 0.7 } });
  const tapped = Number(
    await page.getByLabel("Latitude", { exact: true }).inputValue(),
  );
  expect(tapped).not.toBe(lat);
  await expect(description).toHaveValue(roadAt(tapped));

  // The contributor's own words survive later pin moves.
  await description.fill("Under the rail bridge");
  const moved = lat + 0.004;
  await page.getByLabel("Latitude", { exact: true }).fill(String(moved));
  await expect(page.getByText(`Pin: Near ${roadAt(moved)}`)).toBeVisible();
  await expect(description).toHaveValue("Under the rail bridge");

  // Searching moves the pin and uses the chosen place's name; Enter must
  // search rather than submit the Report.
  await page.getByLabel("Search for a place").fill(library.query);
  await page.getByLabel("Search for a place").press("Enter");
  await page.getByRole("button", { name: library.name }).click();
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue(
    String(library.lat),
  );
  await expect(page.getByLabel("Longitude", { exact: true })).toHaveValue(
    String(library.lng),
  );
  await expect(description).toHaveValue(library.name);
  await expect(page.getByText(`Pin: ${library.name}`)).toBeVisible();
  await page.getByLabel("Search for a place").fill("Nowhere at all");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("No places found.")).toBeVisible();

  await page
    .getByLabel("What did you observe?")
    .fill(`The library steps are closed ${randomUUID()}.`);
  await page.getByLabel("Public display name").fill("Place Neighbor");
  await page.getByLabel("Observation time").selectOption("unknown");
  await page
    .getByRole("button", { name: "Submit Report", exact: true })
    .click();
  await expect(page).toHaveURL(/report=/);
  const id = new URL(page.url()).searchParams.get("report")!;
  const saved = await (await page.request.get(`/api/reports/${id}`)).json();
  expect(saved.locationName).toBe(library.name);
  expect(saved.locationNameSource).toBe("geocoder");
});

test("server-side place lookups are refused, as the real origin-restricted key refuses them", async ({
  request,
}) => {
  const response = await request.get(
    `${fixture}/geocoding/-83.0488,42.3328.json?key=external-fixture-maptiler-key`,
  );
  expect(response.status()).toBe(403);
});

test("an unavailable geocoder leaves the location description and submission usable", async ({
  page,
}, testInfo) => {
  await page.request.post(`${fixture}/geocoding-control`, {
    data: { down: true },
  });
  try {
    await signIn(page);
    await page
      .getByLabel("Latitude", { exact: true })
      .fill(String(projectLatitude(testInfo, 11)));
    await page.getByLabel("Longitude", { exact: true }).fill("141");
    await expect(page.getByText("Pin: Place name unavailable")).toBeVisible();
    await expect(page.getByLabel("Location description")).toHaveValue(
      "Selected map pin",
    );
    await page.getByLabel("Search for a place").fill("Anything");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      page.getByText("Place search is unavailable. Tap the map instead."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submit Report", exact: true }),
    ).toBeEnabled();
  } finally {
    await page.request.post(`${fixture}/geocoding-control`, {
      data: { down: false },
    });
  }
});

test("Report submissions record where the location name came from", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const submit = (overrides: Record<string, unknown>) =>
    page.request.post("/api/reports", {
      data: {
        requestKey: randomUUID(),
        originalText: `Source check ${randomUUID()}`,
        displayName: "Place Neighbor",
        lat: projectLatitude(testInfo, 11),
        lng: 142,
        locationName: "Corner shop",
        observedAt: null,
        provenance: "firsthand",
        sourceUrl: null,
        candidateId: null,
        ...overrides,
      },
    });
  for (const [sent, stored] of [
    [undefined, "contributor"],
    ["geocoder", "geocoder"],
    ["anything else", "contributor"],
  ]) {
    const response = await submit({ locationNameSource: sent });
    expect(response.ok()).toBe(true);
    const { id } = await response.json();
    const saved = await (await page.request.get(`/api/reports/${id}`)).json();
    expect(saved.locationNameSource).toBe(stored);
  }
});
