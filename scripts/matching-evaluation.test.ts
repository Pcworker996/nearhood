import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreMatching, type MatchingCase } from "./matching-evaluation";
import { providerUsage, validateCase } from "./matching-evaluation";
import { matchingCases } from "./matching-fixtures";
import {
  MATCHING_VERSION,
  type CandidateAssessment,
} from "../src/lib/report-model";

const expected: MatchingCase["expected"] = {
  assessments: [
    {
      candidateId: "bridge",
      continuity: "same",
      chronology: "change",
      requiredEvidence: ["barriers"],
    },
  ],
  first: "bridge",
  recommendation: { kind: "match", candidateId: "bridge" },
};
const good: CandidateAssessment = {
  candidateId: "bridge",
  continuity: "same",
  chronology: "change",
  scope: "overlapping",
  evidenceIds: ["barriers"],
  reason: "The south entrance reopened during the same closure.",
};
test("scores continuity, scope/time requirements and evidence independently of recommendation", () => {
  const scored = scoreMatching(expected, [good], {
    kind: "uncertain",
    evidenceIds: [],
    question: "Which?",
  });
  assert.deepEqual(scored.modelErrors, []);
  assert.equal(scored.adapterCorrect, false);
});
test("wrong same, false separation and abstention cannot pass an answerable case", () => {
  const alternatives: CandidateAssessment["continuity"][] = [
    "separate",
    "unknown",
  ];
  for (const continuity of alternatives) {
    assert.ok(
      scoreMatching(expected, [{ ...good, continuity }], { kind: "no_match" })
        .modelErrors.length,
    );
  }
  const separate: MatchingCase["expected"] = {
    ...expected,
    assessments: [{ candidateId: "bridge", continuity: "separate" }],
  };
  assert.ok(
    scoreMatching(separate, [good], { kind: "no_match" }).modelErrors.length,
  );
});
test("all 32 bases and 16 variants have complete candidate labels and exact incoming source support", () => {
  assert.equal(matchingCases.length, 48);
  assert.equal(matchingCases.filter((c) => !c.baseId).length, 32);
  assert.equal(new Set(matchingCases.map((c) => c.id)).size, 48);
  for (const c of matchingCases) validateCase(c);
});
test("a structurally valid but irrelevant reference does not meet evidence obligations", () => {
  assert.match(
    scoreMatching(expected, [{ ...good, evidenceIds: ["flowers"] }], {
      kind: "no_match",
    }).modelErrors.join(" "),
    /evidence/,
  );
});
test("missing output fails and an empty ranking requirement does not force an arbitrary tie order", () => {
  assert.ok(
    scoreMatching(expected, [], { kind: "no_match" }).modelErrors.length,
  );
  const tied = { ...expected, first: undefined };
  assert.deepEqual(
    scoreMatching(tied, [good], { kind: "no_match" }).modelErrors,
    [],
  );
});

test("usage remains available when schema validation rejects the response", () => {
  assert.deepEqual(
    providerUsage({ usage: { prompt_tokens: 1327, completion_tokens: 115 } }),
    { prompt: 1327, completion: 115 },
  );
  assert.deepEqual(providerUsage({ usage: { prompt_tokens: "1327" } }), {
    prompt: null,
    completion: null,
  });
});

test("runner makes only matching requests, never leaks labels, and retains all failed trials", async () => {
  let requests = 0;
  let maxBytes = 0;
  const schemas: { candidates: number; minItems: number; maxItems: number }[] =
    [];
  const directory = await mkdtemp(join(tmpdir(), "matching-evaluation-"));
  const server = createServer(async (req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/v1/chat/completions");
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(
      body.response_format.json_schema.name,
      MATCHING_VERSION.replaceAll("-", "_"),
    );
    const text = body.messages[1].content;
    const input = JSON.parse(text);
    const { minItems, maxItems } =
      body.response_format.json_schema.schema.properties.assessments;
    // Recorded, not asserted here: a throw would leave the request unanswered.
    schemas.push({
      candidates: input.candidates.length,
      minItems,
      maxItems,
    });
    maxBytes = Math.max(maxBytes, Buffer.byteLength(text));
    assert.equal(input.expected, undefined);
    assert.equal(input.review, undefined);
    assert.equal(
      input.extraction.observations[0].scopeOutsideCitation,
      undefined,
    );
    requests++;
    res.setHeader("content-type", "application/json");
    // Invalid evidence exercises production validation and failed-attempt recording.
    res.end(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                assessments: input.candidates.map((c: { id: string }) => ({
                  candidateId: c.id,
                  continuity: "unknown",
                  chronology: "unknown",
                  scope: "unknown",
                  evidenceIds: ["foreign-id"],
                  reason: "Stub-only failure.",
                })),
              }),
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }),
    );
  });
  try {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const result = await new Promise<{
      code: number;
      stdout: string;
      stderr: string;
    }>((resolve) => {
      execFile(
        process.execPath,
        [
          "--import",
          "tsx",
          fileURLToPath(new URL("./check-matching-live.ts", import.meta.url)),
          "--repeats",
          "1",
          "--output",
          join(directory, "run"),
        ],
        {
          env: {
            ...process.env,
            NEBIUS_API_KEY: "fixture-only",
            NEBIUS_MODEL: "nvidia/Nemotron-3-Ultra-550b-a55b",
            NEBIUS_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
          },
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) =>
          resolve({ code: error ? 1 : 0, stdout, stderr }),
      );
    });
    assert.equal(result.code, 1, result.stderr);
    assert.equal(requests, 48, result.stdout);
    // Every request demanded exactly one assessment per candidate, small packets to the 20-candidate limit.
    for (const s of schemas)
      assert.deepEqual(s, {
        candidates: s.candidates,
        minItems: s.candidates,
        maxItems: s.candidates,
      });
    for (const count of [1, 6, 20])
      assert.ok(
        schemas.some((s) => s.candidates === count),
        `${count}`,
      );
    assert.ok(
      maxBytes >= 48 * 1024 && maxBytes <= 60 * 1024,
      `Large packet bytes: ${maxBytes}`,
    );
    const records = (
      await readFile(join(directory, "run", "attempts.jsonl"), "utf8")
    )
      .trim()
      .split("\n");
    assert.equal(records.length, 48);
    for (const line of records) {
      const attempt = JSON.parse(line);
      assert.match(attempt.error, /Unsupported matching evidence/);
      assert.equal(attempt.result, null);
      assert.equal(attempt.manualReview, "pending");
      assert.ok(attempt.captured.request && attempt.captured.response);
      assert.equal(JSON.stringify(attempt).includes("fixture-only"), false);
    }
    const summary = JSON.parse(
      await readFile(join(directory, "run", "summary.json"), "utf8"),
    );
    assert.equal(summary.overall.tokens.prompt, 48);
    assert.equal(summary.overall.tokens.completion, 48);
    assert.equal(summary.overall.tokens.missingUsageTrials, 0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
