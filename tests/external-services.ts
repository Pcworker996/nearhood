// External HTTP fixtures only. No imports of application storage or processing.
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";

const codes = new Map<string, { id: string; challenge: string }>();
const tokens = new Map<string, string>();
const scenarios = new Map<
  string,
  {
    mode: string;
    candidateId?: string;
    hold?: number;
    category?: string;
    matchingReplay?: string;
    // Per-candidate grades; candidates not listed are graded separate.
    grades?: Record<string, { continuity: string; chronology?: string }>;
  }
>();
const calls = new Map<string, { extraction: number; matching: number }>();
const held = new Map<string, () => void>();
// The last matching request per Report text, so tests can inspect what the provider received.
const matchingRequests = new Map<string, unknown>();
let cancelNextSignIn = false;
const discoveryScripts = new Map<
  string,
  { name: string; args: Record<string, unknown> }[]
>();
const tavilyResults = new Map<
  string,
  {
    title: string;
    url: string;
    content: string;
    published_date?: string;
    relation: string;
  }[]
>();
const tavilyRequests: { query: string }[] = [];
let geocoderDown = false;
const geocodingPlaces = new Map<
  string,
  { query: string; name: string; lat: number; lng: number }
>();
const geocodingRequests: { query: string; params: Record<string, string> }[] =
  [];
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
      category: body.category,
      matchingReplay: body.matchingReplay,
      grades: body.grades,
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
  if (url.pathname === "/matching-request")
    return json(matchingRequests.get(url.searchParams.get("text")!) ?? null);
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
  if (url.pathname === "/discovery-control") {
    discoveryScripts.set(body.question, body.steps);
    return json({ ok: true });
  }
  if (url.pathname === "/tavily-control") {
    tavilyResults.set(body.query, body.results);
    return json({ ok: true });
  }
  if (url.pathname === "/tavily-requests") return json(tavilyRequests);
  // MapTiler Geocoding: reverse lookups name a road after the position;
  // searches find only the places registered here.
  if (url.pathname === "/geocoding-control") {
    geocoderDown = !!body.down;
    if (body.place) geocodingPlaces.set(body.place.query, body.place);
    return json({ ok: true });
  }
  if (url.pathname === "/geocoding-requests") return json(geocodingRequests);
  if (url.pathname.startsWith("/geocoding/")) {
    // Like the real key: restricted to allowed origins, so only browser
    // requests from the site are served.
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (
      url.searchParams.get("key") !== "external-fixture-maptiler-key" ||
      req.headers.origin !== "http://127.0.0.1:3100"
    )
      return json({ message: "Key usage restricted" }, 403);
    if (geocoderDown) return json({ message: "Unavailable" }, 503);
    const query = decodeURIComponent(
      url.pathname.slice("/geocoding/".length).replace(/\.json$/, ""),
    );
    geocodingRequests.push({
      query,
      params: Object.fromEntries(
        [...url.searchParams].filter(([k]) => k !== "key"),
      ),
    });
    const reverse = /^(-?[\d.]+),(-?[\d.]+)$/.exec(query);
    const feature = (name: string, lng: number, lat: number) => ({
      type: "Feature",
      place_name: name,
      text: name.split(",")[0],
      center: [lng, lat],
      geometry: { type: "Point", coordinates: [lng, lat] },
    });
    const features = reverse
      ? [
          feature(
            `Fixture Road ${Number(reverse[2]).toFixed(3)}, Fixture City`,
            Number(reverse[1]),
            Number(reverse[2]),
          ),
        ]
      : [geocodingPlaces.get(query)]
          .filter((p) => !!p)
          .map((p) => feature(p.name, p.lng, p.lat));
    return json({ type: "FeatureCollection", features });
  }
  if (url.pathname === "/tavily/search") {
    if (req.headers.authorization !== "Bearer external-fixture-tavily-key")
      return json({ detail: "Invalid key" }, 401);
    tavilyRequests.push(body);
    const results = tavilyResults.get(body.query) ?? [];
    return json({
      query: body.query,
      results: results.map(({ relation: _relation, ...r }) => r),
      images: [],
      answer: null,
      response_time: 0.1,
    });
  }
  // Source check comparison: relations come from the controlled results.
  if (
    url.pathname === "/v1/chat/completions" &&
    body.response_format?.json_schema?.name === "source_check_v1"
  ) {
    const input = JSON.parse(body.messages[1].content);
    const all = [...tavilyResults.values()].flat();
    const findings = input.results.map(
      (r: { index: number; title: string }) => {
        const relation =
          all.find((c) => c.title === r.title)?.relation ?? "unclear";
        return {
          index: r.index,
          relation,
          note: relation === "unrelated" ? null : `Fixture note: ${relation}.`,
        };
      },
    );
    return json({
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify({ findings }) },
        },
      ],
    });
  }
  // Discovery agent: plays the scripted tool calls for the question, one per
  // turn. "$claims" and "$observation" resolve from the evidence the app
  // returned, so scripts follow whatever the database holds.
  if (url.pathname === "/v1/chat/completions" && body.tools) {
    const { question } = JSON.parse(body.messages[1].content);
    const steps = discoveryScripts.get(question);
    if (!steps) return json({ error: "Controlled provider outage" }, 503);
    const turn = body.messages.filter(
      (m: { role: string }) => m.role === "assistant",
    ).length;
    const step = steps[Math.min(turn, steps.length - 1)];
    const evidence = body.messages
      .filter((m: { role: string }) => m.role === "tool")
      .map((m: { content: string }) => JSON.parse(m.content))
      .filter((output: { observations?: unknown }) => output.observations);
    const resolve = (value: unknown, happeningId?: string): unknown => {
      const opened = evidence.find((e: { id: string }) => e.id === happeningId);
      if (value === "$claims")
        return opened?.account?.claims.map((c: { id: string }) => c.id) ?? [];
      if (value === "$observation") return [opened?.observations[0]?.id];
      if (value === "$report") return opened?.reports[0]?.id;
      if (Array.isArray(value))
        return value.map((v) => resolve(v, happeningId));
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [
            k,
            resolve(
              v,
              (value as { happeningId?: string }).happeningId ?? happeningId,
            ),
          ]),
        );
      return value;
    };
    return json({
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            content: "",
            tool_calls: [
              {
                id: `call-${turn}`,
                type: "function",
                function: {
                  name: step.name,
                  arguments: JSON.stringify(resolve(step.args)),
                },
              },
            ],
          },
        },
      ],
    });
  }
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
    if (!extracting) matchingRequests.set(text, body);
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
    const required =
      body.response_format.json_schema.schema.properties?.assessments;
    if (
      !extracting &&
      (required?.minItems !== input.candidates?.length ||
        required?.maxItems !== input.candidates?.length)
    )
      return json(
        { error: "Matching schema must require one assessment per candidate" },
        400,
      );
    const passages = text
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)!
      .map((s: string) => s.trim());
    // A passage's words after "is"/"has" stand in for the derived condition;
    // hedged passages describe no condition and keep the qualification.
    const hedged = (passage: string) =>
      /\b(?:did not check|didn't check|not checked|cannot confirm|cannot verify)\b/i.test(
        passage,
      );
    const condition = (passage: string) => {
      const [, ...rest] = passage.split(/\bis\b|\bhas\b/);
      const words = rest
        .join(" ")
        .replace(/[.!?]+$/, "")
        .trim();
      return hedged(passage) || !words ? null : words.slice(0, 160);
    };
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
        occurrenceGroup:
          mode === "multiple" ? i : mode === "unclear" && i === 0 ? null : 0,
        describedCondition: condition(passage),
        spatialScope:
          passage.match(/(?:north|south|east) (?:path|entrance)/)?.[0] ?? null,
        timeWording: null,
        uncertainty: hedged(passage) ? passage.slice(0, 240) : null,
        ...(mode === "unsupported"
          ? { statement: "The neighborhood is safe" }
          : {}),
        ...(mode === "drop-qualification" ? { excerpt: passages.at(-1) } : {}),
      }));
    const assessments = (input.candidates ?? []).map(
      (candidate: { id: string; evidence: { observationId: string }[] }) => {
        const named = candidate.id === scenario.candidateId;
        const graded = scenario.grades
          ? (scenario.grades[candidate.id] ?? { continuity: "separate" })
          : null;
        if (graded)
          return {
            candidateId: candidate.id,
            continuity: graded.continuity,
            chronology: graded.chronology ?? "consistent",
            scope: "same",
            evidenceIds: [candidate.evidence[0].observationId],
            reason: "The supplied original evidence describes this occurrence.",
          };
        return {
          candidateId: candidate.id,
          continuity:
            mode === "many-matches"
              ? "same"
              : mode === "separate-conflict" && named
                ? "separate"
                : named
                  ? mode === "uncertain"
                    ? "unknown"
                    : "same"
                  : "separate",
          chronology:
            mode === "separate-conflict" && named ? "conflict" : "consistent",
          scope: "same",
          evidenceIds: [candidate.evidence[0].observationId],
          reason: "The supplied original evidence describes this occurrence.",
        };
      },
    );
    assessments.sort(
      (a: { candidateId: string }, b: { candidateId: string }) =>
        Number(b.candidateId === scenario.candidateId) -
        Number(a.candidateId === scenario.candidateId),
    );
    // Like the live model under constrained decoding: it closes the array
    // after one assessment unless the request schema demands more.
    if (mode === "stops-early")
      assessments.splice(Math.max(1, required?.minItems ?? 0));
    return json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content:
              !extracting && scenario.matchingReplay !== undefined
                ? scenario.matchingReplay
                : JSON.stringify(
                    extracting
                      ? {
                          category: scenario.category ?? "disruption",
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
