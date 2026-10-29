import type { Observation, Report } from "@/lib/happenings";

export function dateLabel(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Detroit",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(value))
    : "Observation time unknown";
}

export function ReportCard({
  report,
  observation,
}: {
  report: Report;
  observation?: Observation;
}) {
  return (
    <article className="report-card">
      <header>
        <span className="avatar" aria-hidden="true">
          {report.displayName
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div>
          <strong>{report.displayName}</strong>
          <span className="muted">Attributed original Report</span>
        </div>
      </header>
      {observation && (
        <div className="interpretation">
          <span className="eyebrow">Derived Observation</span>
          <p>
            {observation.subject}:{" "}
            {observation.describedState ?? "No condition described"}
          </p>
          {observation.uncertainty && (
            <p>Uncertainty: {observation.uncertainty}</p>
          )}
          {!!observation.sourceSupport?.length && (
            <details>
              <summary>Supporting passages</summary>
              {observation.sourceSupport.map((p) => (
                <blockquote key={`${p.start}:${p.end}`}>{p.text}</blockquote>
              ))}
            </details>
          )}
          <p>Spatial scope: {observation.spatialScope ?? "Unknown"}</p>
          <p>Observation time: {dateLabel(observation.observedAt)}</p>
        </div>
      )}
      <p className="eyebrow">Contributor’s original words</p>
      <blockquote>{report.originalText}</blockquote>
      <span className="provenance">
        {report.provenance === "firsthand"
          ? "Firsthand report — contributor-declared"
          : "Source-based report — contributor-declared"}
      </span>
      {report.sourceUrl && (
        <p>
          Contributor-cited source:{" "}
          <a href={report.sourceUrl} rel="noreferrer">
            Open source link
          </a>{" "}
          · not checked by the app
        </p>
      )}
      <dl className="report-times">
        <div>
          <dt>Observed</dt>
          <dd>{dateLabel(report.observedAt)}</dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{dateLabel(report.submittedAt)}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>
            {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
          </dd>
        </div>
      </dl>
    </article>
  );
}
