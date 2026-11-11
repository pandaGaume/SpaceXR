import { describe, expect, it } from "vitest";

import { GpuTerrainEngine } from "../src";

interface IEngineState {
    dirty: boolean;
    present(context: unknown): void;
    hide(context: unknown): void;
    release(context: unknown): void;
}

/** The part of the engine that decides on a rebuild, without a graphics context. */
function engineState(): IEngineState {
    const engine = Object.create(GpuTerrainEngine.prototype) as IEngineState;
    return Object.assign(engine, {
        dirty: false,
        presented: new Map(),
        handles: new Set(),
        released: 0,
        elevation: undefined,
        pickSurface: { refresh: () => undefined },
    });
}

function tile(x: number): { resources: { handle: { identity: object; presented: boolean } }[] } {
    return { resources: [{ handle: { identity: { lod: 3, x, y: 0 }, presented: false } }] };
}

describe("GpuTerrainEngine rebuilds", () => {
    it("rebuilds for a tile that appears, not for one already presented", () => {
        const engine = engineState();
        const context = tile(1);
        engine.present(context);
        expect(engine.dirty).toBe(true);
        engine.dirty = false;
        engine.present(context);
        expect(engine.dirty).toBe(false);
    });

    it("rebuilds for a tile that goes away, not for one already hidden", () => {
        const engine = engineState();
        const context = tile(1);
        engine.present(context);
        engine.dirty = false;
        engine.hide(context);
        expect(engine.dirty).toBe(true);
        engine.dirty = false;
        engine.hide(context);
        expect(engine.dirty).toBe(false);
    });

    it("rebuilds when a presented tile is released, not when the cache releases a hidden one", () => {
        const engine = engineState();
        const presented = tile(1);
        engine.present(presented);
        engine.dirty = false;
        engine.release(presented);
        expect(engine.dirty).toBe(true);
        engine.dirty = false;
        engine.release(tile(2));
        expect(engine.dirty).toBe(false);
    });
});
