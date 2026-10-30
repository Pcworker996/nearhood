import NearhoodBrowser from "@/components/nearhood-browser";

// Place names use the same browser-restricted MapTiler key as the tiles;
// MAPTILER_GEOCODING_URL and MAPTILER_KEY let tests point at a fixture.
const geocoder = {
  url:
    process.env.MAPTILER_GEOCODING_URL ?? "https://api.maptiler.com/geocoding",
  key: process.env.MAPTILER_KEY ?? process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "",
};

export default function Page() {
  return (
    <NearhoodBrowser
      mapTilerKey={process.env.NEXT_PUBLIC_MAPTILER_KEY ?? ""}
      geocoder={geocoder}
    />
  );
}
