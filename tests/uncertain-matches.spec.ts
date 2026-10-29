import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { projectLatitude } from "./project-coordinates";
import { processFully, publishedHappening, signIn, submit } from "./uncertain-matches";

const ids = (candidates: { id: string }[]) => candidates.map((c) => c.id);

test("one same Happening is suggested even when another is unknown", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 45), lng: 140 };
  const same = await publishedHappening(page, place);
  const unknown = await publishedHappening(page, place);
  const report = await submit(
    page,
    `The remote path barrier is still up. ${randomUUID()}`,
    place,
    { [same]: { continuity: "same" }, [unknown]: { continuity: "unknown" } },
  );

  const review = await processFully(page, report.id);

  expect(review.state).toBe("match_review");
  expect(review.recommendation).toMatchObject({ kind: "match", candidateId: same });
  expect(ids(review.candidates).slice(0, 2)).toEqual([same, unknown]);
});

test("a separate grade with a conflicting chronology is an alternative, never the suggestion", async ({
  page,
}, testInfo) => {
  await signIn(page);
  const place = { lat: projectLatitude(testInfo, 50), lng: 140 };
  const same = await publishedHappening(page, place);
  const conflicting = await publishedHappening(page, place);
  const report = await submit(
    page,
    `The remote path barrier is still up. ${randomUUID()}`,
    place,
    {
      [conflicting]: { continuity: "separate", chronology: "conflict" },
      [same]: { continuity: "same" },
    },
  );

  const review = await processFully(page, report.id);

  expect(review.recommendation).toMatchObject({ kind: "match", candidateId: same });
  expect(ids(review.candidates)).toContain(conflicting);
});
