"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type {
  Coordinates,
  MatchCandidate,
  SavedReport,
} from "@/lib/happenings";
import { ReportCard } from "./report-card";

const ContributionPin = dynamic(() => import("./contribution-pin"), {
  ssr: false,
});
const DRAFT_KEY = "nearhood-report-draft-v1";
type Draft = {
  requestKey: string;
  originalText: string;
  displayName: string;
  lat: number;
  lng: number;
  locationName: string;
  timeChoice: string;
  chosenTime: string;
  provenance: string;
  sourceUrl: string;
  candidateId: string | null;
};
async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok)
    throw Error(body.error ?? "Information is temporarily unavailable.");
  return body;
}

export default function Contribution({
  coordinates,
  candidateId,
  mapTilerKey,
  onBack,
}: {
  coordinates: Coordinates;
  candidateId: string | null;
  mapTilerKey: string;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [saved, setSaved] = useState<SavedReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [submissionStarted, setSubmissionStarted] = useState(false);
  const [showMoreCandidates, setShowMoreCandidates] = useState(false);
  useEffect(() => {
    let restored: Draft | null = null;
    try {
      restored = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
    } catch {
      setStorageError(
        "Draft storage is unavailable. Keep this page open until your Report is saved.",
      );
    }
    try {
      if (
        restored &&
        localStorage.getItem(`nearhood-request-${restored.requestKey}`)
      )
        setSubmissionStarted(true);
    } catch {
      /* Storage error is shown above. */
    }
    setDraft(
      restored ?? {
        requestKey: crypto.randomUUID(),
        originalText: "",
        displayName: "",
        ...coordinates,
        locationName: "Selected map pin",
        timeChoice: "",
        chosenTime: "",
        provenance: "firsthand",
        sourceUrl: "",
        candidateId,
      },
    );
    api("/api/session")
      .then((session) => {
        setSignedIn(session.signedIn);
        setHasProfile(!!session.displayName);
        if (session.displayName)
          setDraft((d) => (d ? { ...d, displayName: session.displayName } : d));
      })
      .catch((e) => setError(e.message))
      .finally(() => setSessionReady(true));
    const reportId = new URLSearchParams(window.location.search).get("report");
    if (reportId) {
      setLoadingSaved(true);
      api(`/api/reports/${encodeURIComponent(reportId)}`)
        .then(setSaved)
        .catch((e) => setError(e.message))
        .finally(() => setLoadingSaved(false));
    }
    const authError = new URLSearchParams(window.location.search).get("auth");
    if (authError)
      setError(
        authError === "unavailable"
          ? "Google sign-in is not configured yet. Your draft is kept on this device."
          : "Sign-in did not complete. Your draft is kept; please try again.",
      );
  }, []);
  useEffect(() => {
    if (!draft) return;
    try {
      if (saved) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      setStorageError(
        "Draft storage is unavailable. Sign-in may not preserve your draft.",
      );
    }
  }, [draft, saved]);
  useEffect(() => {
    if (saved?.state !== "processing") return;
    const timer = setInterval(() => {
      api(`/api/reports/${saved.id}`)
        .then(setSaved)
        .catch((e) => setError(e.message));
    }, 2000);
    return () => clearInterval(timer);
  }, [saved?.id, saved?.state]);
  useEffect(() => {
    if (saved?.nextAction === "process" && signedIn && !busy && !error)
      void process(saved.id);
  }, [
    saved?.id,
    saved?.nextAction,
    saved?.processingStage,
    signedIn,
    busy,
    error,
  ]);

  function update(change: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...change } : d));
  }
  async function process(id: string, refresh = false) {
    setBusy(true);
    setError("");
    try {
      setSaved(
        await api(`/api/reports/${id}/process`, {
          method: "POST",
          ...(refresh
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh: true }),
              }
            : {}),
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Processing interrupted. Reload to inspect your saved Report.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function chooseMatch(
    choice:
      | {
          choice: "match";
          candidateId: string;
          candidateIdsShown: string[];
        }
      | { choice: "create_new"; candidateIdsShown: string[] },
  ) {
    if (!saved) return;
    setBusy(true);
    setError("");
    try {
      setSaved(
        await api(`/api/reports/${saved.id}/match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(choice),
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your choice was not saved. The Report remains available.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const observedAt =
        draft.timeChoice === "unknown"
          ? null
          : draft.timeChoice === "now"
            ? new Date().toISOString()
            : new Date(draft.chosenTime).toISOString();
      // Persist the exact request across a lost response, including "Just now".
      const retryKey = `nearhood-request-${draft.requestKey}`;
      let body: string;
      try {
        body =
          localStorage.getItem(retryKey) ??
          JSON.stringify({
            requestKey: draft.requestKey,
            originalText: draft.originalText,
            displayName: draft.displayName,
            lat: draft.lat,
            lng: draft.lng,
            locationName: draft.locationName,
            observedAt,
            provenance: draft.provenance,
            sourceUrl:
              draft.provenance === "source_based"
                ? draft.sourceUrl || null
                : null,
            candidateId: draft.candidateId,
          });
        localStorage.setItem(retryKey, body);
      } catch {
        throw Error(
          "Submission storage is unavailable. Enable storage to submit safely without duplicates.",
        );
      }
      setSubmissionStarted(true);
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 400) {
          localStorage.removeItem(retryKey);
          setSubmissionStarted(false);
        }
        throw Error(
          result.error ??
            "Saving was interrupted. Retry this same Report to check its saved state.",
        );
      }
      setSaved(result);
      window.history.replaceState({}, "", `/?contribute=1&report=${result.id}`);
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(retryKey);
      setBusy(false);
      void process(result.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Report could not be saved. Try again.",
      );
      setBusy(false);
    }
  }
  const recommendation = saved?.recommendation;
  const suggestedCandidateId =
    recommendation?.kind === "match" ? recommendation.candidateId : null;
  const suggestedEvidenceIds =
    recommendation?.kind === "match" ? recommendation.evidenceIds : undefined;
  const clarificationEvidenceIds =
    recommendation?.kind === "uncertain"
      ? recommendation.evidenceIds
      : undefined;
  const candidateIdsShown =
    saved && (recommendation?.kind === "uncertain" || showMoreCandidates)
      ? saved.candidates.map((candidate) => candidate.id)
      : suggestedCandidateId
        ? [suggestedCandidateId]
        : [];
  if (!draft)
    return (
      <main className="detail-content">
        <p role="status">Opening your draft…</p>
      </main>
    );
  return (
    <div className="detail-screen">
      <header className="topbar">
        <button className="text-button" onClick={onBack}>
          Back to map
        </button>
        <span className="brand">Nearhood</span>
      </header>
      <main className="detail-content contribution-content">
        <h1>{saved ? "Your saved Report" : "Share what you observed"}</h1>
        <p className="muted">
          Your original words remain inspectable. Accounts are provisional
          interpretations of contributor reports.
        </p>
        {storageError && <p role="alert">{storageError}</p>}
        {error && <p role="alert">{error}</p>}
        {loadingSaved ? (
          <p role="status">Loading saved Report…</p>
        ) : saved ? (
          <>
            <p role="status">
              {saved.state === "published"
                ? "Report saved · account published"
                : saved.state === "processing" || busy
                  ? "Report saved · updating the account"
                  : saved.state === "match_review"
                    ? "Report saved · review the suggested Happening"
                    : saved.state === "clarification"
                      ? saved.pendingReason === "separate_occurrences" ||
                        saved.pendingReason === "unclear_occurrence"
                        ? "Report saved · not added to a Happening"
                        : "Report saved · matching needs clarification"
                      : "Report saved · account update pending"}
            </p>
            <ReportCard report={saved} />
            {saved.recommendation?.kind === "match" &&
              saved.recommendation.reason && (
                <p>{saved.recommendation.reason}</p>
              )}
            {saved.state === "match_review" && (
              <section className="match-review" aria-label="Match review">
                {saved.recommendation?.kind === "match" ? (
                  <>
                    <p className="eyebrow">Suggested Happening</p>
                    {saved.candidates
                      .filter(
                        (candidate) => candidate.id === suggestedCandidateId,
                      )
                      .map((candidate) => (
                        <MatchCandidateCard
                          key={candidate.id}
                          candidate={candidate}
                          evidenceIds={suggestedEvidenceIds}
                          onChoose={() =>
                            void chooseMatch({
                              choice: "match",
                              candidateId: candidate.id,
                              candidateIdsShown,
                            })
                          }
                          disabled={busy}
                          recommended
                        />
                      ))}
                    {saved.candidates.length > 1 && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => setShowMoreCandidates((shown) => !shown)}
                      >
                        {showMoreCandidates
                          ? "Hide other nearby Happenings"
                          : `View ${saved.candidates.length - 1} more nearby Happenings`}
                      </button>
                    )}
                    {showMoreCandidates &&
                      saved.candidates
                        .filter(
                          (candidate) => candidate.id !== suggestedCandidateId,
                        )
                        .map((candidate) => (
                          <MatchCandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            onChoose={() =>
                              void chooseMatch({
                                choice: "match",
                                candidateId: candidate.id,
                                candidateIdsShown,
                              })
                            }
                            disabled={busy}
                          />
                        ))}
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void chooseMatch({
                          choice: "create_new",
                          candidateIdsShown,
                        })
                      }
                    >
                      None of these describe what I reported
                    </button>
                  </>
                ) : (
                  <p role="status">
                    Matching suggestions are unavailable. Refresh the nearby
                    candidates before deciding.
                  </p>
                )}
                <button
                  className="text-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void process(saved.id, true)}
                >
                  Refresh nearby suggestions
                </button>
              </section>
            )}
            {saved.state === "clarification" &&
              saved.recommendation?.kind === "uncertain" && (
                <section
                  className="match-review"
                  aria-label="Matching clarification"
                >
                  <h2>Could you clarify?</h2>
                  <p>{saved.recommendation.question}</p>
                  <p className="muted">
                    Choose a nearby Happening if one describes the same
                    situation, or choose none. Leave the Report unassigned if
                    you are unsure.
                  </p>
                  {saved.candidates.map((candidate) => (
                    <MatchCandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      evidenceIds={clarificationEvidenceIds}
                      onChoose={() =>
                        void chooseMatch({
                          choice: "match",
                          candidateId: candidate.id,
                          candidateIdsShown,
                        })
                      }
                      disabled={busy}
                    />
                  ))}
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void chooseMatch({
                        choice: "create_new",
                        candidateIdsShown,
                      })
                    }
                  >
                    None of these describe what I reported
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void process(saved.id, true)}
                  >
                    Refresh nearby suggestions
                  </button>
                </section>
              )}
            {saved.state === "clarification" && !saved.recommendation && (
              <p>
                {saved.pendingReason === "separate_occurrences"
                  ? "Your report describes separate situations. We’ve saved it, but haven’t added it to a Happening."
                  : saved.pendingReason === "evidence_budget"
                    ? "The nearby evidence is too large to compare safely. Your Report is saved and remains unassigned."
                    : "We cannot tell whether this describes one situation. Your Report is saved and remains unassigned."}
              </p>
            )}
            {(saved.state === "pending" || saved.state === "saved") && (
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => void process(saved.id)}
              >
                Retry account update
              </button>
            )}
            {(saved.happeningId ||
              (saved.matchingOutcome === "create_new" &&
                saved.state === "pending")) && (
              <a
                className="primary-button"
                href={`/?happening=${saved.happeningId ?? saved.id}`}
              >
                Inspect public evidence
              </a>
            )}
            <button
              className="text-button"
              onClick={() => {
                localStorage.removeItem(`nearhood-request-${draft.requestKey}`);
                update({
                  requestKey: crypto.randomUUID(),
                  originalText: "",
                  timeChoice: "",
                  sourceUrl: "",
                });
                setSaved(null);
                setSubmissionStarted(false);
                setShowMoreCandidates(false);
                window.history.replaceState({}, "", "/?contribute=1");
              }}
            >
              Start another Report
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="contribution-form">
            {submissionStarted && (
              <p role="status">
                Submission has started. Retry these same words to recover the
                saved Report without duplicates.
              </p>
            )}
            <fieldset
              className="report-fields"
              disabled={submissionStarted || busy}
            >
              <label>
                What did you observe?
                <textarea
                  required
                  maxLength={8000}
                  value={draft.originalText}
                  onChange={(e) => update({ originalText: e.target.value })}
                />
              </label>
              <label>
                Public display name
                <input
                  required
                  maxLength={80}
                  value={draft.displayName}
                  readOnly={hasProfile}
                  onChange={(e) => update({ displayName: e.target.value })}
                />
              </label>
              <p className="muted">
                Choose the name readers see. Your email and Google profile name
                stay private.
              </p>
              <fieldset>
                <legend>Where did you observe it?</legend>
                <p className="muted">
                  Tap the map to place your pin, or enter its coordinates. You
                  can report anywhere.
                </p>
                <ContributionPin
                  coordinates={draft}
                  onChange={(c) => update(c)}
                  mapTilerKey={mapTilerKey}
                />
                <div className="coordinate-fields">
                  <label>
                    Latitude
                    <input
                      type="number"
                      required
                      min={-90}
                      max={90}
                      step="any"
                      value={draft.lat}
                      onChange={(e) => update({ lat: e.target.valueAsNumber })}
                    />
                  </label>
                  <label>
                    Longitude
                    <input
                      type="number"
                      required
                      min={-180}
                      max={180}
                      step="any"
                      value={draft.lng}
                      onChange={(e) => update({ lng: e.target.valueAsNumber })}
                    />
                  </label>
                </div>
                <label>
                  Location description
                  <input
                    required
                    maxLength={200}
                    value={draft.locationName}
                    onChange={(e) => update({ locationName: e.target.value })}
                  />
                </label>
              </fieldset>
              <label>
                Observation time
                <select
                  required
                  value={draft.timeChoice}
                  onChange={(e) => update({ timeChoice: e.target.value })}
                >
                  <option value="">Choose when</option>
                  <option value="now">Just now</option>
                  <option value="chosen">Choose a time</option>
                  <option value="unknown">Time unknown</option>
                </select>
              </label>
              {draft.timeChoice === "chosen" && (
                <label>
                  Observed at (your local time)
                  <input
                    type="datetime-local"
                    required
                    value={draft.chosenTime}
                    onChange={(e) => update({ chosenTime: e.target.value })}
                  />
                </label>
              )}
              <label>
                How do you know?
                <select
                  value={draft.provenance}
                  onChange={(e) => update({ provenance: e.target.value })}
                >
                  <option value="firsthand">I observed it myself</option>
                  <option value="source_based">
                    Information from another source
                  </option>
                </select>
              </label>
              {draft.provenance === "source_based" && (
                <label>
                  Source link (optional)
                  <input
                    type="url"
                    value={draft.sourceUrl}
                    onChange={(e) => update({ sourceUrl: e.target.value })}
                  />
                  <small>
                    Contributor-cited; the app does not fetch or verify this
                    link.
                  </small>
                </label>
              )}
              {draft.candidateId && (
                <p className="muted">
                  Location prefilled from a Happening. This does not establish
                  that your Report belongs to it.
                </p>
              )}
            </fieldset>
            {!sessionReady ? (
              <p role="status">Checking sign-in…</p>
            ) : signedIn ? (
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? "Saving Report…" : "Submit Report"}
              </button>
            ) : (
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
                    window.location.assign("/auth/start");
                  } catch {
                    setError(
                      "Enable draft storage before continuing with Google.",
                    );
                  }
                }}
              >
                Continue with Google
              </button>
            )}
          </form>
        )}
      </main>
    </div>
  );
}

function MatchCandidateCard({
  candidate,
  evidenceIds,
  onChoose,
  disabled,
  recommended = false,
}: {
  candidate: MatchCandidate;
  evidenceIds?: string[];
  onChoose: () => void;
  disabled: boolean;
  recommended?: boolean;
}) {
  const referencedEvidence = evidenceIds?.length
    ? candidate.evidence.filter((item) =>
        evidenceIds.includes(item.observationId),
      )
    : [];
  const evidence = referencedEvidence.length
    ? referencedEvidence
    : candidate.evidence;
  const distance =
    candidate.distanceMeters < 1000
      ? `about ${Math.max(50, Math.round(candidate.distanceMeters / 50) * 50)} m away`
      : `about ${(candidate.distanceMeters / 1000).toFixed(1)} km away`;
  return (
    <article className="match-candidate">
      <div>
        <h2>{candidate.title}</h2>
        <p className="muted">
          {candidate.category} · {candidate.locationName} · {distance}
        </p>
      </div>
      {evidence.map((item) => (
        <div className="match-evidence" key={item.observationId}>
          <p className="eyebrow">
            Original Report · {item.displayName} ·{" "}
            {item.provenance === "source_based"
              ? "Source-based · contributor-declared"
              : "Firsthand · contributor-declared"}
          </p>
          <blockquote>{item.originalText}</blockquote>
          <p className="muted">
            {item.observedAt
              ? `Observed ${new Date(item.observedAt).toLocaleString()}`
              : "Observation time unknown"}
            {` · Submitted ${new Date(item.submittedAt).toLocaleString()}`}
            {item.reportLocationName
              ? ` · Report location: ${item.reportLocationName}`
              : ""}
            {item.spatialScope ? ` · Scope: ${item.spatialScope}` : ""}
          </p>
          {item.sourceUrl && (
            <a href={item.sourceUrl} target="_blank" rel="noreferrer">
              Open contributor-cited source
            </a>
          )}
        </div>
      ))}
      <button
        className="primary-button"
        type="button"
        disabled={disabled}
        onClick={onChoose}
      >
        {recommended ? "Use this Happening" : `Use ${candidate.title}`}
      </button>
    </article>
  );
}
