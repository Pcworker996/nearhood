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
    return Response.json(
      await processReport((await context.params).id, identity.id),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return submissionFailure(error);
  }
}
