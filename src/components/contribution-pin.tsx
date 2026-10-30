"use client";
import { useEffect, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { Coordinates } from "@/lib/happenings";
import { searchPlaces, type Geocoder, type Place } from "@/lib/geocoding";

function Pick({ onChange }: { onChange: (coordinates: Coordinates) => void }) {
  useMapEvents({
    click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.wrap().lng }),
  });
  return null;
}
// Bring the pin into view when it moves off-screen, e.g. after a search.
function Follow({ coordinates }: { coordinates: Coordinates }) {
  const map = useMap();
  useEffect(() => {
    const at = L.latLng(coordinates.lat, coordinates.lng);
    if (!map.getBounds().contains(at))
      map.setView(at, Math.max(map.getZoom(), 15));
  }, [map, coordinates.lat, coordinates.lng]);
  return null;
}
function PlaceSearch({
  geocoder,
  near,
  onChosen,
}: {
  geocoder: Geocoder;
  near: Coordinates | null;
  onChosen: (place: Place) => void;
}) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [status, setStatus] = useState("");
  async function search() {
    const q = query.trim();
    if (!q) return;
    setStatus("Searching…");
    setPlaces(null);
    try {
      const found = await searchPlaces(geocoder, q, near);
      setPlaces(found);
      setStatus(found.length ? "" : "No places found.");
    } catch {
      setStatus("Place search is unavailable. Tap the map instead.");
    }
  }
  // Not a <form>: this sits inside the Report form, and Enter must not submit it.
  return (
    <div className="place-search" role="search">
      <label>
        Search for a place
        <input
          type="search"
          maxLength={200}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            search();
          }}
        />
      </label>
      <button type="button" onClick={search}>
        Search
      </button>
      {status && (
        <p className="muted" role="status">
          {status}
        </p>
      )}
      {places && places.length > 0 && (
        <ul aria-label="Place results">
          {places.map((place) => (
            <li key={`${place.lat},${place.lng},${place.name}`}>
              <button
                type="button"
                onClick={() => {
                  onChosen(place);
                  setPlaces(null);
                  setQuery("");
                }}
              >
                {place.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export default function ContributionPin({
  coordinates,
  placeLabel,
  onChange,
  onPlaceChosen,
  mapTilerKey,
  geocoder,
}: {
  coordinates: Coordinates;
  placeLabel: string;
  onChange: (coordinates: Coordinates) => void;
  onPlaceChosen: (place: Place) => void;
  mapTilerKey: string;
  geocoder: Geocoder;
}) {
  const valid =
    Number.isFinite(coordinates.lat) &&
    Math.abs(coordinates.lat) <= 90 &&
    Number.isFinite(coordinates.lng) &&
    Math.abs(coordinates.lng) <= 180;
  return (
    <>
      <PlaceSearch
        geocoder={geocoder}
        near={valid ? coordinates : null}
        onChosen={onPlaceChosen}
      />
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
            <>
              <Follow coordinates={coordinates} />
              <Marker
                position={[coordinates.lat, coordinates.lng]}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const at = (e.target as L.Marker).getLatLng();
                    onChange({ lat: at.lat, lng: at.wrap().lng });
                  },
                }}
                icon={L.divIcon({
                  className: "happening-marker",
                  html: '<span class="pin pending">+</span>',
                  iconSize: [46, 46],
                  iconAnchor: [23, 44],
                })}
              >
                {placeLabel && (
                  <Tooltip
                    permanent
                    direction="top"
                    offset={[0, -44]}
                    className="pin-place-label"
                  >
                    {placeLabel}
                  </Tooltip>
                )}
              </Marker>
            </>
          )}
        </MapContainer>
        {!mapTilerKey && (
          <p className="muted">
            Street tiles unavailable. Search for a place to set the location.
          </p>
        )}
      </div>
      {placeLabel && (
        <p className="muted" aria-live="polite">
          Pin: {placeLabel}
        </p>
      )}
    </>
  );
}
