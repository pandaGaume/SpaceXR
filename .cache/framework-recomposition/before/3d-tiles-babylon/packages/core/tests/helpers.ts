import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;

/** Builds a GLB containing only a JSON chunk. */
export function createGlb(document: unknown): ArrayBuffer {
    const encoded = new TextEncoder().encode(JSON.stringify(document));
    const paddedLength = Math.ceil(encoded.byteLength / 4) * 4;
    const buffer = new ArrayBuffer(20 + paddedLength);
    const view = new DataView(buffer);
    view.setUint32(0, GLB_MAGIC, true);
    view.setUint32(4, 2, true);
    view.setUint32(8, buffer.byteLength, true);
    view.setUint32(12, paddedLength, true);
    view.setUint32(16, GLB_JSON_CHUNK, true);
    const chunk = new Uint8Array(buffer, 20, paddedLength);
    chunk.fill(0x20);
    chunk.set(encoded);
    return buffer;
}

export function encodeJson(document: unknown): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(JSON.stringify(document));
}

export function createNullScene(): Scene {
    return new Scene(
        new NullEngine({ renderWidth: 800, renderHeight: 600, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 1 }),
    );
}
