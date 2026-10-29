import assert from "node:assert/strict";
import test from "node:test";
import type { MatchCandidate } from "../src/lib/happenings";
import type { CandidateAssessment } from "../src/lib/report-model";
import { reviewSet } from "../src/lib/report-submission";

function assessment(
  candidateId: string,
  continuity: CandidateAssessment["continuity"],
  chronology: CandidateAssessment["chronology"] = "consistent",
): CandidateAssessment {
  return {
    candidateId,
    continuity,
    chronology,
    scope: "same",
    evidenceIds: ["evidence"],
    reason: "Stored assessment.",
  };
}

const packet = ["a", "b", "c", "d", "e", "f", "g"].map(
  (id): MatchCandidate => ({
    id,
    title: `Happening ${id}`,
    category: "disruption",
    locationName: "Test place",
    distanceMeters: 10,
    lat: 0,
    lng: 0,
    evidence: [],
  }),
);
const ids = (candidates: MatchCandidate[]) => candidates.map((c) => c.id);

test("every possible match is offered, same before unknown, and separate candidates are not", () => {
  const assessments = [
    assessment("c", "separate"),
    assessment("a", "same"),
    assessment("e", "unknown"),
    assessment("b", "separate"),
    assessment("d", "unknown"),
    assessment("g", "unknown"),
    assessment("f", "unknown"),
  ];
  assert.deepEqual(ids(reviewSet(packet, [...assessments])), [
    "a",
    "e",
    "d",
    "g",
    "f",
  ]);
  assert.deepEqual(ids(reviewSet(packet, [...assessments].slice(0, 4))), [
    "a",
    "e",
  ]);
});

test("a conflicting separate assessment is offered as a possible match", () => {
  const assessments = [
    assessment("c", "separate"),
    assessment("a", "separate", "conflict"),
    assessment("e", "separate"),
    assessment("b", "separate"),
    assessment("d", "separate"),
    assessment("g", "separate"),
    assessment("f", "separate"),
  ];
  assert.deepEqual(ids(reviewSet(packet, assessments)), ["a"]);
});

test("without assessments the review set is the first five saved candidates", () => {
  assert.deepEqual(ids(reviewSet(packet, [])), ["a", "b", "c", "d", "e"]);
});
