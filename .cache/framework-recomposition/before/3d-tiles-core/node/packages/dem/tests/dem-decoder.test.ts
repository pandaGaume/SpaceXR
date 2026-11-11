import type { IImageDecoder } from "@spacexr/raster";
import { describe, expect, it } from "vitest";

import { LocalDemDecoder, WorkerDemDecoder, installDemDecoderWorker, type IDemWorkerEndpoint, type IDemWorkerScope } from "../src";

/** Image decoder returning one opaque Terrarium pixel per input byte, at height `byte` metres. */
const byteHeights: IImageDecoder = {
    decode: (bytes) =>
        Promise.resolve({
            width: bytes.length,
            height: 1,
            channels: 4,
            data: new Uint8ClampedArray([...bytes].flatMap((value) => [128, value, 0, 255])),
        }),
};

const failing: IImageDecoder = { decode: () => Promise.reject(new Error("corrupt PNG")) };

/** Creates a worker emulated by a MessageChannel, running installDemDecoderWorker on the other port. */
function channelWorker(imageDecoder: IImageDecoder): IDemWorkerEndpoint {
    const channel = new MessageChannel();
    installDemDecoderWorker(channel.port1 as unknown as IDemWorkerScope, new LocalDemDecoder(imageDecoder));
    return channel.port2 as unknown as IDemWorkerEndpoint;
}

describe("WorkerDemDecoder", () => {
    it("decodes in the worker and transfers the bytes without copying them", async () => {
        const decoder = new WorkerDemDecoder(channelWorker(byteHeights));
        const bytes = new Uint8Array([3, 1, 2]);
        const pending = decoder.decodeDem(bytes, "terrarium");
        expect(bytes.byteLength).toBe(0);
        const grid = await pending;
        expect([...grid.data]).toEqual([3, 1, 2]);
        expect(grid).toMatchObject({ width: 3, height: 1, minimum: 1, maximum: 3 });
        expect(decoder.pendingCount).toBe(0);
        decoder.terminate();
    });

    it("copies views that do not cover their whole buffer before transferring", async () => {
        const decoder = new WorkerDemDecoder(channelWorker(byteHeights));
        const buffer = new Uint8Array([9, 4, 5, 9]);
        const grid = await decoder.decodeDem(buffer.subarray(1, 3), "terrarium");
        expect([...grid.data]).toEqual([4, 5]);
        expect(buffer.byteLength).toBe(4);
        decoder.terminate();
    });

    it("reports worker decoding errors", async () => {
        const decoder = new WorkerDemDecoder(channelWorker(failing));
        await expect(decoder.decodeDem(new Uint8Array([1]), "terrarium")).rejects.toThrow("corrupt PNG");
        decoder.terminate();
    });

    it("settles aborted requests immediately", async () => {
        const decoder = new WorkerDemDecoder(channelWorker(byteHeights));
        const controller = new AbortController();
        const pending = decoder.decodeDem(new Uint8Array([1]), "terrarium", { signal: controller.signal });
        controller.abort(new Error("tile left the view"));
        await expect(pending).rejects.toThrow("tile left the view");
        expect(decoder.pendingCount).toBe(0);
        await expect(decoder.decodeDem(new Uint8Array([1]), "terrarium", { signal: controller.signal })).rejects.toThrow("tile left the view");
        decoder.terminate();
    });

    it("sends each request to the least busy worker", () => {
        const posted: number[] = [];
        const endpoint = (index: number): IDemWorkerEndpoint => ({
            postMessage: () => posted.push(index),
            addEventListener: () => undefined,
        });
        const decoder = new WorkerDemDecoder([endpoint(0), endpoint(1), endpoint(2)]);
        for (let request = 0; request < 6; request++) void decoder.decodeDem(new Uint8Array([request]), "terrarium").catch(() => undefined);
        expect(posted).toEqual([0, 1, 2, 0, 1, 2]);
        expect(decoder.pendingCount).toBe(6);
        decoder.terminate();
        expect(decoder.pendingCount).toBe(0);
    });

    it("requires at least one worker", () => {
        expect(() => new WorkerDemDecoder([])).toThrow(RangeError);
    });
});
