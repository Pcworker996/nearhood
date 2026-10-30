"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ClaimEvidence,
  Connection,
  HappeningDetail,
} from "@/lib/happenings";
import { OutsideSources } from "./discovery";
import { FigmaIcon } from "./figma-icon";
import { dateLabel, ReportCard } from "./report-card";

type Section = "account" | "evidence" | "timeline" | "uncertainty";
export default function HappeningDetailView({
  detail,
  movedNote = false,
  onBack,
  onContribute,
}: {
  detail: HappeningDetail;
  movedNote?: boolean;
  onBack: () => void;
  onContribute: () => void;
}) {
  const [section, setSection] = useState<Section>("account");
  const [claimId, setClaimId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<ClaimEvidence | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!claimId) return;
    const controller = new AbortController();
    setEvidence(null);
    setError("");
    dialog.current?.showModal();
    fetch(
      `/api/happenings/${encodeURIComponent(detail.id)}/claims/${encodeURIComponent(claimId)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok)
          throw Error(
            "Evidence is temporarily unavailable. Please retry the claim.",
          );
        setEvidence(await response.json());
      })
      .catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      });
    return () => controller.abort();
  }, [claimId, detail.id]);
  function closeEvidence() {
    dialog.current?.close();
    setClaimId(null);
  }
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
          <p className="eyebrow">Happening details</p>
          <span className="brand">Nearhood</span>
        </div>
      </header>
      <main className="detail-content">
        <span className={`badge ${detail.category}`}>{detail.status}</span>
        <p>
          {detail.contributorCount}{" "}
          {detail.contributorCount === 1 ? "contributor" : "contributors"}
        </p>
        <h1>{detail.title}</h1>
        {movedNote && (
          <p role="status">The Happening you opened was moved into this one.</p>
        )}
        <button className="primary-button" onClick={onContribute}>
          Add an update
        </button>
        <p className="muted">
          Provisional current understanding ·{" "}
          {detail.account
            ? `account published ${dateLabel(detail.account.publishedAt)}`
            : "Account update pending"}
        </p>
        <div className="detail-facts">
          <div>
            <span className="fact-icon">
              <FigmaIcon name="location" />
            </span>
            <span>
              <small>Location</small>
              <strong>{detail.locationName}</strong>
            </span>
          </div>
          <div>
            <span className="fact-icon">
              <FigmaIcon name="contributors" />
            </span>
            <span>
              <small>Contributors</small>
              <strong>{detail.contributorCount} distinct contributors</strong>
            </span>
          </div>
        </div>
        {detail.startsAt && (
          <p>
            Scheduled: {dateLabel(detail.startsAt)} ·{" "}
            {detail.endsAt
              ? `Ends ${dateLabel(detail.endsAt)}`
              : "End time unknown"}
            . The schedule does not establish that the activity occurred.
          </p>
        )}
        <nav className="detail-tabs" aria-label="Happening information">
          {(
            [
              ["account", "Current account"],
              ["evidence", "Evidence"],
              ["timeline", "Timeline"],
              ["uncertainty", "Uncertainty"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={section === key}
              onClick={() => setSection(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        {section === "account" && (
          <section>
            <h2>Current account</h2>
            <p className="muted">
              Claims are derived interpretations, not the contributors’ words.
              Select a claim to inspect the original Reports behind it.
            </p>
            {detail.account?.claims.map((claim) => (
              <button
                className="claim"
                key={claim.id}
                onClick={() => setClaimId(claim.id)}
              >
                {claim.statement}
                <FigmaIcon name="chevron" />
              </button>
            ))}
            {!detail.account && (
              <p>
                Original Reports are available. No Shared account has been
                published.
              </p>
            )}
          </section>
        )}
        {section === "evidence" && (
          <section>
            <h2>Original Reports</h2>
            <p className="muted">
              Contributor participation is not a measure of independent
              corroboration.
            </p>
            {detail.reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </section>
        )}
        {section === "timeline" && (
          <section>
            <h2>Evidence timeline</h2>
            <p className="muted">
              Newest observation first. Submission time is shown separately;
              unknown observation times remain unknown.
            </p>
            {detail.observations.map((observation) => {
              const report = detail.reports.find(
                (r) => r.id === observation.reportId,
              );
              return report ? (
                <ReportCard
                  key={observation.id}
                  observation={observation}
                  report={report}
                />
              ) : null;
            })}
            {!detail.observations.length &&
              detail.reports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
          </section>
        )}
        {(section === "account" || section === "uncertainty") && (
          <aside className="uncertainty-box">
            <FigmaIcon name="uncertainty" />
            <div>
              <h2>What’s still unclear</h2>
              {detail.account?.uncertainty.map((item) => (
                <p key={item}>{item}</p>
              ))}
              {!detail.account && (
                <p>
                  No Shared account has been published. Current conditions
                  remain unknown; inspect the original Report for its
                  contributor's words.
                </p>
              )}
            </div>
          </aside>
        )}
        {(section === "account" || section === "uncertainty") &&
          detail.sourceCheck && (
            <OutsideSources
              check={detail.sourceCheck}
              accountVersion={detail.account?.version}
            />
          )}
        {(section === "account" || section === "uncertainty") &&
          detail.connections.map((connection) => (
            <PossibleConnection
              key={connection.happeningId}
              connection={connection}
            />
          ))}
        <p className="fixture-note">
          {detail.demo ? "Fictional Northbank demo data" : "Community reports"}
          {detail.account?.origin === "seed_fixture" &&
            " · Seeded account fixture, not live model output"}
        </p>
      </main>
      <dialog
        ref={dialog}
        aria-labelledby="evidence-heading"
        onCancel={() => setClaimId(null)}
        onClose={() => setClaimId(null)}
      >
        <div className="dialog-heading">
          <h2 id="evidence-heading">Evidence for this claim</h2>
          <button className="text-button" onClick={closeEvidence}>
            Close evidence
          </button>
        </div>
        {evidence && (
          <>
            <p className="selected-claim">{evidence.claim.statement}</p>
            {evidence.evidence.map((pair) => (
              <ReportCard
                key={pair.observation.id}
                report={pair.report}
                observation={pair.observation}
              />
            ))}
            <p className="muted">
              Evidence describes the cited time and scope. See the current
              account’s uncertainty and full timeline for context.
            </p>
            <button
              className="primary-button"
              onClick={() => {
                setSection("timeline");
                closeEvidence();
              }}
            >
              Open full evidence timeline
            </button>
          </>
        )}
        {!evidence && !error && <p role="status">Loading claim evidence…</p>}
        {error && <p role="alert">{error}</p>}
      </dialog>
    </div>
  );
}

// Every statement is shown, oldest first; none settles the connection (ADR 0008).
function PossibleConnection({ connection }: { connection: Connection }) {
  const headingId = `connection-${connection.happeningId}`;
  return (
    <section className="uncertainty-box" aria-labelledby={headingId}>
      <div>
        <h2 id={headingId}>Possible connection with {connection.title}</h2>
        <ul>
          {connection.statements.map((statement) => (
            <li key={`${statement.source}-${statement.kind}-${statement.reportId}`}>
              {statement.source === "automatic_matching"
                ? "Automatic matching found a Report may describe both"
                : statement.kind === "unsure"
                  ? `${statement.displayName} couldn't tell whether their Report is about the same situation`
                  : `${statement.displayName} said their Report is about a different situation`}{" "}
              ({dateLabel(statement.createdAt)}).
              {statement.reason && ` ${statement.reason}`}
              {statement.partialEvidence &&
                " Checked on only some of the Reports."}
            </li>
          ))}
        </ul>
        <p>
          Not confirmed.{" "}
          <a href={`/?happening=${encodeURIComponent(connection.happeningId)}`}>
            View {connection.title}
          </a>
        </p>
      </div>
    </section>
  );
}
