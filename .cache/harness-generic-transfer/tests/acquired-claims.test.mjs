/**
 * The claims registry (harness/core/claims.ts, docs/registre-des-affirmations.fr.md): each claim with its source, its status and the
 * history of its status; an inference never becomes a fact because it is repeated, a contradicted claim never comes back as it stood.
 *
 *     node --test dist/tests/claims.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addClaim, claimJustified, claimLine, current, newClaims, transition } from "../dist/acquired/claims.js";
describe("the claims registry", () => {
    it("run 10 told again: the ventilation inferred, contradicted by the signed fact, replaced by the fact chosen; the prompt sees the last one only", () => {
        const state = newClaims();
        const inferred = addClaim(state, { subject: "flow between Lab and Hab-B, hatch closed", value: 1, unit: "m3/min", status: "INFERRED", source: { kind: "model", ref: "observer", step: 3 }, by: "observer" });
        assert.equal(transition(inferred, "CONTRADICTED", "habitat.interModuleVentilation.designFlow.hatchClosed = 3 m3/min, signed"), true);
        const fact = addClaim(state, { subject: "flow between Lab and Hab-B, hatch closed", value: 3, unit: "m3/min", status: "VERIFIED", source: { kind: "fact", ref: "habitat.interModuleVentilation.designFlow.hatchClosed", document: "station-topology", signed: true }, by: "observer" });
        assert.deepEqual(current(state).map((c) => c.id), [fact.id]);
        assert.deepEqual(inferred.history.map((h) => h.status), ["INFERRED", "CONTRADICTED"]);
        assert.equal(claimLine(fact), "flow between Lab and Hab-B, hatch closed: 3 m3/min [VERIFIED, fact habitat.interModuleVentilation.designFlow.hatchClosed (station-topology, signed)]");
        // Nothing leaves CONTRADICTED: the correction is another claim.
        assert.equal(transition(inferred, "VERIFIED", "said again"), false);
        assert.equal(inferred.status, "CONTRADICTED");
    });
    it("an inference said again stays an inference; only the harness, on a source with authority, makes a claim verified", () => {
        const state = newClaims();
        const a = addClaim(state, { subject: "assumption 1", text: "the Lab is well mixed", status: "INFERRED", source: { kind: "model", ref: "observer" }, by: "observer" });
        const again = addClaim(state, { subject: "assumption 1", text: "the Lab is well mixed", status: "INFERRED", source: { kind: "model", ref: "observer" }, by: "observer" });
        assert.equal(again, a);
        assert.equal(state.claims.length, 1);
        assert.equal(transition(a, "VERIFIED", "a reviewer agreed", undefined, "supervisor"), false, "a model never verifies");
        assert.equal(a.status, "INFERRED");
        // A fact cited twice is one claim; seen first from an unsigned copy, verified once its signed source is cited.
        const f = addClaim(state, { subject: "efficiency", value: 0.3, status: "OBSERVED", source: { kind: "fact", ref: "scrubber.singlePassEfficiency", signed: false }, by: "observer" });
        addClaim(state, { subject: "single-pass efficiency", value: 0.3, status: "VERIFIED", source: { kind: "fact", ref: "scrubber.singlePassEfficiency", signed: true }, by: "observer" });
        assert.equal(f.status, "VERIFIED");
        assert.equal(state.claims.length, 2);
    });
    it("an accepted procedure's numbers by their justifications: the harness's safety constant verified, a document's observed, an assumption inferred", () => {
        const state = newClaims();
        claimJustified(state, [
            { constant: "steps.1.speedPercent", value: 30, source: "library", reference: "test.speedFloorPercent", reason: "at or above it: test.speedFloorPercent = 30 percent, signed by reviewer", by: "harness" },
            { constant: "steps.1.minutes", value: 15, source: "library", reference: "method-concentration-decay", reason: "the card's step", by: "model" },
            { constant: "steps.2.minutes", value: 20, source: "assumed", reference: "long enough to see the decay", reason: "no document gives it", by: "model" },
        ], "procedure", 7);
        assert.deepEqual(state.claims.map((c) => [c.subject, c.status, c.by]), [
            ["steps.1.speedPercent", "VERIFIED", "harness"],
            ["steps.1.minutes (method-concentration-decay)", "OBSERVED", "procedure"],
            ["steps.2.minutes", "INFERRED", "procedure"],
        ]);
        assert.equal(state.claims[0].source.step, 7);
    });
});
