import { randomUUID } from "node:crypto";
import { database } from "./database";
import { savedReport } from "./report-submission";
import { extractReport } from "./report-model";

export async function processReport(id: string, contributorId: string) {
  const report = await savedReport(id, contributorId);
  const attempt = randomUUID();
  const lease = await database().query(
    `UPDATE nearhood.report_processing SET state='processing', attempt=$3, lease_until=now()+interval '60 seconds'
    WHERE report_id=$1 AND contributor_id=$2 AND state <> 'published' AND (state <> 'processing' OR lease_until < now()) RETURNING report_id`,
    [id, contributorId, attempt],
  );
  if (!lease.rowCount) return savedReport(id, contributorId);
  try {
    const { extraction, model } = await extractReport({
      originalText: report.originalText,
      observedAt: report.observedAt,
      provenance: report.provenance,
      sourceUrl: report.sourceUrl,
    });
    // No matching is implied by a selected detail or matching coordinates.
    // Unrelated/ambiguous observations remain unassigned and cannot support an account.
    if (!report.clearlyNew || !extraction.sameOccurrence) {
      await database().query(
        "UPDATE nearhood.report_processing SET state='clarification', attempt=NULL, lease_until=NULL, model_id=$3 WHERE report_id=$1 AND attempt=$2",
        [id, attempt, model],
      );
      return savedReport(id, contributorId);
    }
    const client = await database().connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        "SELECT report_id FROM nearhood.report_processing WHERE report_id=$1 AND attempt=$2 AND state='processing' AND lease_until > now() FOR UPDATE",
        [id, attempt],
      );
      if (!locked.rowCount) {
        await client.query("ROLLBACK");
        return savedReport(id, contributorId);
      }
      await client.query(
        `INSERT INTO nearhood.happenings(id,title,category,location_name,location)
        SELECT r.id,$2,$3,p.location_name,r.location FROM nearhood.reports r JOIN nearhood.report_processing p ON p.report_id=r.id WHERE r.id=$1`,
        [id, `Report near ${report.locationName}`, extraction.category],
      );
      const observationIds = new Map<string, string>();
      for (const observation of extraction.observations) {
        const observationId = randomUUID();
        observationIds.set(observation.key, observationId);
        await client.query(
          "INSERT INTO nearhood.observations(id,report_id,subject,described_state,spatial_scope,observed_at) VALUES ($1,$2,$3,$4,$5,$6)",
          [
            observationId,
            id,
            observation.subject,
            observation.excerpt,
            observation.spatialScope,
            report.observedAt,
          ],
        );
        await client.query(
          "INSERT INTO nearhood.observation_memberships(happening_id,observation_id) VALUES ($1,$2)",
          [id, observationId],
        );
      }
      const accountId = randomUUID();
      const uncertainty = [
        "One contributor's account; not independently verified.",
        "Unobserved conditions and extent remain unknown.",
      ];
      if (!report.observedAt)
        uncertainty.push(
          "Observation time is unknown; this Report does not establish current conditions.",
        );
      if (report.provenance === "source_based")
        uncertainty.push(
          "Contributor-cited information; the app has not checked the source.",
        );
      await client.query(
        "INSERT INTO nearhood.shared_accounts(id,happening_id,version,published_at,origin,uncertainty) VALUES ($1,$2,1,now(),'model_derived',$3)",
        [accountId, id, uncertainty],
      );
      for (const [position, claim] of extraction.claims.entries()) {
        const claimId = randomUUID();
        await client.query(
          "INSERT INTO nearhood.claims(id,account_id,statement,position) VALUES ($1,$2,$3,$4)",
          [claimId, accountId, claim.statement, position],
        );
        for (const key of claim.observationKeys)
          await client.query(
            "INSERT INTO nearhood.claim_supports(claim_id,observation_id) VALUES ($1,$2)",
            [claimId, observationIds.get(key)],
          );
      }
      await client.query(
        "UPDATE nearhood.report_processing SET state='published', happening_id=$1, attempt=NULL, lease_until=NULL, model_id=$2 WHERE report_id=$1",
        [id, model],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch {
    // Never leak submitted words/provider payloads to logs or replace the saved Report.
    await database().query(
      "UPDATE nearhood.report_processing SET state='pending', attempt=NULL, lease_until=NULL WHERE report_id=$1 AND attempt=$2",
      [id, attempt],
    );
  }
  return savedReport(id, contributorId);
}
