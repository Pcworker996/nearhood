import type { Bounds } from "./happenings";

export function parseBounds(params: URLSearchParams): Bounds | null {
  const raw = ["west", "south", "east", "north"].map((key) => params.get(key));
  if (raw.some((value) => value === null || value.trim() === "")) return null;
  const [west, south, east, north] = raw.map(Number);
  if (
    ![west, south, east, north].every(Number.isFinite) ||
    Math.abs(west) > 180 ||
    Math.abs(east) > 180 ||
    Math.abs(south) > 90 ||
    Math.abs(north) > 90 ||
    south > north
  )
    return null;
  return { west, south, east, north };
}

export function publicFailure(error: unknown) {
  console.error(
    "Nearhood database request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return Response.json(
    { error: "Information is temporarily unavailable. Please try again." },
    { status: 503 },
  );
}
