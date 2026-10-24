// External HTTP fixtures only. No imports of application storage or processing.
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";

const codes = new Map<string, { id: string; challenge: string }>();
const tokens = new Map<string, string>();
const scenarios = new Map<
  string,
  { mode: string; candidateId?: string; hold?: number }
>();
const calls = new Map<string, { extraction: number; matching: number }>();
const held = new Map<string, () => void>();
let cancelNextSignIn = false;
const user = (id: string) => ({
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "private-address@example.test",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: { full_name: "Private Google Name" },
  identities: [{ provider: "google", user_id: id }],
  created_at: "2026-10-19T12:00:00Z",
});
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, "http://127.0.0.1:3101");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length
    ? JSON.parse(Buffer.concat(chunks).toString())
    : {};
  const json = (value: unknown, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(value));
  };
  if (url.pathname === "/health") return json({ ok: true });
  if (url.pathname === "/control") {
    if (body.cancelNextSignIn) cancelNextSignIn = true;
    scenarios.set(body.text, {
      mode: body.mode,
      candidateId: body.candidateId,
      hold: body.hold,
    });
    return json({ ok: true });
  }
  if (url.pathname === "/release") {
    held.get(body.text)?.();
    held.delete(body.text);
    return json({ ok: true });
  }
  if (url.pathname === "/calls")
    return json(
      calls.get(url.searchParams.get("text")!) ?? {
        extraction: 0,
        matching: 0,
      },
    );
  if (url.pathname === "/auth/v1/authorize") {
    if (cancelNextSignIn) {
      cancelNextSignIn = false;
      const target = new URL(url.searchParams.get("redirect_to")!);
      target.searchParams.set("error", "access_denied");
      res.writeHead(302, { Location: target.href });
      return res.end();
    }
    if (url.searchParams.get("provider") !== "google")
      return json({ error: "Only Google" }, 400);
    const code = randomUUID();
    codes.set(code, {
      id: randomUUID(),
      challenge: url.searchParams.get("code_challenge")!,
    });
    const target = new URL(url.searchParams.get("redirect_to")!);
    target.searchParams.set("code", code);
    res.writeHead(302, { Location: target.href });
    return res.end();
  }
  if (url.pathname === "/auth/v1/token") {
    const code = codes.get(body.auth_code);
    if (
      !code ||
      createHash("sha256")
        .update(body.code_verifier ?? "")
        .digest("base64url") !== code.challenge
    )
      return json(
        { message: "Invalid PKCE", error_code: "bad_code_verifier" },
        400,
      );
    codes.delete(body.auth_code);
    const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: code.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
    tokens.set(jwt, code.id);
    return json({
      access_token: jwt,
      refresh_token: randomUUID(),
      token_type: "bearer",
      expires_in: 3600,
      user: user(code.id),
    });
  }
  if (url.pathname === "/auth/v1/user") {
    const id = tokens.get(
      req.headers.authorization?.replace("Bearer ", "") ?? "",
    );
    return id
      ? json(user(id))
      : json({ message: "Invalid token", error_code: "bad_jwt" }, 401);
  }
  if (url.pathname === "/auth/v1/logout") return json({});
  if (url.pathname === "/v1/chat/completions") {
    const input = JSON.parse(body.messages[1].content);
    if (
      typeof input.report.locationName !== "string" ||
      !input.report.locationName.trim() ||
      !Number.isFinite(input.report.lat) ||
      input.report.lat < -90 ||
      input.report.lat > 90 ||
      !Number.isFinite(input.report.lng) ||
      input.report.lng < -180 ||
      input.report.lng > 180
    )
      return json({ error: "Missing submitted Report location" }, 400);
    const text = input.report.originalText as string;
    const scenario = scenarios.get(text) ?? { mode: "failure" };
    const mode = scenario.mode;
    const extracting =
      body.response_format.json_schema.name.startsWith("report_extraction_");
    const count = calls.get(text) ?? { extraction: 0, matching: 0 };
    count[extracting ? "extraction" : "matching"]++;
    calls.set(text, count);
    const ordinal = count.extraction + count.matching;
    if (ordinal === scenario.hold)
      await new Promise<void>((resolve) => held.set(text, resolve));
    if (mode === "failure")
      return json({ error: "Controlled provider outage" }, 503);
    if (mode === "slow")
      await new Promise((resolve) => setTimeout(resolve, 1500));
    if (
      (extracting && mode === "extraction-failure") ||
      (!extracting && mode === "matching-failure")
    )
      return json({ error: "Controlled stage outage" }, 503);
    if (extracting && input.candidates)
      return json({ error: "Extraction must not receive candidates" }, 400);
    const passages = text
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)!
      .map((s: string) => s.trim());
    const observations = passages
      .slice(0, 12)
      .map((passage: string, i: number) => ({
        key: `o${i}`,
        subject: `${passage
          .split(/\bis\b|\bhas\b/)[0]
          .trim()
          .slice(0, 70)} (call ${ordinal})`,
        sourceRef: mode === "bad-reference" ? "invented" : "submitted_report",
        sourceIds: [
          mode === "bad-source"
            ? "invented"
            : (input.sourcePassages?.[
                Math.min(i, (input.sourcePassages?.length ?? 1) - 1)
              ]?.id ?? "s0"),
        ],
        occurrenceGroup: mode === "multiple" ? i : 0,
        describedCondition: null,
        spatialScope:
          passage.match(/(?:north|south|east) (?:path|entrance)/)?.[0] ?? null,
        timeWording: null,
        uncertainty: null,
        ...(mode === "unsupported"
          ? { statement: "The neighborhood is safe" }
          : {}),
        ...(mode === "drop-qualification" ? { excerpt: passages.at(-1) } : {}),
      }));
    const assessments = (input.candidates ?? []).map(
      (candidate: { id: string; evidence: { observationId: string }[] }) => ({
        candidateId: candidate.id,
        continuity:
          mode === "many-matches"
            ? "same"
            : candidate.id === scenario.candidateId
              ? mode === "uncertain"
                ? "unknown"
                : "same"
              : "separate",
        chronology: "consistent",
        scope: "same",
        evidenceIds: [candidate.evidence[0].observationId],
        reason: "The supplied original evidence describes this occurrence.",
      }),
    );
    assessments.sort(
      (a: { candidateId: string }, b: { candidateId: string }) =>
        Number(b.candidateId === scenario.candidateId) -
        Number(a.candidateId === scenario.candidateId),
    );
    return json({
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
                : { assessments },
            ),
          },
        },
      ],
    });
  }

  json({ error: "Unknown fixture endpoint" }, 404);
});
server.listen(3101, "127.0.0.1");
