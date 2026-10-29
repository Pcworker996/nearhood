import assert from "node:assert/strict";
import test from "node:test";
import { scoreCategory } from "./live-category";

test("only a hazard labelled activity fails the live category gate", () => {
  assert.deepEqual(scoreCategory("activity", ["safety"]), {
    miss: true,
    hazardAsActivity: true,
  });
  assert.deepEqual(scoreCategory("activity", ["disruption"]), {
    miss: true,
    hazardAsActivity: true,
  });
  assert.deepEqual(scoreCategory("disruption", ["safety"]), {
    miss: true,
    hazardAsActivity: false,
  });
  assert.deepEqual(scoreCategory("safety", ["activity"]), {
    miss: true,
    hazardAsActivity: false,
  });
  assert.deepEqual(scoreCategory("activity", ["disruption", "activity"]), {
    miss: false,
    hazardAsActivity: false,
  });
  assert.deepEqual(scoreCategory("activity"), {
    miss: false,
    hazardAsActivity: false,
  });
});
