import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildShaders } from "../src";

describe("the shaders of the core package", () => {
    it("match their generated modules: run `npm run shaders` otherwise", () => {
        const report = buildShaders(fileURLToPath(new URL("../../core/src", import.meta.url)), { check: true });
        expect(report.unchanged.length).toBeGreaterThan(0);
        expect(report.changed).toEqual([]);
        expect(report.orphans).toEqual([]);
    });
});
