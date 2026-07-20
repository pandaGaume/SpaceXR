import { ActionQueueStatus, ConcurrentActionQueue } from "../src/collections/concurrentQueue";
import { SourceBlock } from "../src/tiles/pipeline/tiles.pipeline.sourceblock";
import { ITargetBlock } from "../src/tiles/pipeline/tiles.pipeline.interfaces";
import { SphereType } from "../src/tiles/3d/interfaces";
import { IsTileSphereBeyondHorizon } from "../src/tiles/3d/interfaces/math/math";

const EARTH_R = 6378137;

function target(name: string): ITargetBlock<number> {
    return { name, added: () => {}, removed: () => {}, updated: () => {} } as unknown as ITargetBlock<number>;
}

describe("ConcurrentActionQueue.cancelPending", () => {
    it("prevents a cancelled item from ever running", async () => {
        const started: number[] = [];
        let release: (() => void) | null = null;
        const blocker = new Promise<void>((r) => (release = r));

        // concurrency 1: the second item stays queued behind the first.
        const queue = new ConcurrentActionQueue<number, number>(async (data) => {
            started.push(data);
            if (data === 1) await blocker;
            return data;
        }, 1);

        queue.enqueue(1).catch(() => {});
        queue.enqueue(2).catch(() => {});
        expect(started).toEqual([1]);

        expect(queue.cancelPending(2)).toBe(true);
        release!();
        await new Promise((r) => setTimeout(r, 10));

        expect(started).toEqual([1]);
    });

    it("reports a single cancelled settle event and no later fulfilment", async () => {
        const events: ActionQueueStatus[] = [];
        let release: (() => void) | null = null;
        const blocker = new Promise<void>((r) => (release = r));
        const queue = new ConcurrentActionQueue<number, number>(async (d) => {
            if (d === 1) await blocker;
            return d;
        }, 1);

        queue.enqueue(1).catch(() => {});
        queue.enqueue(2, { onSettled: (e) => events.push(e.status) }).catch(() => {});
        queue.cancelPending(2);
        release!();
        await new Promise((r) => setTimeout(r, 10));

        expect(events).toEqual([ActionQueueStatus.cancelled]);
    });
});

describe("SourceBlock.unlinkFrom", () => {
    it("removes only the requested link and keeps later ones connected", () => {
        const source = new SourceBlock<number>();
        const a = target("a");
        const b = target("b");
        const c = target("c");
        source.linkTo(a);
        source.linkTo(b);
        source.linkTo(c);
        expect(source.links?.length).toBe(3);

        source.unlinkFrom(a);

        expect(source.links?.length).toBe(2);
        expect(source.links?.map((l) => l.target)).toEqual([b, c]);
    });
});

describe("IsTileSphereBeyondHorizon", () => {
    const camera = { x: 0, y: 0, z: 3 * EARTH_R, toString: () => "" };

    it("never culls a sphere enclosing the planet center (global tileset root)", () => {
        // Region-derived global roots have a small non-zero center offset and a
        // radius far larger than it. With the center slightly on the far side,
        // the angular radius saturates at PI/2 instead of PI and the sphere
        // reads as fully occluded, blanking the whole tileset.
        const globalRoot: SphereType = [0, 0, -1000, EARTH_R * 1.1];
        expect(IsTileSphereBeyondHorizon(globalRoot, camera, EARTH_R)).toBe(false);
    });

    it("never culls a sphere containing the camera", () => {
        const around: SphereType = [0, 0, 3 * EARTH_R - 100, 5000];
        expect(IsTileSphereBeyondHorizon(around, camera, EARTH_R)).toBe(false);
    });

    it("still culls a small tile on the far side of the planet", () => {
        const farSide: SphereType = [0, 0, -EARTH_R, 1000];
        expect(IsTileSphereBeyondHorizon(farSide, camera, EARTH_R)).toBe(true);
    });

    it("keeps a small tile directly under the camera", () => {
        const nearSide: SphereType = [0, 0, EARTH_R, 1000];
        expect(IsTileSphereBeyondHorizon(nearSide, camera, EARTH_R)).toBe(false);
    });
});
