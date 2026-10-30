import { createHash } from "node:crypto";
import { discover, QUESTION_CHARS } from "@/lib/discovery";
import { publicFailure } from "@/lib/http";
import { withinLimit } from "@/lib/source-check";

export const dynamic = "force-dynamic";
// The agent's own budget is 45 seconds; leave room for the response.
export const maxDuration = 60;
const REQUESTS_PER_MINUTE =
  (process.env.NODE_ENV !== "production" &&
    Number(process.env.NEARHOOD_DISCOVERY_PER_MINUTE)) ||
  10;

const finite = (value: unknown, limit: number) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Math.abs(value) <= limit;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON question." }, { status: 400 });
  }
  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  const b = body.bounds as Record<string, unknown> | undefined;
  const c = body.center as Record<string, unknown> | undefined;
  if (!question || question.length > QUESTION_CHARS)
    return Response.json(
      { error: `Ask a question of up to ${QUESTION_CHARS} characters.` },
      { status: 400 },
    );
  if (
    !b ||
    !c ||
    !finite(b.west, 180) ||
    !finite(b.east, 180) ||
    !finite(b.south, 90) ||
    !finite(b.north, 90) ||
    (b.south as number) > (b.north as number) ||
    (b.west as number) > (b.east as number) ||
    !finite(c.lat, 90) ||
    !finite(c.lng, 180)
  )
    return Response.json(
      { error: "Supply valid map bounds and center." },
      { status: 400 },
    );
  try {
    // A hashed address only counts requests; the address itself is not stored.
    const visitor = createHash("sha256")
      .update(
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local",
      )
      .digest("hex")
      .slice(0, 16);
    if (
      !(await withinLimit(`visitor:${visitor}`, "minute", REQUESTS_PER_MINUTE))
    )
      return Response.json(
        { error: "Too many questions at once. Please wait a minute." },
        { status: 429 },
      );
    return Response.json(
      await discover(
        question,
        {
          west: b.west as number,
          south: b.south as number,
          east: b.east as number,
          north: b.north as number,
        },
        { lat: c.lat as number, lng: c.lng as number },
        body.expand === true,
      ),
    );
  } catch (error) {
    return publicFailure(error);
  }
}
