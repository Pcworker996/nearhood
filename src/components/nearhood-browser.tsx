"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type {
  Bounds,
  Coordinates,
  Happening,
  HappeningDetail,
} from "@/lib/happenings";
import { DEMO_BOUNDS, DEMO_CENTER } from "@/lib/happenings";
import type { MapDestination } from "./neighborhood-map";
import HappeningDetailView from "./happening-detail";
import { FigmaIcon } from "./figma-icon";
import Contribution from "./contribution";

const NeighborhoodMap = dynamic(() => import("./neighborhood-map"), {
  ssr: false,
  loading: () => <p className="loading-map">Loading neighborhood map…</p>,
});
const categoryLabels = {
  disruption: "Disruption",
  safety: "Safety concern",
  activity: "Activity",
  pending: "Pending Report",
};
function distanceLabel(h: Coordinates, reference: Coordinates) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const a =
    Math.sin(radians(h.lat - reference.lat) / 2) ** 2 +
    Math.cos(radians(h.lat)) *
      Math.cos(radians(reference.lat)) *
      Math.sin(radians(h.lng - reference.lng) / 2) ** 2;
  return (
    (3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1) + " mi"
  );
}

export default function NearhoodBrowser({
  mapTilerKey,
}: {
  mapTilerKey: string;
}) {
  const [bounds, setBounds] = useState<Bounds>(DEMO_BOUNDS);
  const [happenings, setHappenings] = useState<Happening[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HappeningDetail | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [reader, setReader] = useState<Coordinates | null>(null);
  const [destination, setDestination] = useState<MapDestination | null>(null);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [contributing, setContributing] = useState(false);
  const onBounds = useCallback((b: Bounds) => setBounds(b), []);
  useEffect(() => {
    const readUrl = () => {
      const id = new URLSearchParams(window.location.search).get("happening");
      setDetailId(id);
      setContributing(
        new URLSearchParams(window.location.search).has("contribute"),
      );
    };
    readUrl();
    window.addEventListener("popstate", readUrl);
    return () => window.removeEventListener("popstate", readUrl);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams(
      Object.entries(bounds).map(([key, value]) => [key, String(value)]),
    );
    fetch(`/api/happenings?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw Error("Nearby information is temporarily unavailable.");
        setHappenings((await response.json()).happenings);
        setLoading(false);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setHappenings([]);
          setError(error.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [bounds, retry]);
  useEffect(() => {
    setDetail(null);
    setDetailError("");
    if (!detailId) return;
    const controller = new AbortController();
    fetch(`/api/happenings/${encodeURIComponent(detailId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw Error(
            response.status === 404
              ? "This Happening was not found."
              : "The account is temporarily unavailable.",
          );
        setDetail(await response.json());
      })
      .catch((error) => {
        if (error.name !== "AbortError") setDetailError(error.message);
      });
    return () => controller.abort();
  }, [detailId, retry]);
  const selected = happenings.find((h) => h.id === selectedId);
  const reference = reader ?? {
    lat: (bounds.south + bounds.north) / 2,
    lng: (bounds.west + bounds.east) / 2,
  };
  function openDetail(id: string) {
    setDetailId(id);
    window.history.pushState({}, "", `?happening=${encodeURIComponent(id)}`);
  }
  function back() {
    setDetailId(null);
    setContributing(false);
    setRetry((r) => r + 1);
    window.history.pushState({}, "", "/");
  }
  function contribute() {
    setContributing(true);
    window.history.pushState({}, "", "/?contribute=1");
  }
  function returnToDemo() {
    setSelectedId(null);
    setReader(null);
    setLocationMessage("");
    setDestination({
      coordinates: DEMO_CENTER,
      request: Date.now(),
      demo: true,
    });
  }
  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage(
        "Location is unavailable. Distances use the map center.",
      );
      return;
    }
    setLocationMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setReader(coordinates);
        setDestination({ coordinates, request: Date.now() });
        setLocationMessage("Distances are from you.");
      },
      () =>
        setLocationMessage(
          "Location was not shared. You can keep browsing; distances are from map center.",
        ),
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  if (contributing)
    return (
      <Contribution
        coordinates={detail ?? reference}
        candidateId={
          detail?.category === "pending" ? null : (detail?.id ?? null)
        }
        mapTilerKey={mapTilerKey}
        onBack={back}
      />
    );
  if (detailId)
    return detail ? (
      <HappeningDetailView
        key={detail.id}
        detail={detail}
        onBack={back}
        onContribute={contribute}
      />
    ) : (
      <main className="detail-content">
        <button className="text-button" onClick={back}>
          Back to map
        </button>
        <p role={detailError ? "alert" : "status"}>
          {detailError || "Loading current account…"}
        </p>
        {detailError && (
          <button onClick={() => setRetry(retry + 1)}>Retry</button>
        )}
      </main>
    );
  return (
    <div className="browser-shell">
      <header className="topbar">
        <div className="brand-group">
          <div className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div>
            <p className="eyebrow">Your neighborhood</p>
            <h1 className="brand">Nearhood</h1>
          </div>
        </div>
        <span className="round-button" title="Public browsing">
          <FigmaIcon name="profile" />
        </span>
      </header>
      <main className="map-screen">
        <NeighborhoodMap
          happenings={happenings}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setExpanded(true);
          }}
          onBounds={onBounds}
          destination={destination}
          reader={reader}
          mapTilerKey={mapTilerKey}
        />
        <section className="area-banner">
          <div>
            <h2>
              {Math.abs(reference.lat - DEMO_CENTER.lat) < 0.05 &&
              Math.abs(reference.lng - DEMO_CENTER.lng) < 0.05
                ? "Around Northbank"
                : "In this map area"}
            </h2>
            <p>What neighbors are noticing nearby</p>
          </div>
          <div className="area-actions">
            <button
              className="return-demo-button"
              aria-label="Return to Northbank demo"
              onClick={returnToDemo}
            >
              Return to demo
            </button>
            <button
              className="round-button"
              aria-label="Use my location"
              title="Use my location"
              onClick={locate}
            >
              <FigmaIcon name="locate" />
            </button>
          </div>
        </section>
        {locationMessage && (
          <p className="location-message" role="status">
            {locationMessage}
          </p>
        )}
        <section
          className={`highlights ${expanded ? "expanded" : "collapsed"}`}
          aria-label="Nearby highlights"
        >
          <button
            className="highlights-toggle"
            aria-expanded={expanded}
            onClick={() => {
              setExpanded(selected ? true : !expanded);
              setSelectedId(null);
            }}
          >
            <span>
              <span className="eyebrow">Nearby highlights</span>
              <strong>
                {selected
                  ? "Back to all highlights"
                  : `${happenings.filter((h) => h.category !== "pending").length} happenings in view${happenings.some((h) => h.category === "pending") ? ` · ${happenings.filter((h) => h.category === "pending").length} pending Reports` : ""}`}
              </strong>
            </span>
            <span className={`toggle-icon ${expanded ? "up" : "down"}`}>
              <FigmaIcon name="toggle" />
            </span>
          </button>
          {expanded && (
            <div className="highlight-content">
              {loading && <p role="status">Loading nearby information…</p>}
              {error && (
                <>
                  <p role="alert">{error}</p>
                  <button
                    className="text-button"
                    onClick={() => setRetry(retry + 1)}
                  >
                    Retry nearby information
                  </button>
                </>
              )}
              {!loading && !error && happenings.length === 0 && (
                <div className="empty-area">
                  <h3>No happenings here yet</h3>
                  <p>There are no stored happenings in this map area.</p>
                  <button className="primary-button" onClick={returnToDemo}>
                    Return to demo
                  </button>
                </div>
              )}
              {selected ? (
                <article className="selected-preview">
                  <span className={`badge ${selected.category}`}>
                    {selected.status}
                  </span>
                  <h3>{selected.title}</h3>
                  <p>
                    {selected.account?.claims[0]?.statement ??
                      "Account update pending"}
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => openDetail(selected.id)}
                  >
                    View full details <FigmaIcon name="preview-chevron" />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setSelectedId(null)}
                  >
                    All highlights
                  </button>
                </article>
              ) : (
                (
                  [
                    [
                      "Disruptions and safety",
                      happenings.filter(
                        (h) =>
                          h.category === "disruption" ||
                          h.category === "safety",
                      ),
                    ],
                    [
                      "Activities",
                      happenings.filter((h) => h.category === "activity"),
                    ],
                    [
                      "Pending Reports",
                      happenings.filter((h) => h.category === "pending"),
                    ],
                  ] as const
                ).map(
                  ([label, items]) =>
                    items.length > 0 && (
                      <section key={label}>
                        <h3 className="list-heading">{label}</h3>
                        {items.map((h) => (
                          <button
                            className="happening-row"
                            aria-label={`Preview ${h.title}`}
                            key={h.id}
                            onClick={() => setSelectedId(h.id)}
                          >
                            <span className="row-meta">
                              <span className={`badge ${h.category}`}>
                                {categoryLabels[h.category]}
                              </span>
                              <span>
                                {distanceLabel(h, reference)}{" "}
                                {reader ? "from you" : "from map center"}
                              </span>
                            </span>
                            <span className="row-title">
                              {h.title}
                              <FigmaIcon name="chevron" />
                            </span>
                            <span className="row-summary">
                              {h.account?.claims[0]?.statement ??
                                "Account update pending"}
                            </span>
                          </button>
                        ))}
                      </section>
                    ),
                )
              )}
            </div>
          )}
        </section>
        <p className="demo-label">Fictional Northbank demo data</p>
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        <button aria-current="page" onClick={returnToDemo}>
          <FigmaIcon name="map" />
          <span>Map</span>
        </button>
        <button disabled title="Discovery follows in ticket #13">
          <FigmaIcon name="discover" />
          <span>Discover</span>
        </button>
        <button onClick={contribute}>
          <span className="contribute-icon">
            <FigmaIcon name="contribute" />
          </span>
          <span>Contribute</span>
        </button>
      </nav>
    </div>
  );
}
