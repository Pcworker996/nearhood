import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const model = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
const script = fileURLToPath(
  new URL("./check-report-model.ts", import.meta.url),
);
const loader = createRequire(import.meta.url).resolve("tsx/esm");

async function runCheck(configured: boolean, chatStatus = 200) {
  const requests: { method?: string; path?: string; body: unknown }[] = [];
  const directory = await mkdtemp(join(tmpdir(), "nearhood-model-check-"));
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString())
      : null;
    requests.push({ method: req.method, path: req.url, body });
    res.setHeader("content-type", "application/json");
    if (req.headers.authorization !== "Bearer fixture-only-key") {
      res.writeHead(401).end(JSON.stringify({ error: "Missing bearer token" }));
      return;
    }
    if (req.method === "GET" && req.url === "/v1/models") {
      res.end(JSON.stringify({ data: [{ id: model }, { id: "other/model" }] }));
      return;
    }
    if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
      res.writeHead(404).end(JSON.stringify({ error: "Unknown endpoint" }));
      return;
    }
    if (chatStatus !== 200) {
      res
        .writeHead(chatStatus)
        .end(JSON.stringify({ error: "Fixture failure" }));
      return;
    }
    assert.equal(req.headers["content-type"], "application/json");
    assert.equal(body.model, model);
    assert.equal(body.response_format.type, "json_schema");
    const input = JSON.parse(body.messages[1].content);
    const extracting =
      body.response_format.json_schema.name.startsWith("report_extraction_");
    const observations = input.report.originalText
      .split(/(?<=[.!?])\s+/)
      .map((passage: string, index: number) => ({
        key: `o${index}`,
        subject: passage.slice(0, 80),
        sourceRef: "submitted_report",
        sourceIds: [
          input.sourcePassages?.[
            Math.min(index, (input.sourcePassages?.length ?? 1) - 1)
          ]?.id ?? "s0",
        ],
        occurrenceGroup: input.report.originalText.includes("Across town")
          ? index
          : 0,
        describedCondition: null,
        spatialScope: null,
        timeWording: null,
        uncertainty: null,
      }));
    if (extracting) assert.equal(input.candidates, undefined);
    else assert.ok(input.extraction);
    res.end(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify(
                extracting
                  ? {
                      category: "disruption",
                      observations,
                    }
                  : {
                      assessments: input.candidates.map(
                        (candidate: {
                          id: string;
                          evidence: { observationId: string }[];
                        }) => ({
                          candidateId: candidate.id,
                          continuity: input.report.originalText.includes(
                            "unrelated sticker",
                          )
                            ? "separate"
                            : input.report.originalText.includes(
                                  "repaired between",
                                )
                              ? "unknown"
                              : "same",
                          chronology: "consistent",
                          scope: "same",
                          evidenceIds: [candidate.evidence[0].observationId],
                          reason: "The evidence describes the same occurrence.",
                        }),
                      ),
                    },
              ),
            },
          },
        ],
      }),
    );
  });
  try {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const execution = await new Promise<{
      code: number;
      stdout: string;
      stderr: string;
    }>((resolve) => {
      execFile(
        process.execPath,
        ["--import", pathToFileURL(loader).href, script],
        {
          cwd: directory,
          timeout: 20000,
          env: {
            ...process.env,
            NEBIUS_API_KEY: "fixture-only-key",
            NEBIUS_MODEL: configured ? model : "",
            NEBIUS_BASE_URL: `http://127.0.0.1:${address.port}/v1/`,
          },
        },
        (error, stdout, stderr) =>
          resolve({ code: error ? 1 : 0, stdout, stderr }),
      );
    });
    const evidence = JSON.parse(
      await readFile(join(directory, ".local/report-model-check.json"), "utf8"),
    );
    return { ...execution, requests, evidence };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(directory, { recursive: true, force: true });
  }
}

test("configured model uses POST chat completions without model discovery", async () => {
  const result = await runCheck(true);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.evidence.selected, model);
  assert.equal(result.requests.length, 15);
  assert.ok(
    result.requests.every(
      (request) =>
        request.method === "POST" && request.path === "/v1/chat/completions",
    ),
  );
  assert.equal(result.evidence.results[0].checks[0].matching.kind, "match");
});

test("unset model discovers exact IDs with GET models before chat checks", async () => {
  const result = await runCheck(false);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.evidence.selected, model);
  assert.equal(result.requests.length, 16);
  assert.equal(result.requests[0].method, "GET");
  assert.equal(result.requests[0].path, "/v1/models");
});

test("a failed chat request reports HTTP status and never selects a model", async () => {
  const result = await runCheck(true, 401);
  assert.equal(result.code, 1);
  assert.equal(result.evidence.selected, null);
  assert.match(result.stdout, /HTTP 401/);
  assert.ok(
    result.evidence.results[0].checks.every(
      (check: { passed: boolean }) => !check.passed,
    ),
  );
});
