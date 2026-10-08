import { listHappenings } from "@/lib/database";
import { parseBounds, publicFailure } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const bounds = parseBounds(new URL(request.url).searchParams);
  if (!bounds)
    return Response.json(
      { error: "Supply valid west, south, east and north bounds." },
      { status: 400 },
    );
  try {
    return Response.json({ happenings: await listHappenings(bounds) });
  } catch (error) {
    return publicFailure(error);
  }
}
