import { publicFailure } from "./http";
import { SubmissionError } from "./report-submission";

export function submissionFailure(error: unknown) {
  if (error instanceof SubmissionError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError)
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  return publicFailure(error);
}
