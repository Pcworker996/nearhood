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
  origin: "seed_fixture" | "model_derived" | "connection_update";
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
  sourceSupport?: { start: number; end: number; text: string }[];
  id: string;
  reportId: string;
  subject: string;
  describedState: string | null;
  uncertainty?: string | null;
  spatialScope: string | null;
  observedAt: string | null;
};
export type ReportProcessingState =
  | "saved"
  | "processing"
  | "pending"
  | "match_review"
  | "clarification"
  | "published";
export type MatchEvidence = {
  observationId: string;
  reportId: string;
  originalText: string;
  displayName: string;
  observedAt: string | null;
  submittedAt: string;
  provenance: "firsthand" | "source_based";
  sourceUrl: string | null;
  reportLocationName: string | null;
  lat: number;
  lng: number;
  subject: string;
  describedState: string | null;
  spatialScope: string | null;
};
export type MatchCandidate = Coordinates & {
  id: string;
  title: string;
  category: "disruption" | "safety" | "activity";
  locationName: string;
  distanceMeters: number;
  evidence: MatchEvidence[];
  accountVersion?: number;
};
export type MatchRecommendation =
  | {
      kind: "match";
      candidateId: string;
      evidenceIds: string[];
      reason?: string;
    }
  | { kind: "no_match" }
  | { kind: "uncertain"; evidenceIds: string[]; question: string };
// Suggestions shown before "Show more" (ADR 0008).
export const REVIEW_SET_SIZE = 5;
export type MatchChoice =
  | { choice: "match"; candidateId: string; candidateIdsShown: string[] }
  | { choice: "create_new"; candidateIdsShown: string[] }
  | { choice: "unsure"; candidateIdsShown: string[] };
export type SavedReport = Report & {
  processingStage: "extraction" | "matching";
  extractionReady: boolean;
  nextAction: "process" | "retry" | "review" | "wait" | "none";
  pendingReason: string | null;
  state: ReportProcessingState;
  happeningId: string | null;
  locationName: string;
  candidateId: string | null;
  candidateIds: string[];
  candidates: MatchCandidate[];
  recommendation: MatchRecommendation | null;
  matchingOutcome: "matched" | "create_new" | null;
  decisionCandidateIds: string[];
};
export type Connection = {
  happeningId: string;
  title: string;
  statements: {
    source: "automatic_matching" | "contributor";
    kind: "possibly_same" | "unsure" | "different";
    reportId: string;
    displayName: string | null;
    createdAt: string;
    reason: string | null;
    evidenceIds: string[];
    partialEvidence: boolean;
  }[];
};
export type HappeningDetail = Happening & {
  reports: Report[];
  observations: Observation[];
  connections: Connection[];
  sourceCheck?: SourceCheck | null;
};
// Outside information is never evidence (ADR 0009); relation compares one
// finding with the account version the check names.
export type SourceFinding = {
  url: string;
  title: string;
  site: string;
  publishedDate: string | null;
  snippet: string;
  relation: "consistent" | "conflicts" | "unclear";
  note: string | null;
};
export type SourceCheck = {
  id: string;
  happeningId: string;
  accountVersion: number;
  query: string;
  checkedAt: string;
  findings: SourceFinding[];
};
export type DiscoveryTraceStep = {
  tool: string;
  summary: string;
};
export type DiscoveryCard = Coordinates & {
  happeningId: string;
  title: string;
  category: Happening["category"];
  locationName: string;
  status: string;
  relevance: string;
  claims: Claim[];
  unknowns: string[];
  cause:
    | {
        summary: string;
        quote: string;
        source: "report";
        displayName: string;
        provenance: Report["provenance"];
      }
    | {
        summary: string;
        quote: string;
        source: "outside";
        url: string;
        site: string;
      }
    | null;
  suggestions: string[];
  notices: string[];
  lastObservedAt: string | null;
  sourceCheck: SourceCheck | null;
};
export type DiscoveryResult = {
  cards: DiscoveryCard[];
  trace: DiscoveryTraceStep[];
  expandedArea: boolean;
  fallback: string | null;
  noMatchReason: string | null;
};
export type ClaimEvidence = {
  claim: Claim;
  evidence: { observation: Observation; report: Report }[];
};
