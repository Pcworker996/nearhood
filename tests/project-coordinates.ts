import type { TestInfo } from "@playwright/test";

// Mobile and desktop share one database. Each project draws inside its own
// slice of a one-degree band. The gap is wider than the 1,500 m search and
// the suite's coordinate jitter, about 0.012 degrees.
export function projectLatitude(testInfo: TestInfo, band: number) {
  const slice = 0.47;
  const gap = 1 - slice * 2;
  const start = testInfo.project.name === "mobile-chromium" ? slice + gap : 0;
  return band + start + Math.random() * slice;
}
