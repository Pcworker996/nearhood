import { mkdir, writeFile } from "node:fs/promises";
import { extractReport } from "../src/lib/report-model";

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
).replace(/\/$/, "");
const response = await fetch(`${base}/models`, {
  headers: { Authorization: `Bearer ${process.env.NEBIUS_API_KEY}` },
  signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw Error(`Model discovery failed (${response.status}).`);
const available = await response.json();
const candidates = (available.data as { id: string }[])
  .map((m) => m.id)
  .filter((id) => /^nvidia\//i.test(id) && /nemotron/i.test(id));
const requested = process.env.NEBIUS_MODEL;
if (requested && !candidates.includes(requested))
  throw Error(
    "Configured model is not an available NVIDIA Nemotron identifier.",
  );
const models = requested ? [requested] : candidates.slice(0, 3);
if (!models.length) throw Error("No available NVIDIA Nemotron model found.");
const examples = [
  {
    originalText:
      "The north entrance has a barrier. The south entrance has a barrier.",
    observedAt: "2026-10-19T12:00:00Z",
    provenance: "firsthand",
    sourceUrl: null,
    sameOccurrence: true,
  },
  {
    originalText: "A community notice says the riverside path is closed.",
    observedAt: null,
    provenance: "source_based",
    sourceUrl: "https://example.test/notice",
    sameOccurrence: true,
  },
  {
    originalText:
      "A tree blocks the park path. Across town, a separate streetlamp is broken.",
    observedAt: null,
    provenance: "firsthand",
    sourceUrl: null,
    sameOccurrence: false,
  },
];
const results = [];
for (const model of models) {
  process.env.NEBIUS_MODEL = model;
  const checks = [];
  for (const { sameOccurrence, ...input } of examples) {
    const start = performance.now();
    try {
      const result = await extractReport(input);
      if (result.extraction.sameOccurrence !== sameOccurrence)
        throw Error("Occurrence boundary was incorrect.");
      if (
        input.originalText.startsWith("The north") &&
        result.extraction.observations.length < 2
      )
        throw Error("Distinct claims were collapsed.");
      checks.push({
        passed: true,
        latencyMs: Math.round(performance.now() - start),
        input,
        extraction: result.extraction,
      });
    } catch (error) {
      checks.push({
        passed: false,
        latencyMs: Math.round(performance.now() - start),
        input,
        error: error instanceof Error ? error.message : "Integration failed",
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
  ".local/report-model-check.json",
  JSON.stringify(
    { checkedAt: new Date().toISOString(), selected, results },
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
      })),
      evidence: ".local/report-model-check.json",
    },
    null,
    2,
  ),
);
if (!selected) process.exitCode = 1;
