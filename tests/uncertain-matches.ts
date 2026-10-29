// Helpers for journeys about uncertain matches and possible connections (ADR 0008).
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export const fixture = "http://127.0.0.1:3101";
export type Grade = { continuity: string; chronology?: string };

export async function signIn(page: Page) {
  await page.goto("/?contribute=1");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(
    page.getByRole("button", { name: "Submit Report", exact: true }),
  ).toBeVisible();
}

export async function submit(
  page: Page,
  originalText: string,
  place: { lat: number; lng: number },
  grades: Record<string, Grade> = {},
) {
  await page.request.post(`${fixture}/control`, {
    data: { text: originalText, mode: "success", grades },
  });
  const response = await page.request.post("/api/reports", {
    data: {
      requestKey: randomUUID(),
      originalText,
      displayName: "Test Neighbor",
      locationName: "Remote path",
      observedAt: null,
      provenance: "firsthand",
      sourceUrl: null,
      candidateId: null,
      ...place,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string };
}

// Extraction and matching run in separate requests.
export async function processFully(page: Page, id: string) {
  await page.request.post(`/api/reports/${id}/process`);
  return (await page.request.post(`/api/reports/${id}/process`)).json();
}

export async function publishedHappening(
  page: Page,
  place: { lat: number; lng: number },
) {
  const report = await submit(
    page,
    `A barrier blocks the remote path. ${randomUUID()}`,
    place,
  );
  const published = await processFully(page, report.id);
  expect(published.state).toBe("published");
  return published.happeningId as string;
}
