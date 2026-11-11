import assert from "node:assert/strict";
import { test } from "node:test";
import { episodeOf } from "../dist/acquired/episodes.js";

test("A refused submission and its accepted correction retain their evidence", () => {
  const source = {
    taskId: "inspection-1", topic: "inspection", intent: "Inspect a region",
    steps: [
      { n: 1, capability: "inspection.submit", input: { value: 9 }, outcome: "refused", judged: "refused", reason: "range: criteria.value must be below 5" },
      { n: 2, capability: "inspection.submit", input: { value: 4 }, outcome: "completed", judged: "accepted", reason: null },
    ],
  };
  const episode = episodeOf(source, [/^inspection\.submit$/], (_capability, input) => ({ "criteria.value": input.value }));
  assert.equal(episode.finalOutcome, "ACCEPTED");
  assert.equal(episode.contrasts.length, 1);
  assert.equal(episode.contrasts[0].rejected.argument, 9);
  assert.equal(episode.contrasts[0].accepted.argument, 4);
  assert.equal(episode.attempts[0].outcome, "GUARD_REJECTED");
});

test("A failed executed capability is not an accepted artifact", () => {
  const episode = episodeOf({ taskId: "inspection-2", topic: "inspection", intent: "Inspect", steps: [
    { n: 1, capability: "inspection.submit", input: {}, outcome: "error", judged: "accepted", reason: "source unavailable" },
  ] }, [/^inspection\.submit$/]);
  assert.equal(episode.attempts[0].outcome, "CAPABILITY_FAILED");
  assert.equal(episode.finalOutcome, "NOT_ACCEPTED");
});
