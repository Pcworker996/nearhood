import { contributorIdentity, rejectCrossOrigin } from "@/lib/auth";
import { processReport } from "@/lib/report-processing";
import { submissionFailure } from "@/lib/submission-http";

export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (rejectCrossOrigin(request))
    return Response.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  try {
    const identity = await contributorIdentity();
    if (!identity)
      return Response.json(
        { error: "Sign in with Google to contribute." },
        { status: 401 },
      );
    const raw = await request.text();
    let refresh = false;
    if (raw) {
      const body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body))
        return Response.json(
          { error: "Invalid processing request." },
          { status: 400 },
        );
      if (body.refresh !== undefined && typeof body.refresh !== "boolean")
        return Response.json(
          { error: "Invalid refresh choice." },
          { status: 400 },
        );
      refresh = body.refresh === true;
    }
    return Response.json(
      await processReport((await context.params).id, identity.id, refresh),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return submissionFailure(error);
  }
}
