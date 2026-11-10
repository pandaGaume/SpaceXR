import type { ITensor } from "./compute.interfaces";

/** An opaque FP32 allocation. Transfers and lifetime are explicit. */
export interface ITensorStorage {
    readonly location: string;
    readonly dtype: "float32";
    readonly byteLength: number;
    read(): Promise<Float32Array>;
    dispose(): void | Promise<void>;
}

/** A device tensor never silently materializes a CPU view. */
export class DeviceTensor implements ITensor {
    public readonly shape: number[];
    public constructor(
        shape: readonly number[],
        public readonly storage: ITensorStorage,
        public name?: string
    ) {
        if (shape.some((d) => !Number.isSafeInteger(d) || d < 0)) throw new Error("Invalid device tensor shape");
        const count = shape.reduce((a, b) => a * b, 1);
        if (!Number.isSafeInteger(count) || count * 4 !== storage.byteLength) throw new Error("Device tensor storage size differs");
        this.shape = [...shape];
    }
    public get data(): Float32Array {
        throw new Error("Device tensor: use readTensor() or an explicit download node before CPU execution");
    }
}

/** Returns a separate CPU tensor; the original device allocation remains resident. */
export async function readTensor(tensor: ITensor): Promise<ITensor> {
    const data = tensor.storage ? await tensor.storage.read() : tensor.data.slice();
    return { data, shape: [...tensor.shape], name: tensor.name, unit: tensor.unit, quantization: tensor.quantization };
}
