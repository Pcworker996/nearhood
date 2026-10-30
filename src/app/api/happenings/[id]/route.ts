import { happeningDetail } from "@/lib/database";
import { publicFailure } from "@/lib/http";
import { latestSourceCheck } from "@/lib/source-check";

export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const detail = await happeningDetail(id);
    if (!detail)
      return Response.json({ error: "Happening not found." }, { status: 404 });
    if (!("reports" in detail) || detail.category === "pending")
      return Response.json(detail);
    return Response.json({ ...detail, sourceCheck: await latestSourceCheck(id) });
  } catch (error) {
    return publicFailure(error);
  }
}
