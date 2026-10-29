import { contributorIdentity, rejectCrossOrigin } from "@/lib/auth";
import { moveReport } from "@/lib/report-move";
import { SubmissionError } from "@/lib/report-submission";
import { submissionFailure } from "@/lib/submission-http";

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
        { error: "Sign in with Google to move your Report." },
        { status: 401 },
      );
    const body = await request.json();
    const to = body?.toHappeningId;
    if (typeof to !== "string" || !to.trim() || to.length > 200)
      throw new SubmissionError("Choose a Happening to move your Report to.");
    return Response.json(
      await moveReport((await context.params).id, identity.id, to),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return submissionFailure(error);
  }
}
