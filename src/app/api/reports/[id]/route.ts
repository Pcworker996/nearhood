import { contributorIdentity } from "@/lib/auth";
import { savedReport } from "@/lib/report-submission";
import { submissionFailure } from "@/lib/submission-http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const identity = await contributorIdentity();
    if (!identity)
      return Response.json(
        { error: "Sign in with Google to inspect your submission." },
        { status: 401 },
      );
    return Response.json(
      await savedReport((await context.params).id, identity.id),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return submissionFailure(error);
  }
}
