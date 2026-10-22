import { mkdir, writeFile } from "node:fs/promises";
import {
  extractReport,
  EXTRACTION_VERSION,
  MATCHING_VERSION,
} from "../src/lib/report-model";
import { extractReport as baselineExtractReport } from "./report-model-baseline";
const baseline = process.argv.includes("--baseline");
const heldOut = process.argv.includes("--held-out");
const artifact = heldOut
  ? baseline
    ? ".local/report-model-baseline-held-out.json"
    : ".local/report-model-held-out.json"
  : baseline
    ? ".local/report-model-baseline.json"
    : ".local/report-model-check.json";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* Shell configuration is also supported. */
}
if (!process.env.NEBIUS_API_KEY)
  throw Error(
    "Configure NEBIUS_API_KEY in .env.local or the shell. No live check has run.",
  );
const base = (
  process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1"
).replace(/\/+$/, "");
process.env.NEBIUS_BASE_URL = base;

async function modelsToCheck(): Promise<string[]> {
  const requested = process.env.NEBIUS_MODEL?.trim();
  if (requested) {
    if (!/^nvidia\//i.test(requested) || !/nemotron/i.test(requested))
      throw Error("NEBIUS_MODEL must be an exact NVIDIA Nemotron model ID.");
    // Inference uses POST /chat/completions with the model in the JSON body.
    // A configured model does not require access to the discovery endpoint.
    return [requested];
  }
  const response = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${process.env.NEBIUS_API_KEY}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw Error(`Nebius model discovery failed (HTTP ${response.status}).`);
  const available = await response.json();
  if (!Array.isArray(available.data))
    throw Error("Nebius model discovery returned an invalid model list.");
  const candidates = available.data
    .map((model: { id?: unknown }) => model?.id)
    .filter(
      (id: unknown): id is string =>
        typeof id === "string" && /^nvidia\//i.test(id) && /nemotron/i.test(id),
    );
  const models = [...new Set<string>(candidates)].slice(0, 3);
  if (!models.length) throw Error("No available NVIDIA Nemotron model found.");
  return models;
}

const models = await modelsToCheck();
console.log(
  `Checking ${models.length} model(s) via POST ${base}/chat/completions`,
);
const bridgeCandidate = {
  id: "bridge",
  title: "Eastbank footbridge closure",
  category: "disruption" as const,
  locationName: "Eastbank footbridge",
  lat: 42.3328,
  lng: -83.0457,
  distanceMeters: 0,
  evidence: [
    {
      observationId: "bridge-bars",
      reportId: "bridge-report",
      originalText: "Both entrances have orange barriers across the path.",
      displayName: "A nearby contributor",
      observedAt: "2026-10-19T11:30:00Z",
      submittedAt: "2026-10-19T11:35:00Z",
      provenance: "firsthand" as const,
      sourceUrl: null,
      reportLocationName: "Eastbank footbridge",
      lat: 42.3328,
      lng: -83.0457,
      subject: "Both entrances",
      describedState: "Both entrances have orange barriers across the path.",
      spatialScope: "Both entrances",
    },
  ],
};
const lampCandidate = {
  ...bridgeCandidate,
  id: "lamp",
  title: "Streetlamp outage",
  locationName: "Alder and 3rd",
  evidence: [
    {
      ...bridgeCandidate.evidence[0],
      observationId: "lamp-dark",
      reportId: "lamp-report",
      originalText: "At 10 pm, the streetlamp at Alder and 3rd was dark.",
      subject: "streetlamp",
      describedState: "Reported dark",
      spatialScope: "Alder and 3rd",
      observedAt: "2026-10-19T02:00:00Z",
      submittedAt: "2026-10-19T02:05:00Z",
      reportLocationName: "Alder and 3rd",
    },
  ],
};
const developmentExamples = [
  {
    originalText: "The same orange barriers still block the footbridge.",
    observedAt: "2026-10-19T12:00:00Z",
    locationName: "Eastbank footbridge",
    lat: 42.3328,
    lng: -83.0457,
    provenance: "firsthand" as const,
    sourceUrl: null,
    candidateHint: "bridge",
    candidates: [bridgeCandidate],
    sameOccurrence: true,
    matchingKind: "match",
    minimumObservations: 1,
  },
  {
    originalText:
      "The north entrance has orange barriers. The south entrance is open.",
    observedAt: "2026-10-19T12:00:00Z",
    locationName: "Eastbank footbridge",
    lat: 42.3328,
    lng: -83.0457,
    provenance: "firsthand" as const,
    sourceUrl: null,
    candidateHint: "bridge",
    candidates: [bridgeCandidate],
    sameOccurrence: true,
    matchingKind: "match",
    minimumObservations: 2,
  },
  {
    originalText: "A community notice says the riverside path is closed.",
    observedAt: null,
    locationName: "Riverside path",
    lat: 42.333,
    lng: -83.046,
    provenance: "source_based" as const,
    sourceUrl: "https://example.test/notice",
    candidateHint: null,
    candidates: [],
    sameOccurrence: true,
    matchingKind: "no_match",
    minimumObservations: 1,
  },
  {
    originalText:
      "A tree blocks the park path. Across town, a separate streetlamp is broken.",
    observedAt: null,
    locationName: "Eastbank park",
    lat: 42.334,
    lng: -83.047,
    provenance: "firsthand" as const,
    sourceUrl: null,
    candidateHint: null,
    candidates: [],
    sameOccurrence: false,
    matchingKind: "no_match",
    minimumObservations: 2,
  },
  ...[
    {
      originalText:
        "That corner at Alder and 3rd is still dark; the lamp is not lighting.",
      matchingKind: "match",
    },
    {
      originalText:
        "An unrelated sticker has been placed on the pole at Alder and 3rd. I am not reporting the lighting problem.",
      matchingKind: "no_match",
    },
    {
      originalText:
        "At 10 pm, the streetlamp at Alder and 3rd is lit. This conflicts with the report that it was dark then.",
      matchingKind: "match",
    },
    {
      originalText:
        "The lamp at Alder and 3rd is dark again. I do not know whether it was repaired between observations.",
      matchingKind: "uncertain",
    },
  ].map((example) => ({
    ...example,
    observedAt: "2026-10-19T02:00:00Z",
    locationName: "Alder and 3rd",
    lat: 42.3328,
    lng: -83.0457,
    provenance: "firsthand" as const,
    sourceUrl: null,
    candidateHint: null,
    candidates: [lampCandidate],
    sameOccurrence: true,
    minimumObservations: 1,
  })),
];
// Frozen after v5/v3; inspect these once, without tuning against their outcomes.
const heldOutExamples = [
  {
    originalText:
      "I walked through the south entrance of Eastbank footbridge just now. At the north entrance, the orange barriers remain across the path.",
    matchingKind: "match",
    minimumObservations: 2,
  },
  {
    originalText:
      "At 11:30 both footbridge entrances were clear of barriers. My observation disagrees with the report saying both were blocked then.",
    matchingKind: "match",
    minimumObservations: 1,
    observedAt: "2026-10-19T11:30:00Z",
  },
  {
    originalText:
      "A new pothole is in the footbridge deck. This is a separate issue from the orange entrance barriers; I am reporting only the pothole.",
    matchingKind: "no_match",
    minimumObservations: 1,
  },
  {
    originalText:
      "After a week away I see orange barriers across the footbridge entrance. I did not observe whether it reopened or closed again while I was away.",
    matchingKind: "uncertain",
    minimumObservations: 1,
    observedAt: "2026-10-26T12:00:00Z",
  },
].map((example) => ({
  observedAt: "2026-10-19T12:00:00Z",
  ...example,
  locationName: "Eastbank footbridge",
  lat: 42.3328,
  lng: -83.0457,
  provenance: "firsthand" as const,
  sourceUrl: null,
  candidateHint: null,
  candidates: [bridgeCandidate],
  sameOccurrence: true,
}));
const examples = heldOut ? heldOutExamples : developmentExamples;

const results = [];
for (const model of models) {
  process.env.NEBIUS_MODEL = model;
  const checks = [];
  let caseIndex = 0;
  for (const {
    sameOccurrence,
    matchingKind,
    minimumObservations,
    ...input
  } of examples) {
    const split = heldOut
      ? "held_out"
      : caseIndex++ < 4
        ? "development"
        : "development_former_holdout";
    const start = performance.now();
    let observedResult: unknown = null;
    try {
      const result = await (baseline
        ? baselineExtractReport(input)
        : extractReport(input));
      observedResult = result;
      if (result.extraction.sameOccurrence !== sameOccurrence)
        throw Error("Occurrence boundary was incorrect.");
      if (result.matching.kind !== matchingKind)
        throw Error("Semantic match result was incorrect.");
      if (result.extraction.observations.length < minimumObservations)
        throw Error("Distinct scoped Observations were collapsed.");
      checks.push({
        passed: true,
        split,
        latencyMs: Math.round(performance.now() - start),
        input,
        extraction: result.extraction,
        matching: result.matching,
        runs: "runs" in result ? result.runs : undefined,
      });
    } catch (error) {
      checks.push({
        passed: false,
        split,
        latencyMs: Math.round(performance.now() - start),
        input,
        error: error instanceof Error ? error.message : "Integration failed",
        result: observedResult,
      });
    }
  }
  results.push({ model, checks });
}
const eligible = results
  .filter((r) => r.checks.every((c) => c.passed))
  .sort(
    (a, b) =>
      a.checks.reduce((sum, c) => sum + c.latencyMs, 0) -
      b.checks.reduce((sum, c) => sum + c.latencyMs, 0),
  );
const selected = eligible[0]?.model ?? null;
await mkdir(".local", { recursive: true });
await writeFile(
  artifact,
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      strategy: baseline ? "combined-fafe184" : "staged-v1",
      versions: baseline ? null : [EXTRACTION_VERSION, MATCHING_VERSION],
      selected,
      results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      selected,
      results: results.map((r) => ({
        model: r.model,
        passed: r.checks.every((c) => c.passed),
        latencyMs: r.checks.map((c) => c.latencyMs),
        errors: r.checks.flatMap((c) => ("error" in c ? [c.error] : [])),
      })),
      evidence: artifact,
    },
    null,
    2,
  ),
);
if (!selected) process.exitCode = 1;
