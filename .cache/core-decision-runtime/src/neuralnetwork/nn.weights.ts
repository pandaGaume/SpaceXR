/// <summary>
/// WeightInit provides commonly used weight initialization strategies for neural networks.
/// These initializers are not specific to MLPs and are widely used in various types of neural architectures
/// including CNNs, RNNs, Transformers, and others, especially in deep learning.
/// </summary>
export class WeightInit {
    /// <summary>
    /// Glorot/Xavier initialization.
    /// Typically used with tanh or sigmoid activations.
    /// Scales weights to keep variance roughly equal across layers.
    /// </summary>
    static Glorot(fanIn: number, fanOut: number): number {
        const limit = Math.sqrt(6 / (fanIn + fanOut));
        return (Math.random() * 2 - 1) * limit;
    }

    /// <summary>
    /// He initialization.
    /// Typically used with ReLU and its variants.
    /// Helps prevent vanishing gradients in deep networks.
    /// </summary>
    static He(fanIn: number): number {
        const limit = Math.sqrt(6 / fanIn);
        return (Math.random() * 2 - 1) * limit;
    }

    /// <summary>
    /// Gaussian initialization using the Box-Muller transform.
    /// Can be used as a general-purpose initializer.
    /// </summary>
    static Normal(mean = 0, stdDev = 1): number {
        const u = 1 - Math.random();
        const v = 1 - Math.random();
        return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    /// <summary>
    /// Uniform initialization between min and max values.
    /// </summary>
    static Uniform(min = -1, max = 1): number {
        return Math.random() * (max - min) + min;
    }
}

export enum WeightInitializerType {
    /// <summary>
    /// Glorot/Xavier initializer, typically used with tanh or sigmoid activations.
    /// </summary>
    Glorot = "glorot",

    /// <summary>
    /// He initializer, typically used with ReLU-like activations.
    /// </summary>
    He = "he",

    /// <summary>
    /// Normal (Gaussian) initializer using the Box-Muller transform.
    /// </summary>
    Normal = "normal",

    /// <summary>
    /// Uniform initializer between min and max values.
    /// </summary>
    Uniform = "uniform",
}

/// <summary>
/// Interface for weight initialization strategies.
/// </summary>
export interface IWeightInitializer {
    type: WeightInitializerType;
    next(): number;
}

/// <summary>
/// Glorot/Xavier initializer class for use in builder chains.
/// </summary>
export class Glorot implements IWeightInitializer {
    private limit: number;

    public constructor(fanIn: number, fanOut: number) {
        this.limit = Math.sqrt(6 / (fanIn + fanOut));
    }

    public get type(): WeightInitializerType {
        return WeightInitializerType.Glorot;
    }

    public next(): number {
        return (Math.random() * 2 - 1) * this.limit;
    }
}

/// <summary>
/// He initializer class, typically used with ReLU-like activations.
/// </summary>
export class He implements IWeightInitializer {
    private limit: number;

    public constructor(fanIn: number) {
        this.limit = Math.sqrt(6 / fanIn);
    }
    public get type(): WeightInitializerType {
        return WeightInitializerType.He;
    }

    public next(): number {
        return (Math.random() * 2 - 1) * this.limit;
    }
}

/// <summary>
/// Normal (Gaussian) initializer using the Box-Muller transform.
/// </summary>
export class Normal implements IWeightInitializer {
    public constructor(
        private mean = 0,
        private stdDev = 1
    ) {}

    public get type(): WeightInitializerType {
        return WeightInitializerType.Normal;
    }

    public next(): number {
        const u = 1 - Math.random();
        const v = 1 - Math.random();
        return this.mean + this.stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
}

/// <summary>
/// Uniform initializer between min and max.
/// </summary>
export class Uniform implements IWeightInitializer {
    public constructor(
        private min = -1,
        private max = 1
    ) {}

    public get type(): WeightInitializerType {
        return WeightInitializerType.Uniform;
    }

    public next(): number {
        return Math.random() * (this.max - this.min) + this.min;
    }
}
