import assert from "node:assert/strict";
import type {
  CandidateAssessment,
  compareReport,
} from "../src/lib/report-model";

export type MatchingCase = {
  id: string;
  family: string;
  baseId?: string;
  transform?: string;
  input: Parameters<typeof compareReport>;
  expected: {
    assessments: {
      candidateId: string;
      continuity: CandidateAssessment["continuity"];
      chronology?: CandidateAssessment["chronology"];
      scope?: CandidateAssessment["scope"];
      requiredEvidence?: string[];
    }[];
    first?: string;
    recommendation:
      | { kind: "match"; candidateId: string }
      | { kind: "uncertain" | "no_match" };
  };
  review: string;
};

export function providerUsage(response: unknown) {
  if (!response || typeof response !== "object" || !("usage" in response))
    return { prompt: null, completion: null };
  const usage = response.usage;
  if (!usage || typeof usage !== "object")
    return { prompt: null, completion: null };
  return {
    prompt:
      "prompt_tokens" in usage &&
      typeof usage.prompt_tokens === "number" &&
      Number.isSafeInteger(usage.prompt_tokens)
        ? usage.prompt_tokens
        : null,
    completion:
      "completion_tokens" in usage &&
      typeof usage.completion_tokens === "number" &&
      Number.isSafeInteger(usage.completion_tokens)
        ? usage.completion_tokens
        : null,
  };
}

export function scoreMatching(
  expected: MatchingCase["expected"],
  assessments: CandidateAssessment[],
  matching: Awaited<ReturnType<typeof compareReport>>["matching"],
) {
  const modelErrors: string[] = [];
  if (assessments.length !== expected.assessments.length)
    modelErrors.push("Incomplete assessment set");
  for (const gold of expected.assessments) {
    const actual = assessments.find((a) => a.candidateId === gold.candidateId);
    if (!actual) {
      modelErrors.push(`${gold.candidateId}: missing`);
      continue;
    }
    for (const dimension of [
      "continuity",
      "chronology",
      "scope",
    ] satisfies (keyof CandidateAssessment)[]) {
      if (gold[dimension] && gold[dimension] !== actual[dimension]) {
        modelErrors.push(
          `${gold.candidateId}: ${dimension} ${actual[dimension]}, expected ${gold[dimension]}`,
        );
      }
    }
    if (gold.requiredEvidence?.some((id) => !actual.evidenceIds.includes(id)))
      modelErrors.push(`${gold.candidateId}: missing required evidence`);
  }
  if (expected.first && assessments[0]?.candidateId !== expected.first)
    modelErrors.push(`Expected ${expected.first} ranked first`);
  const adapterCorrect =
    matching.kind === expected.recommendation.kind &&
    (expected.recommendation.kind !== "match" ||
      (matching.kind === "match" &&
        matching.candidateId === expected.recommendation.candidateId));
  return { modelErrors, adapterCorrect };
}

export function validateCase(c: MatchingCase) {
  const [report, extraction, candidates] = c.input;
  assert.equal(extraction.occurrence, "single");
  assert.equal(extraction.sameOccurrence, true);
  assert.ok(candidates.length > 0 && candidates.length <= 20);
  assert.equal(new Set(candidates.map((x) => x.id)).size, candidates.length);
  assert.deepEqual(
    candidates.map((x) => x.id).sort(),
    c.expected.assessments.map((x) => x.candidateId).sort(),
  );
  for (const o of extraction.observations) {
    assert.equal(o.occurrenceGroup, 0);
    assert.ok(
      o.subject.length <= 80 &&
        (!o.describedCondition || o.describedCondition.length <= 160),
    );
    for (const support of o.sourceSupport)
      assert.equal(
        report.originalText.slice(support.start, support.end),
        support.text,
      );
    if (o.spatialScope) assert.ok(report.originalText.includes(o.spatialScope));
  }
  const evidenceIds = candidates.flatMap((x) =>
    x.evidence.map((e) => e.observationId),
  );
  assert.equal(new Set(evidenceIds).size, evidenceIds.length);
  for (const candidate of candidates) {
    assert.ok(candidate.evidence.length);
    const gold = c.expected.assessments.find(
      (a) => a.candidateId === candidate.id,
    )!;
    for (const id of gold.requiredEvidence ?? [])
      assert.ok(candidate.evidence.some((e) => e.observationId === id));
  }
}
