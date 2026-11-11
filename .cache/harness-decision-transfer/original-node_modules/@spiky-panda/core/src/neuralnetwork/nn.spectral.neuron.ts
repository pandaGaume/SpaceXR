import { ICartesian } from "../geometry";
import { cloneable, IOlink } from "../graph";
import { Nullable } from "../types";
import { Neuron } from "./nn.neuron";
import { ISpectralNeuron, ISpectralNeuronContext } from "./nn.spectral.interfaces";

/**
 * A spectral neuron. Structural (like every `Neuron`): it carries only the
 * discretization it uses to read its spectral inputs — the FFT size, the
 * sample rate (which maps a carrier frequency to an FFT bin), and the band
 * half-width in bins. The forward pass lives in `SpectralInferenceRuntime`;
 * this node performs no computation on its own.
 *
 * A future per-neuron NON-LINEARITY belongs here: a non-linearity is what
 * manufactures harmonics and intermodulation (Decision 001, H7). It is
 * deliberately absent at this milestone, so the substrate stays strictly
 * linear (the demos it replays are linear).
 *
 * Mirrors `MlpNeuron` (plain `@cloneable` fields, all-optional constructor so
 * `GraphItem.clone()`'s `new ctor()` works); `Neuron` is left untouched.
 */
export class SpectralNeuron<B extends ISpectralNeuronContext = ISpectralNeuronContext> extends Neuron<B> implements ISpectralNeuron<B> {
    @cloneable public nfft: number = 256;
    @cloneable public sampleRate: number = 1024;
    @cloneable public bandHalfWidthBins: number = 1;

    public constructor(
        nfft: number = 256,
        sampleRate: number = 1024,
        bandHalfWidthBins: number = 1,
        onsc: Nullable<IOlink[]> = null,
        opsc: Nullable<IOlink[]> = null,
        position?: ICartesian
    ) {
        super(onsc, opsc, position);
        this.nfft = nfft;
        this.sampleRate = sampleRate;
        this.bandHalfWidthBins = bandHalfWidthBins;
    }
}
