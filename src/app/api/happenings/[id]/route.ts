import { happeningDetail } from "@/lib/database";
import { publicFailure } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const detail = await happeningDetail(id);
    return detail
      ? Response.json(detail)
      : Response.json({ error: "Happening not found." }, { status: 404 });
  } catch (error) {
    return publicFailure(error);
  }
}
