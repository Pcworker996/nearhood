"use client";

import { useState } from "react";
import type {
  Bounds,
  Coordinates,
  DiscoveryCard,
  DiscoveryResult,
  SourceCheck,
} from "@/lib/happenings";
import { FigmaIcon } from "./figma-icon";
import { dateLabel } from "./report-card";

export type DiscoveryState = {
  question: string;
  result: DiscoveryResult | null;
};
const categoryLabels = {
  disruption: "Disruption",
  safety: "Safety concern",
  activity: "Activity",
  pending: "Pending Report",
};
const relationLabels = {
  consistent: "Agrees with Reports",
  conflicts: "Conflicts with Reports",
  unclear: "Unclear if same situation",
};

export default function Discovery({
  bounds,
  center,
  state,
  onState,
  onOpen,
  onBack,
}: {
  bounds: Bounds;
  center: Coordinates;
  state: DiscoveryState;
  onState: (state: DiscoveryState) => void;
  onOpen: (card: DiscoveryCard) => void;
  onBack: () => void;
}) {
  const [question, setQuestion] = useState(state.question);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  async function ask(text: string, expand = false) {
    setAsking(true);
    setError("");
    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, bounds, center, expand }),
      });
      const body = await response.json();
      if (!response.ok)
        throw Error(body.error ?? "Discovery is temporarily unavailable.");
      onState({ question: text, result: body });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Discovery is temporarily unavailable.",
      );
    } finally {
      setAsking(false);
    }
  }
  const result = state.result;
  return (
    <div className="detail-screen">
      <header className="topbar">
        <button
          className="round-button"
          aria-label="Back to map"
          onClick={onBack}
        >
          <FigmaIcon name="back" />
        </button>
        <div>
          <p className="eyebrow">Discover</p>
          <span className="brand">Nearhood</span>
        </div>
      </header>
      <main className="detail-content discovery">
        <h1>Ask about what’s happening nearby</h1>
        <p className="muted">
          Answers come only from Happenings stored in Nearhood for this map
          area. Outside sources are shown separately and are never Nearhood
          evidence.
        </p>
        <form
          className="discovery-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (question.trim() && !asking) ask(question.trim());
          }}
        >
          <label htmlFor="discovery-question">Your question</label>
          <textarea
            id="discovery-question"
            value={question}
            maxLength={300}
            rows={2}
            placeholder="Can I walk across the footbridge right now?"
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button
            className="primary-button"
            type="submit"
            disabled={asking || !question.trim()}
          >
            {asking ? "Searching…" : "Ask Nearhood"}
          </button>
        </form>
        {asking && (
          <p role="status">
            Searching stored Happenings and reading their evidence…
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {result && !asking && (
          <>
            {result.trace.length > 0 && (
              <details className="discovery-trace" open>
                <summary>How this answer was found</summary>
                <ol aria-label="Discovery steps">
                  {result.trace.map((step, i) => (
                    <li key={i}>{step.summary}</li>
                  ))}
                </ol>
              </details>
            )}
            {result.fallback && <p role="status">{result.fallback}</p>}
            {result.cards.length === 0 && (
              <div className="empty-area">
                <h3>No stored Happenings match</h3>
                <p>
                  {result.noMatchReason ??
                    "No stored Happenings match in this area."}{" "}
                  Nothing was invented to fill the gap.
                </p>
                {!result.expandedArea && (
                  <button
                    className="primary-button"
                    onClick={() => ask(state.question, true)}
                  >
                    Expand search area
                  </button>
                )}
              </div>
            )}
            {result.cards.map((card) => (
              <ResultCard key={card.happeningId} card={card} onOpen={onOpen} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function ResultCard({
  card,
  onOpen,
}: {
  card: DiscoveryCard;
  onOpen: (card: DiscoveryCard) => void;
}) {
  return (
    <article className="discovery-card" aria-label={card.title}>
      <span className={`badge ${card.category}`}>
        {categoryLabels[card.category]}
      </span>
      <h2>{card.title}</h2>
      <p className="muted">
        {card.locationName} · Last observed {dateLabel(card.lastObservedAt)}
      </p>
      {card.relevance && <p className="relevance">{card.relevance}</p>}
      <h3>What Reports show</h3>
      {card.claims.length ? (
        <ul>
          {card.claims.map((claim) => (
            <li key={claim.id}>{claim.statement}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No Shared account has been published yet.</p>
      )}
      <h3>Cause</h3>
      {card.cause ? (
        <p className="cause">
          {card.cause.summary} — “{card.cause.quote}”{" "}
          {card.cause.source === "report" ? (
            <span className="muted">
              (
              {card.cause.provenance === "source_based"
                ? "source-based Report"
                : "Report"}{" "}
              by {card.cause.displayName})
            </span>
          ) : (
            <span className="muted">
              (outside source:{" "}
              <a href={card.cause.url} target="_blank" rel="noreferrer">
                {card.cause.site}
              </a>
              , not Nearhood evidence)
            </span>
          )}
        </p>
      ) : (
        <p className="muted">Cause not reported.</p>
      )}
      {card.suggestions.length > 0 && (
        <>
          <h3>Suggestions</h3>
          <ul>
            {card.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {card.notices.map((notice) => (
        <p className="notice" key={notice}>
          {notice}
        </p>
      ))}
      {card.unknowns.length > 0 && (
        <aside className="uncertainty-box">
          <FigmaIcon name="uncertainty" />
          <div>
            <h2>Still unknown</h2>
            {card.unknowns.map((u) => (
              <p key={u}>{u}</p>
            ))}
          </div>
        </aside>
      )}
      {card.sourceCheck && <OutsideSources check={card.sourceCheck} />}
      <button className="primary-button" onClick={() => onOpen(card)}>
        Show on map and open details <FigmaIcon name="preview-chevron" />
      </button>
    </article>
  );
}

export function OutsideSources({
  check,
  accountVersion,
}: {
  check: SourceCheck;
  accountVersion?: number;
}) {
  return (
    <section className="outside-sources" aria-label="Outside sources">
      <h3>Outside sources — not Nearhood evidence</h3>
      <p className="muted">
        Checked {dateLabel(check.checkedAt)} · compared with account version{" "}
        {check.accountVersion}
        {accountVersion !== undefined &&
          accountVersion !== check.accountVersion &&
          " (the account has changed since)"}
      </p>
      {check.findings.length === 0 ? (
        <p>No outside sources found.</p>
      ) : (
        <ul>
          {check.findings.map((finding) => (
            <li key={finding.url}>
              <span className={`relation ${finding.relation}`}>
                {relationLabels[finding.relation]}
              </span>{" "}
              <a href={finding.url} target="_blank" rel="noreferrer">
                {finding.title}
              </a>{" "}
              <span className="muted">
                {finding.site} ·{" "}
                {finding.publishedDate
                  ? dateLabel(finding.publishedDate)
                  : "date unknown"}
              </span>
              {finding.note && <p>{finding.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
