import { IWeightInitializer, He } from "../nn.weights";
import { IConvKernel } from "./cnn.interfaces";

/// <summary>
/// A convolutional kernel (filter) holding shared weights.
/// Size = height × width × inputChannels.
/// Multiple synapses across spatial positions share these weights.
/// </summary>
export class ConvKernel implements IConvKernel {
    public readonly weights: number[];
    public bias: number;

    public constructor(
        public readonly height: number,
        public readonly width: number,
        public readonly inputChannels: number,
        initializer: IWeightInitializer = new He(height * width * inputChannels),
        biasInit: number = 0
    ) {
        const size = height * width * inputChannels;
        this.weights = new Array(size);
        for (let i = 0; i < size; i++) {
            this.weights[i] = initializer.next();
        }
        this.bias = biasInit;
    }

    public get size(): number {
        return this.weights.length;
    }
}
