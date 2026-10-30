import type { Coordinates } from "./happenings";

const GEOCODING_TIMEOUT_MS = 5000;
export const SEARCH_CHARS = 200;

export type Place = { name: string; lat: number; lng: number };
export type Geocoder = { url: string; key: string };

// MapTiler Geocoding (docs.maptiler.com/cloud/api/geocoding), called from the
// browser like the map tiles: the key is restricted to allowed origins, which
// only a browser request from the site satisfies (#27).
async function maptiler(
  { url, key }: Geocoder,
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
) {
  if (!key) throw Error("Place names are not configured.");
  const query = new URLSearchParams({ ...params, key });
  const response = await fetch(
    `${url.replace(/\/$/, "")}/${path}.json?${query}`,
    {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(GEOCODING_TIMEOUT_MS)])
        : AbortSignal.timeout(GEOCODING_TIMEOUT_MS),
    },
  );
  if (!response.ok)
    throw Error(`Place lookup failed (HTTP ${response.status}).`);
  const body = await response.json();
  return Array.isArray(body.features) ? body.features : [];
}

function toPlace(feature: unknown): Place | null {
  const f = feature as { place_name?: unknown; center?: unknown };
  const [lng, lat] = Array.isArray(f.center) ? f.center : [];
  if (
    typeof f.place_name !== "string" ||
    !f.place_name.trim() ||
    typeof lat !== "number" ||
    typeof lng !== "number"
  )
    return null;
  return { name: f.place_name.trim().slice(0, 200), lat, lng };
}

// Excludes address points and POIs so a suggested name stays at street level
// and never names a contributor's doorstep.
export async function placeAt(
  geocoder: Geocoder,
  { lat, lng }: Coordinates,
  signal?: AbortSignal,
) {
  const features = await maptiler(
    geocoder,
    `${lng},${lat}`,
    { types: "address,poi", excludeTypes: "true", limit: "1" },
    signal,
  );
  return (features.map(toPlace).find(Boolean) as Place | undefined) ?? null;
}

export async function searchPlaces(
  geocoder: Geocoder,
  text: string,
  near: Coordinates | null,
) {
  const features = await maptiler(geocoder, encodeURIComponent(text), {
    limit: "5",
    ...(near ? { proximity: `${near.lng},${near.lat}` } : {}),
  });
  return features.map(toPlace).filter((p: Place | null): p is Place => !!p);
}
