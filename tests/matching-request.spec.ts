import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { projectLatitude } from "./project-coordinates";
import {
  fixture,
  processFully,
  publishedHappening,
  signIn,
  submit,
} from "./uncertain-matches";

async function matchingRequest(page: Page, text: string) {
  return (
    await page.request.get(
      `${fixture}/matching-request?text=${encodeURIComponent(text)}`,
    )
  ).json();
}

test("matching asks for each reason before the labels it explains", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 55), lng: 140 };
  await publishedHappening(page, place);
  const text = `The remote path barrier is still up. ${randomUUID()}`;
  const report = await submit(page, text, place);
  await processFully(page, report.id);

  const sent = await matchingRequest(page, text);
  const item =
    sent.response_format.json_schema.schema.properties.assessments.items;
  const order = ["candidateId", "reason", "evidenceIds", "continuity", "chronology", "scope"];
  expect(Object.keys(item.properties)).toEqual(order);
  expect(item.required).toEqual(order);
});

test("matching receives the Report's submission time and the Happening it started from", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 60), lng: 140 };
  const startedFrom = await publishedHappening(page, place);
  const text = `The remote path barrier is still up. ${randomUUID()}`;
  const report = await submit(page, text, { ...place, candidateId: startedFrom });
  const saved = await (await page.request.get(`/api/reports/${report.id}`)).json();
  await processFully(page, report.id);

  const input = JSON.parse((await matchingRequest(page, text)).messages[1].content);
  expect(input.report.submittedAt).toBe(saved.submittedAt);
  expect(input.report.startedFromCandidateId).toBe(startedFrom);
});

test("a Report not started from a Happening sends no starting Happening", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 62), lng: 140 };
  await publishedHappening(page, place);
  const text = `The remote path barrier is still up. ${randomUUID()}`;
  const report = await submit(page, text, place);
  await processFully(page, report.id);

  const input = JSON.parse((await matchingRequest(page, text)).messages[1].content);
  expect(input.report.startedFromCandidateId).toBeNull();
});
