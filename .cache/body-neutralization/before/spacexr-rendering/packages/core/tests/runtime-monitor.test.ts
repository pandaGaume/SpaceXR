import { describe, expect, it } from "vitest";

import { formatBytes } from "../src";

describe("formatBytes", () => {
    it("formats tracked resource footprints without losing useful precision", () => {
        expect(formatBytes(0)).toBe("0 B");
        expect(formatBytes(512)).toBe("512 B");
        expect(formatBytes(1536)).toBe("1.5 KiB");
        expect(formatBytes(12 * 1024 * 1024)).toBe("12.0 MiB");
        expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("unbounded");
    });
});
