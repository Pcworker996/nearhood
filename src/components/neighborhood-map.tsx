"use client";

import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Bounds, Coordinates, Happening } from "@/lib/happenings";
import { DEMO_BOUNDS, DEMO_CENTER } from "@/lib/happenings";

export type MapDestination = {
  coordinates: Coordinates;
  request: number;
  demo?: boolean;
};
function Viewport({
  onBounds,
  destination,
}: {
  onBounds: (bounds: Bounds) => void;
  destination: MapDestination | null;
}) {
  const map = useMap();
  const publish = () => {
    const b = map.getBounds();
    onBounds({
      west: Math.max(-180, b.getWest()),
      south: Math.max(-90, b.getSouth()),
      east: Math.min(180, b.getEast()),
      north: Math.min(90, b.getNorth()),
    });
  };
  useMapEvents({ moveend: publish });
  useEffect(() => {
    if (!destination || destination.demo)
      map.fitBounds(
        [
          [DEMO_BOUNDS.south, DEMO_BOUNDS.west],
          [DEMO_BOUNDS.north, DEMO_BOUNDS.east],
        ],
        { animate: false },
      );
    else
      map.setView(
        [destination.coordinates.lat, destination.coordinates.lng],
        16,
        { animate: false },
      );
    publish();
    // A destination request is explicit; list updates must never recenter the map.
  }, [destination, map, onBounds]);
  return null;
}

export default function NeighborhoodMap({
  happenings,
  selectedId,
  onSelect,
  onBounds,
  destination,
  reader,
  mapTilerKey,
}: {
  happenings: Happening[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBounds: (bounds: Bounds) => void;
  destination: MapDestination | null;
  reader: Coordinates | null;
  mapTilerKey: string;
}) {
  return (
    <div className="map-canvas" aria-label="Neighborhood street map">
      <MapContainer
        center={[DEMO_CENTER.lat, DEMO_CENTER.lng]}
        zoom={15}
        zoomControl={false}
        minZoom={2}
        maxBounds={[
          [-85, -180],
          [85, 180],
        ]}
        maxBoundsViscosity={1}
      >
        {mapTilerKey && (
          <TileLayer
            url={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${encodeURIComponent(mapTilerKey)}`}
            attribution={
              '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            }
          />
        )}
        <Viewport onBounds={onBounds} destination={destination} />
        {happenings.map((h) => (
          <Marker
            key={h.id}
            position={[h.lat, h.lng]}
            title={`Select map marker: ${h.title}`}
            alt={`Select map marker: ${h.title}`}
            icon={L.divIcon({
              className: "happening-marker",
              iconSize: [46, 46],
              iconAnchor: [23, 44],
              html: `<span class="pin ${h.category} ${selectedId === h.id ? "selected" : ""}"><img alt="" src="/figma/${h.category === "activity" ? "activity" : "warning"}.svg" width="19" height="19" /></span>`,
            })}
            eventHandlers={{ click: () => onSelect(h.id) }}
          />
        ))}
        {reader && (
          <Marker
            position={[reader.lat, reader.lng]}
            icon={L.divIcon({
              className: "reader-marker",
              html: '<span aria-label="Your approximate location"></span>',
              iconSize: [20, 20],
            })}
          />
        )}
      </MapContainer>
      {!mapTilerKey && (
        <p className="map-config-note" role="status">
          Street map unavailable. You can still inspect the demo reports.
        </p>
      )}
    </div>
  );
}
