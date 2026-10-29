import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { MatchCandidate } from "../src/lib/happenings";
import {
  compareReport,
  extractReportInfo,
  EXTRACTION_VERSION,
  type Extraction,
  type ModelRun,
  type ReportContext,
} from "../src/lib/report-model";

const fixtureDirectory = fileURLToPath(
  new URL("./fixtures/extraction/", import.meta.url),
);
const model = "nvidia/nemotron-3-extraction-fixture";

type ExtractionFixture = {
  report: ReportContext;
  model: unknown;
  expected?: Extraction;
  error?: string;
};
type ModelRequest = {
  body: Record<string, unknown>;
  input: Record<string, unknown>;
};

// Serves one controlled chat completion per request. `respond` sets the model's
// JSON content; `respondRaw` replaces the whole provider response.
async function withModel(
  run: (model: {
    respond: (content: unknown) => void;
    respondRaw: (body: unknown) => void;
    requests: ModelRequest[];
  }) => Promise<void>,
) {
  const requests: ModelRequest[] = [];
  let content: unknown = null;
  let raw: unknown = null;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const input = JSON.parse(body.messages[1].content);
    requests.push({ body, input });
    assert.equal(req.headers.authorization, "Bearer fixture-only-key");
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify(
        raw ?? {
          usage: { prompt_tokens: 11, completion_tokens: 7 },
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(content) },
            },
          ],
        },
      ),
    );
  });
  const previous = {
    NEBIUS_API_KEY: process.env.NEBIUS_API_KEY,
    NEBIUS_MODEL: process.env.NEBIUS_MODEL,
    NEBIUS_BASE_URL: process.env.NEBIUS_BASE_URL,
  };
  try {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    process.env.NEBIUS_API_KEY = "fixture-only-key";
    process.env.NEBIUS_MODEL = model;
    process.env.NEBIUS_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
    await run({
      respond: (value) => {
        raw = null;
        content = value;
      },
      respondRaw: (value) => {
        raw = value;
      },
      requests,
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function outcome(report: ReportContext) {
  try {
    return await extractReportInfo(report);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "failed" };
  }
}

test("saved extraction output follows the fixture checkpoint", async () => {
  const files = (await readdir(fixtureDirectory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  await withModel(async ({ respond, requests }) => {
    const failures: string[] = [];
    for (const file of files) {
      const fixture = JSON.parse(
        await readFile(join(fixtureDirectory, file), "utf8"),
      ) as ExtractionFixture;
      respond(fixture.model);
      const before = requests.length;
      try {
        const output = await outcome(fixture.report);
        console.log(`# ${file}\n${JSON.stringify(output, null, 2)}`);
        if (fixture.error) {
          assert.deepEqual(output, { error: fixture.error });
        } else {
          assert.ok(!("error" in output));
          const result = output as { extraction: Extraction; run: ModelRun };
          assert.deepEqual(result.extraction, fixture.expected);
          assert.equal(result.run.version, EXTRACTION_VERSION);
          assert.equal(result.run.model, model);
          assert.equal(result.run.thinking, "disabled");
          assert.deepEqual(result.run.usage, {
            promptTokens: 11,
            completionTokens: 7,
          });
        }
        const request = requests[before];
        assert.equal(request.input.candidates, undefined);
        assert.equal(request.body.temperature, 0);
        assert.deepEqual(request.body.chat_template_kwargs, {
          enable_thinking: false,
        });
        assert.equal(
          (request.body.response_format as { json_schema: { name: string } })
            .json_schema.name,
          EXTRACTION_VERSION.replaceAll("-", "_"),
        );
        const passages = request.input.sourcePassages as {
          id: string;
          text: string;
        }[];
        assert.equal(
          passages.map((passage) => passage.text).join(""),
          fixture.report.originalText,
        );
      } catch (error) {
        failures.push(
          `${file}: ${error instanceof Error ? error.message : "failed"}`,
        );
      }
    }
    assert.deepEqual(failures, []);
  });
});

const report: ReportContext = {
  originalText:
    "The north entrance has orange barriers. The south entrance is open.",
  observedAt: null,
  locationName: "Eastbank footbridge",
  lat: 42.3328,
  lng: -83.0457,
  provenance: "firsthand",
  sourceUrl: null,
};
const observation = (overrides: Record<string, unknown> = {}) => ({
  key: "north",
  subject: "North entrance",
  sourceRef: "submitted_report",
  sourceIds: ["s0"],
  occurrenceGroup: 0,
  describedCondition: "blocked by orange barriers",
  spatialScope: "north entrance",
  timeWording: null,
  uncertainty: null,
  ...overrides,
});
const valid = (overrides: Record<string, unknown> = {}) => ({
  category: "disruption",
  observations: [observation()],
  ...overrides,
});

test("each category value is kept as the model proposed it", async () => {
  await withModel(async ({ respond }) => {
    for (const category of ["disruption", "safety", "activity"]) {
      respond(valid({ category }));
      const output = await outcome(report);
      assert.ok("extraction" in output, JSON.stringify(output));
      assert.equal(output.extraction.category, category);
    }
  });
});

test("invalid model output never becomes an extraction", async () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => observation({ key: `o${i}` }));
  const { category: _category, ...withoutCategory } = valid();
  const cases: [string, unknown, string][] = [
    ["extra property", valid({ notes: "x" }), "Invalid model structure"],
    ["missing property", withoutCategory, "Invalid model structure"],
    [
      "capitalized category",
      valid({ category: "Disruption" }),
      "Invalid model assessment",
    ],
    [
      "unknown category",
      valid({ category: "other" }),
      "Invalid model assessment",
    ],
    ["null category", valid({ category: null }), "Invalid model assessment"],
    [
      "13 Observations",
      valid({ observations: many(13) }),
      "Invalid Observations",
    ],
    [
      "13 source IDs",
      valid({
        observations: [
          observation({
            sourceIds: Array.from({ length: 13 }, (_, i) => `s${i}`),
          }),
        ],
      }),
      "Unsupported Observation source passage",
    ],
    [
      "duplicate source IDs",
      valid({ observations: [observation({ sourceIds: ["s0", "s0"] })] }),
      "Unsupported Observation source passage",
    ],
    [
      "duplicate keys",
      valid({
        observations: [
          observation(),
          observation({ sourceIds: ["s1"], spatialScope: "south entrance" }),
        ],
      }),
      "Unsupported Observation passage",
    ],
    [
      "key with a space",
      valid({ observations: [observation({ key: "north gate" })] }),
      "Unsupported Observation passage",
    ],
    ...[12, -1, 1.5, "0"].map((group): [string, unknown, string] => [
      `occurrence group ${JSON.stringify(group)}`,
      valid({ observations: [observation({ occurrenceGroup: group })] }),
      "Invalid occurrence group",
    ]),
    [
      "blank subject",
      valid({ observations: [observation({ subject: "  " })] }),
      "Invalid model text",
    ],
    [
      "81-character subject",
      valid({ observations: [observation({ subject: "x".repeat(81) })] }),
      "Invalid model text",
    ],
    [
      "161-character condition",
      valid({
        observations: [observation({ describedCondition: "x".repeat(161) })],
      }),
      "Invalid model text",
    ],
    [
      "scope taken from the location name, not the text",
      valid({ observations: [observation({ spatialScope: "footbridge" })] }),
      "Unsupported scope/time wording",
    ],
  ];
  await withModel(async ({ respond }) => {
    const failures: string[] = [];
    for (const [name, response, error] of cases) {
      respond(response);
      const output = await outcome(report);
      if (!("error" in output) || output.error !== error)
        failures.push(`${name}: ${JSON.stringify(output).slice(0, 200)}`);
    }
    assert.deepEqual(failures, []);
  });
});

test("truncated, refused or non-JSON provider output is rejected", async () => {
  const choice = (overrides: Record<string, unknown>) => ({
    choices: [
      {
        finish_reason: "stop",
        message: { content: JSON.stringify(valid()) },
        ...overrides,
      },
    ],
  });
  await withModel(async ({ respondRaw }) => {
    respondRaw(choice({ finish_reason: "length" }));
    assert.deepEqual(await outcome(report), {
      error: "Incomplete model output (length)",
    });
    respondRaw(
      choice({
        message: { content: null, refusal: "I cannot help with that" },
      }),
    );
    assert.deepEqual(await outcome(report), {
      error: "Incomplete model output (stop)",
    });
    respondRaw(choice({ message: { content: "{not json" } }));
    assert.ok("error" in (await outcome(report)));
  });
});

test("matching receives candidates of every category and category does not veto identity", async () => {
  const candidate = (
    id: string,
    category: MatchCandidate["category"],
  ): MatchCandidate => ({
    id,
    title: `Candidate ${id}`,
    category,
    locationName: "Eastbank footbridge",
    distanceMeters: 40,
    lat: 42.3328,
    lng: -83.0457,
    evidence: [
      {
        observationId: `${id}-o1`,
        reportId: `${id}-r1`,
        originalText: "The north entrance has orange barriers.",
        displayName: "Neighbor",
        observedAt: null,
        submittedAt: "2026-10-19T12:00:00Z",
        provenance: "firsthand",
        sourceUrl: null,
        reportLocationName: "Eastbank footbridge",
        lat: 42.3328,
        lng: -83.0457,
        subject: "North entrance",
        describedState: "blocked by orange barriers",
        spatialScope: "north entrance",
      },
    ],
  });
  const candidates = [
    candidate("safety-one", "safety"),
    candidate("activity-one", "activity"),
  ];
  await withModel(async ({ respond, requests }) => {
    respond(valid());
    const extracted = await extractReportInfo(report);
    respond({
      assessments: [
        {
          candidateId: "safety-one",
          continuity: "same",
          chronology: "consistent",
          scope: "same",
          evidenceIds: ["safety-one-o1"],
          reason: "Same barriers at the north entrance.",
        },
        {
          candidateId: "activity-one",
          continuity: "separate",
          chronology: "consistent",
          scope: "different",
          evidenceIds: ["activity-one-o1"],
          reason: "A different situation.",
        },
      ],
    });
    const compared = await compareReport(
      report,
      extracted.extraction,
      candidates,
      {},
    );
    const sent = requests.at(-1)!.input.candidates as {
      id: string;
      category: string;
    }[];
    assert.deepEqual(
      sent.map((c) => [c.id, c.category]),
      [
        ["safety-one", "safety"],
        ["activity-one", "activity"],
      ],
    );
    assert.equal(extracted.extraction.category, "disruption");
    assert.deepEqual(compared.matching, {
      kind: "match",
      candidateId: "safety-one",
      evidenceIds: ["safety-one-o1"],
      reason: "Same barriers at the north entrance.",
    });
  });
});
