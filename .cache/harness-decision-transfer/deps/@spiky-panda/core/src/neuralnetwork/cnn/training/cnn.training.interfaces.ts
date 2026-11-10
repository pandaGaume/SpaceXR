import { ICnnInferenceContext, IConvKernel } from "../cnn.interfaces";

/// <summary>
/// Extends inference context with backpropagation fields for CNN neurons.
/// </summary>
export interface ICnnBackpropNeuronContext extends ICnnInferenceContext {
    error?: number;
    gradient?: number;
}

/// <summary>
/// Proxy that makes a single kernel weight look like a synapse to the optimizer.
/// Delegates .weight to kernel.weights[index] and holds its own .bag for optimizer state.
/// </summary>
export class KernelWeightSlot {
    public bag: unknown;

    public constructor(
        private readonly kernel: IConvKernel,
        private readonly index: number
    ) {}

    public get weight(): number {
        return this.kernel.weights[this.index];
    }

    public set weight(value: number) {
        this.kernel.weights[this.index] = value;
    }
}

/// <summary>
/// Proxy that makes a kernel bias look like a synapse weight to the optimizer.
/// </summary>
export class KernelBiasSlot {
    public bag: unknown;

    public constructor(private readonly kernel: IConvKernel) {}

    public get weight(): number {
        return this.kernel.bias;
    }

    public set weight(value: number) {
        this.kernel.bias = value;
    }
}
