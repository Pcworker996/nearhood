export type Coordinates = { lat: number; lng: number };
export type Bounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};
export const DEMO_CENTER: Coordinates = { lat: 42.3328, lng: -83.0488 };
export const DEMO_BOUNDS: Bounds = {
  west: -83.066,
  south: 42.322,
  east: -83.033,
  north: 42.343,
};

export type Claim = { id: string; statement: string };
export type SharedAccount = {
  id: string;
  version: number;
  publishedAt: string;
  origin: "seed_fixture" | "model_derived";
  uncertainty: string[];
  claims: Claim[];
};
export type Happening = Coordinates & {
  id: string;
  title: string;
  category: "disruption" | "safety" | "activity" | "pending";
  locationName: string;
  status: string;
  demo: boolean;
  startsAt: string | null;
  endsAt: string | null;
  contributorCount: number;
  account: SharedAccount | null;
};
export type Report = Coordinates & {
  id: string;
  contributorId: string;
  displayName: string;
  originalText: string;
  observedAt: string | null;
  submittedAt: string;
  provenance: "firsthand" | "source_based";
  sourceUrl: string | null;
};
export type Observation = {
  id: string;
  reportId: string;
  subject: string;
  describedState: string;
  spatialScope: string | null;
  observedAt: string | null;
};
export type ReportProcessingState =
  "saved" | "processing" | "pending" | "clarification" | "published";
export type SavedReport = Report & {
  state: ReportProcessingState;
  happeningId: string | null;
  locationName: string;
  clearlyNew: boolean;
  candidateId: string | null;
};
export type HappeningDetail = Happening & {
  reports: Report[];
  observations: Observation[];
};
export type ClaimEvidence = {
  claim: Claim;
  evidence: { observation: Observation; report: Report }[];
};
