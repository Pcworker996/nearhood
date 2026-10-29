import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractReportInfo, type ReportContext } from "../src/lib/report-model";
import { scoreCategory } from "./live-category";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* Shell configuration is also supported. */
}
if (!process.env.NEBIUS_API_KEY || !process.env.NEBIUS_MODEL)
  throw Error(
    "Configure NEBIUS_API_KEY and NEBIUS_MODEL in .env.local or the shell. No live extraction has run.",
  );

// Reviewed live expectations. Terms match an Observation's subject or spatialScope.
type LiveExpectation = {
  occurrence: "single" | "multiple" | "unclear";
  scopes?: string[];
  unreported?: string[];
  qualified?: string[];
  // Acceptable categories, scored by scoreCategory.
  category?: string[];
};

const directories = ["./fixtures/extraction/", "./fixtures/extraction-live/"];
const fixtures: {
  file: string;
  report: ReportContext;
  live: LiveExpectation;
}[] = [];
for (const directory of directories) {
  const path = fileURLToPath(new URL(directory, import.meta.url));
  for (const file of (await readdir(path)).sort()) {
    if (!file.endsWith(".json")) continue;
    const fixture = JSON.parse(await readFile(join(path, file), "utf8"));
    // Fixtures without reviewed live expectations only test software validation.
    if (fixture.live) fixtures.push({ file, ...fixture });
  }
}

let failed = 0;
let categoryMisses = 0;
let hazardsAsActivity = 0;
for (const { file, report, live } of fixtures) {
  console.log(`# ${file}\n${report.originalText}`);
  try {
    const output = await extractReportInfo(report);
    console.log(JSON.stringify(output, null, 2));
    const { observations, occurrence, category } = output.extraction;
    const { miss: categoryMiss, hazardAsActivity } = scoreCategory(
      category,
      live.category,
    );
    if (categoryMiss) categoryMisses++;
    if (hazardAsActivity) hazardsAsActivity++;
    const about = (term: string) =>
      observations.filter((o) =>
        [o.subject, o.spatialScope].some((field) =>
          field?.toLowerCase().includes(term),
        ),
      );
    const problems = [
      hazardAsActivity &&
        `hazard labelled activity, expected ${live.category!.join(" or ")}`,
      occurrence !== live.occurrence &&
        `occurrence ${occurrence}, expected ${live.occurrence}`,
      ...(live.scopes ?? [])
        .filter(
          (scope) =>
            !observations.some((o) => o.spatialScope?.toLowerCase() === scope),
        )
        .map((scope) => `missing spatialScope "${scope}"`),
      ...(live.unreported ?? []).flatMap((term) =>
        about(term)
          .filter((o) => o.describedCondition !== null)
          .map(
            (o) =>
              `"${term}" was not observed, but condition is "${o.describedCondition}"`,
          ),
      ),
      ...(live.qualified ?? []).flatMap((term) => {
        const matches = about(term);
        if (!matches.length) return [`no Observation about "${term}"`];
        return matches
          .filter((o) => o.uncertainty === null)
          .map(() => `"${term}" lost its qualification (uncertainty is null)`);
      }),
    ].filter((problem): problem is string => Boolean(problem));
    if (categoryMiss && !hazardAsActivity)
      console.log(
        `CATEGORY: ${category}, expected ${live.category!.join(" or ")}`,
      );
    // Not a failure: a reviewer decides whether the scope was referred back to
    // ("it", "both") or attributed to the wrong passage.
    for (const o of observations.filter((o) => o.scopeOutsideCitation))
      console.log(
        `REVIEW: "${o.key}" scope "${o.spatialScope}" is not named in its cited passages`,
      );
    if (problems.length) failed++;
    console.log(problems.length ? `FAIL: ${problems.join("; ")}\n` : "PASS\n");
  } catch (error) {
    failed++;
    console.log(
      `${JSON.stringify({ error: error instanceof Error ? error.message : "failed" }, null, 2)}\nFAIL\n`,
    );
  }
}
console.log(`${fixtures.length - failed}/${fixtures.length} passed`);
const scored = fixtures.filter((f) => f.live.category).length;
console.log(
  `category: ${scored - categoryMisses}/${scored} acceptable, ${hazardsAsActivity} hazard(s) labelled activity`,
);
if (failed) process.exitCode = 1;
