import { contributorIdentity, rejectCrossOrigin } from "@/lib/auth";
import { confirmReportMatch } from "@/lib/report-processing";
import { MATCHING_SCOPE } from "@/lib/report-matching";
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
        { error: "Sign in with Google to confirm a match." },
        { status: 401 },
      );
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new SubmissionError("Choose a matching decision.");
    if (body.choice === "create_new" || body.choice === "unsure")
      return Response.json(
        await confirmReportMatch((await context.params).id, identity.id, {
          choice: body.choice,
          candidateIdsShown: parseCandidateIds(body.candidateIdsShown),
        }),
        { headers: { "Cache-Control": "private, no-store" } },
      );
    if (
      body.choice !== "match" ||
      typeof body.candidateId !== "string" ||
      !body.candidateId.trim() ||
      body.candidateId.length > 200
    )
      throw new SubmissionError("Choose one of the supplied Happenings.");
    return Response.json(
      await confirmReportMatch((await context.params).id, identity.id, {
        choice: "match",
        candidateId: body.candidateId,
        candidateIdsShown: parseCandidateIds(body.candidateIdsShown),
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return submissionFailure(error);
  }
}

function parseCandidateIds(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length > MATCHING_SCOPE.maxCandidates ||
    value.some(
      (candidateId) =>
        typeof candidateId !== "string" ||
        !candidateId.trim() ||
        candidateId.length > 200,
    ) ||
    new Set(value).size !== value.length
  )
    throw new SubmissionError(
      "Refresh the nearby suggestions before deciding.",
    );
  return value as string[];
}
