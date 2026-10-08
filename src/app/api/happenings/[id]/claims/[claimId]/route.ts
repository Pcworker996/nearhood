import { claimEvidence } from "@/lib/database";
import { publicFailure } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; claimId: string }> },
) {
  try {
    const { id, claimId } = await context.params;
    const evidence = await claimEvidence(id, claimId);
    return evidence
      ? Response.json(evidence)
      : Response.json(
          { error: "Claim not found in this Happening's current account." },
          { status: 404 },
        );
  } catch (error) {
    return publicFailure(error);
  }
}
