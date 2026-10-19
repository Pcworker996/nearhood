// External HTTP fixtures only. No imports of application storage or processing.
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";

const codes = new Map<string, { id: string; challenge: string }>();
const tokens = new Map<string, string>();
const scenarios = new Map<string, string>();
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
    scenarios.set(body.text, body.mode);
    return json({ ok: true });
  }
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
    const text = input.originalText as string;
    const mode = scenarios.get(text) ?? "failure";
    if (mode === "failure")
      return json({ error: "Controlled provider outage" }, 503);
    if (mode === "slow")
      await new Promise((resolve) => setTimeout(resolve, 1500));
    const passages = text
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)!
      .map((s) => s.trim());
    const observations = passages.map((excerpt, i) => ({
      key: `o${i}`,
      excerpt,
      subject: excerpt.split(" ")[0],
      spatialScope: null,
    }));
    return json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({
              category: "disruption",
              sameOccurrence: true,
              observations,
              claims: observations.map((o) => ({
                statement:
                  mode === "unsupported"
                    ? "The whole neighborhood is safe."
                    : o.excerpt,
                observationKeys:
                  mode === "bad-reference" ? ["invented"] : [o.key],
              })),
            }),
          },
        },
      ],
    });
  }
  json({ error: "Unknown fixture endpoint" }, 404);
});
server.listen(3101, "127.0.0.1");
