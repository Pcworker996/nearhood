import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// Contributors place the Report pin by searching or using the map; there are
// no coordinate fields (#27). Tests register a fixture place at the exact
// position they need and choose it from the place search.
export async function placePin(page: Page, lat: number, lng: number) {
  const query = `Test place ${randomUUID()}`;
  const name = `${query}, Fixture City`;
  await page.request.post("http://127.0.0.1:3101/geocoding-control", {
    data: { place: { query, name, lat, lng } },
  });
  await page.getByLabel("Search for a place").fill(query);
  await page.getByLabel("Search for a place").press("Enter");
  await page.getByRole("button", { name }).click();
  await expect(page.getByText(`Pin: ${name}`)).toBeVisible();
  return name;
}

// The fixture's reverse lookup names a road after the latitude.
export const roadAt = (lat: number) =>
  `Fixture Road ${lat.toFixed(3)}, Fixture City`;
