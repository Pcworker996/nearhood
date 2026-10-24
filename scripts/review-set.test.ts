import assert from "node:assert/strict";
import test from "node:test";
import type { MatchCandidate } from "../src/lib/happenings";
import { reviewSet } from "../src/lib/report-submission";

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

test("the review set follows the assessment order, puts separate candidates last and shows five", () => {
  const assessments = [
    { candidateId: "c", continuity: "separate" },
    { candidateId: "a", continuity: "same" },
    { candidateId: "e", continuity: "unknown" },
    { candidateId: "b", continuity: "separate" },
    { candidateId: "d", continuity: "unknown" },
    { candidateId: "g", continuity: "unknown" },
    { candidateId: "f", continuity: "unknown" },
  ] as const;
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
    "c",
    "b",
  ]);
});

test("without assessments the review set is the first five saved candidates", () => {
  assert.deepEqual(ids(reviewSet(packet, [])), ["a", "b", "c", "d", "e"]);
});
