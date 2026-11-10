/**
 * A refusal, as the next prompt says it, whatever refused (harness/core/problems.ts, 2026-09-28): problems with their
 * points read from any guard's words, a streak counted on the points whatever the input changed, a note that says
 * the problems, then only what is expected at the same points, and the third refusal on them that ends the task.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextStreak, noteRefusal, problemOf, problemsOfReason, refusalKey, refusalNote, STUCK_AFTER } from "../dist/acquired/problems.js";
describe("a refusal, whatever refused, as the next prompt says it", () => {
    it("reads problems from a guard's words: the kind, the path, a schema's expectation; the guards' '; ' outside brackets", () => {
        assert.deepEqual(problemOf("Invalid capability arguments: data/abort/1/threshold must be number"), { says: "Invalid capability arguments: data/abort/1/threshold must be number", kind: "schema", path: "abort.1.threshold", expected: "must be number" });
        assert.deepEqual(problemOf("floor: steps.1.speedPercent = 0 is not above 0"), { says: "floor: steps.1.speedPercent = 0 is not above 0", kind: "floor", path: "steps.1.speedPercent" });
        assert.equal(problemOf("the plan needs installationRead: read factory.inventory").path, undefined);
        const problems = problemsOfReason("procedure refused: floor: steps.1.speedPercent = 0 is not above 0; justification: limits.maxMinutes = 24 (a; b) has no source");
        assert.deepEqual(problems.map((p) => [p.kind, p.path]), [["floor", "steps.1.speedPercent"], ["justification", "limits.maxMinutes"]]);
    });
    it("counts a streak on the same points whatever the values sent; another point starts it again", () => {
        const a = problemsOfReason("justification: steps.2.speedPercent = 100 cites scrubber.effectiveFlowAtFull (1 m3/min)");
        const b = problemsOfReason("justification: steps.2.speedPercent = 99 is a safety constant: it is justified by a fact of a signed library document, not by a calculation");
        assert.equal(refusalKey(a), refusalKey(b), "the same point, other words and values");
        let s = nextStreak(null, "procedure.submit", a);
        s = nextStreak(s, "procedure.revise", b);
        assert.equal(s.times, 2);
        s = nextStreak(s, "procedure.revise", problemsOfReason("floor: steps.1.speedPercent = 0 is not above 0"));
        assert.equal(s.times, 1);
        // Without a path, the words without their numbers are the point.
        assert.equal(refusalKey(problemsOfReason("the same call failed with 12 runs")), refusalKey(problemsOfReason("the same call failed with 40 runs")));
    });
    it("says the problems first, then only what is expected at the same points and that one more ends the task", () => {
        const progress = { pendingProblems: [{ says: "floor: steps.1.speedPercent = 0 is not above 0", kind: "floor", path: "steps.1.speedPercent", expected: "above 0", got: "0" }], refusal: null };
        const first = noteRefusal(progress, "procedure.submit", "procedure refused: whatever the text says");
        assert.equal(progress.pendingProblems, null, "the guard's problems are taken once");
        assert.match(refusalNote(first), /^Your last procedure\.submit was refused, on 1 point\(s\): \(1\) steps\.1\.speedPercent: floor: steps\.1\.speedPercent = 0 is not above 0 \(expected: above 0\) \(sent: 0\)/);
        const second = noteRefusal(progress, "procedure.revise", "procedure refused: floor: steps.1.speedPercent = 0 is not above 0");
        assert.equal(second.times, 2);
        assert.match(refusalNote(second), /^Refused 2 times in a row on the same point\(s\), steps\.1\.speedPercent, whatever else changed.*steps\.1\.speedPercent needs floor: .*One more refusal on these points ends the task/);
        assert.equal(STUCK_AFTER, 3);
        assert.equal(refusalNote(null), "");
    });
});
