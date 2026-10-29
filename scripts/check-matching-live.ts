import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  compareReport,
  MATCHING_VERSION,
  MODEL_TIMEOUT_MS,
} from "../src/lib/report-model";
import { matchingCases } from "./matching-fixtures";
import {
  providerUsage,
  scoreMatching,
  validateCase,
} from "./matching-evaluation";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* Explicit shell configuration is supported. */
}
function option(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}
const repeats = Number(option("--repeats", "3"));
const limit = Number(option("--limit", String(matchingCases.length)));
const dryRun = process.argv.includes("--dry-run");
const seed = option("--seed", "matching-development-2026-10-27");
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const hashJSON = (value: unknown) => hash(JSON.stringify(value));
assert.ok(Number.isSafeInteger(repeats) && repeats >= 1 && repeats <= 3);
assert.ok(
  Number.isSafeInteger(limit) && limit >= 1 && limit <= matchingCases.length,
);
const selected = matchingCases.slice(0, limit);
selected.forEach(validateCase);
const model = process.env.NEBIUS_MODEL;
if (!dryRun)
  assert.ok(
    process.env.NEBIUS_API_KEY &&
      model &&
      /^nvidia\//i.test(model) &&
      /nemotron/i.test(model),
    "Configure exact Nemotron model and key before live evaluation",
  );

const output = resolve(
  option(
    "--output",
    `.local/matching-evals/${new Date().toISOString().replaceAll(":", "-")}`,
  ),
);
await mkdir(output, { recursive: true });
// Exclusive creation prevents accidental append into a previous run.
await writeFile(
  `${output}/manifest.json`,
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      layer: dryRun
        ? "offline-fixture-validation"
        : "live-matching-development",
      model: model ?? null,
      matchingVersion: MATCHING_VERSION,
      repeats,
      seed,
      temperature: 0,
      maxTokens: 8192,
      timeoutMs: MODEL_TIMEOUT_MS,
      author: "Codex",
      independentLabels: false,
      heldOutCases: 0,
      productionSourceHash: hash(
        await readFile(
          new URL("../src/lib/report-model.ts", import.meta.url),
          "utf8",
        ),
      ),
      fixturesSourceHash: hash(
        await readFile(
          new URL("./matching-fixtures.ts", import.meta.url),
          "utf8",
        ),
      ),
      cases: selected.map((c) => ({ ...c, packetHash: hashJSON(c.input) })),
    },
    null,
    2,
  ),
  { flag: "wx" },
);

if (dryRun) {
  console.log(
    JSON.stringify({
      output,
      cases: selected.length,
      bases: selected.filter((c) => !c.baseId).length,
      variants: selected.filter((c) => c.baseId).length,
      plannedCalls: selected.length * repeats,
      liveCalls: 0,
    }),
  );
  process.exit(0);
}

let captured: {
  request?: unknown;
  response?: unknown;
  inputBytes?: number;
  promptHash?: string;
  schemaHash?: string;
} = {};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  assert.equal(
    String(url),
    `${(process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1").replace(/\/$/, "")}/chat/completions`,
  );
  assert.equal(init?.method, "POST");
  assert.equal(typeof init?.body, "string");
  const request: unknown = JSON.parse(String(init?.body));
  assert.ok(
    request &&
      typeof request === "object" &&
      "messages" in request &&
      Array.isArray(request.messages),
  );
  const messages: unknown[] = request.messages;
  const [system, user] = messages;
  assert.ok(
    system &&
      typeof system === "object" &&
      "content" in system &&
      typeof system.content === "string",
  );
  assert.ok(
    user &&
      typeof user === "object" &&
      "content" in user &&
      typeof user.content === "string",
  );
  assert.ok("response_format" in request);
  const format = request.response_format;
  assert.ok(format && typeof format === "object" && "json_schema" in format);
  const schema = format.json_schema;
  assert.ok(
    schema &&
      typeof schema === "object" &&
      "name" in schema &&
      schema.name === MATCHING_VERSION.replaceAll("-", "_"),
  );
  const packet: unknown = JSON.parse(user.content);
  assert.ok(packet && typeof packet === "object" && !("expected" in packet));
  captured = {
    request,
    inputBytes: Buffer.byteLength(user.content),
    promptHash: hash(system.content),
    schemaHash: hashJSON(schema),
  };
  const response = await originalFetch(url, init);
  const raw = await response.clone().text();
  try {
    captured.response = JSON.parse(raw);
  } catch {
    captured.response = raw;
  }
  return response;
};

const schedule = selected
  .flatMap((c) =>
    Array.from({ length: repeats }, (_, i) => ({ c, trial: i + 1 })),
  )
  .sort((a, b) =>
    hash(`${seed}:${a.c.id}:${a.trial}`).localeCompare(
      hash(`${seed}:${b.c.id}:${b.trial}`),
    ),
  );
type Trial = {
  caseId: string;
  baseId: string | null;
  family: string;
  trial: number;
  latencyMs: number;
  result: Awaited<ReturnType<typeof compareReport>> | null;
  error: string | null;
  score: ReturnType<typeof scoreMatching> | null;
  usage: ReturnType<typeof providerUsage>;
};
const trials: Trial[] = [];
for (const { c, trial } of schedule) {
  captured = {};
  const started = performance.now();
  let result: Trial["result"] = null;
  let error: string | null = null;
  let score: Trial["score"] = null;
  try {
    result = await compareReport(...c.input);
    score = scoreMatching(c.expected, result.assessments, result.matching);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const record = {
    caseId: c.id,
    baseId: c.baseId ?? null,
    family: c.family,
    trial,
    latencyMs: Math.round(performance.now() - started),
    result,
    error,
    score,
    usage: providerUsage(captured.response),
  };
  trials.push(record);
  await appendFile(
    `${output}/attempts.jsonl`,
    `${JSON.stringify({ ...record, packetHash: hashJSON(c.input), captured, manualReview: "pending" })}\n`,
  );
  console.log(
    `${trials.length}/${schedule.length} ${c.id} trial ${trial}: ${error ?? (score?.modelErrors.length ? score.modelErrors.join("; ") : "automated pass")} ${record.latencyMs}ms`,
  );
  if (error?.includes("HTTP 401") || error?.includes("HTTP 403")) break;
}
globalThis.fetch = originalFetch;

function summary(group: Trial[]) {
  const matrix: Record<string, Record<string, number>> = {};
  for (const t of group) {
    const c = selected.find((c) => c.id === t.caseId)!;
    for (const gold of c.expected.assessments) {
      const actual =
        t.result?.assessments.find((a) => a.candidateId === gold.candidateId)
          ?.continuity ?? "invalid_or_missing";
      matrix[gold.continuity] ??= {};
      matrix[gold.continuity][actual] =
        (matrix[gold.continuity][actual] ?? 0) + 1;
    }
  }
  const caseIds = [...new Set(group.map((t) => t.caseId))];
  const latency = group.map((t) => t.latencyMs).sort((a, b) => a - b);
  return {
    attempted: group.length,
    automatedModelPass: group.filter((t) => t.score?.modelErrors.length === 0)
      .length,
    adapterPass: group.filter((t) => t.score?.adapterCorrect).length,
    providerOrContractFailures: group.filter((t) => t.error).length,
    allRepeatsAutomatedPass: caseIds.filter((id) => {
      const ts = group.filter((t) => t.caseId === id);
      return (
        ts.length === repeats &&
        ts.every((t) => t.score?.modelErrors.length === 0)
      );
    }).length,
    caseCount: caseIds.length,
    continuityMatrix: matrix,
    latencyMs: {
      min: latency[0] ?? null,
      p50: latency[Math.ceil(latency.length * 0.5) - 1] ?? null,
      p95: latency[Math.ceil(latency.length * 0.95) - 1] ?? null,
      max: latency.at(-1) ?? null,
    },
    tokens: {
      prompt: group.reduce((n, t) => n + (t.usage.prompt ?? 0), 0),
      completion: group.reduce((n, t) => n + (t.usage.completion ?? 0), 0),
      missingUsageTrials: group.filter(
        (t) => t.usage.prompt === null || t.usage.completion === null,
      ).length,
    },
  };
}
const final = {
  model,
  matchingVersion: MATCHING_VERSION,
  completedAt: new Date().toISOString(),
  qualified: false,
  reason:
    "Development-only agent-authored labels; human grounding review pending; no independent held-out evaluation",
  scheduled: schedule.length,
  unattempted: schedule.length - trials.length,
  overall: summary(trials),
  bases: summary(trials.filter((t) => !t.baseId)),
  variants: summary(trials.filter((t) => t.baseId)),
  families: Object.fromEntries(
    [...new Set(trials.map((t) => t.family))].map((f) => [
      f,
      summary(trials.filter((t) => t.family === f)),
    ]),
  ),
  cases: selected.map((c) => ({
    id: c.id,
    baseId: c.baseId ?? null,
    expected: c.expected,
    review: c.review,
    trials: trials.filter((t) => t.caseId === c.id),
  })),
};
await writeFile(`${output}/summary.json`, JSON.stringify(final, null, 2));
console.log(
  JSON.stringify({ output, overall: final.overall, qualified: false }),
);
if (
  final.overall.automatedModelPass !== schedule.length ||
  final.overall.adapterPass !== schedule.length
)
  process.exitCode = 1;
