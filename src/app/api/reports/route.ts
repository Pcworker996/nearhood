import { contributorIdentity, rejectCrossOrigin } from "@/lib/auth";
import { parseReportInput, saveReport } from "@/lib/report-submission";
import { submissionFailure } from "@/lib/submission-http";

export async function POST(request: Request) {
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
      await saveReport(parseReportInput(await request.json()), identity.id),
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return submissionFailure(error);
  }
}
