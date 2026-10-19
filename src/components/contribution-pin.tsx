"use client";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Coordinates } from "@/lib/happenings";

function Pick({ onChange }: { onChange: (coordinates: Coordinates) => void }) {
  useMapEvents({
    click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.wrap().lng }),
  });
  return null;
}
export default function ContributionPin({
  coordinates,
  onChange,
  mapTilerKey,
}: {
  coordinates: Coordinates;
  onChange: (coordinates: Coordinates) => void;
  mapTilerKey: string;
}) {
  const valid =
    Number.isFinite(coordinates.lat) &&
    Math.abs(coordinates.lat) <= 90 &&
    Number.isFinite(coordinates.lng) &&
    Math.abs(coordinates.lng) <= 180;
  return (
    <div
      className="contribution-pin"
      aria-label="Choose report location on map"
    >
      <MapContainer
        center={valid ? [coordinates.lat, coordinates.lng] : [0, 0]}
        zoom={15}
      >
        {mapTilerKey && (
          <TileLayer
            url={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${encodeURIComponent(mapTilerKey)}`}
            attribution={
              '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            }
          />
        )}
        <Pick onChange={onChange} />
        {valid && (
          <Marker
            position={[coordinates.lat, coordinates.lng]}
            icon={L.divIcon({
              className: "happening-marker",
              html: '<span class="pin pending">+</span>',
              iconSize: [46, 46],
              iconAnchor: [23, 44],
            })}
          />
        )}
      </MapContainer>
      {!mapTilerKey && (
        <p className="muted">
          Street tiles unavailable. Enter the exact coordinates below.
        </p>
      )}
    </div>
  );
}
