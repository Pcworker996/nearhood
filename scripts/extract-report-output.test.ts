import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
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

test("saved extraction output follows the fixture checkpoint", async () => {
  const files = (await readdir(fixtureDirectory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const requests: { body: Record<string, unknown>; input: Record<string, unknown> }[] =
    [];
  let responseBody: unknown = null;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const input = JSON.parse(body.messages[1].content);
    requests.push({ body, input });
    assert.equal(req.headers.authorization, "Bearer fixture-only-key");
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        usage: { prompt_tokens: 11, completion_tokens: 7 },
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(responseBody) },
          },
        ],
      }),
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

    const failures: string[] = [];
    for (const file of files) {
      const fixture = JSON.parse(
        await readFile(join(fixtureDirectory, file), "utf8"),
      ) as ExtractionFixture;
      responseBody = fixture.model;
      const before = requests.length;
      try {
        let output: { extraction: Extraction; run: ModelRun } | { error: string };
        try {
          output = await extractReportInfo(fixture.report);
        } catch (error) {
          output = {
            error: error instanceof Error ? error.message : "failed",
          };
        }
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
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
