import { getFFTEngine } from "../dsp";
import { readyQueueDispatch } from "../graph";
import { ISpectralGraph, ISpectralNeuron, ISpectralNeuronContext, ISpectralSynapse } from "./nn.spectral.interfaces";

/**
 * Spectral forward pass over a neuron/synapse topology.
 *
 * Analogue of `MLPInferenceRuntime`, but the neurons carry SIGNAL FRAMES
 * instead of scalars and the synapse "weight" is a complex per-band transfer:
 *
 *     y = Σ_synapses  IFFT( W ⊙ FFT(x_presyn) )
 *
 * where, per band `b`, `W[bin_b] = gain[b]·e^{i·phase[b]}` (a gain and a phase
 * rotation) plus the optional cross-band coupling, and every out-of-band bin
 * is zeroed (the band-pass filter bank that re-separates the superposed
 * sub-paths). Uses the shared `readyQueueDispatch` (fan-in counter + ready
 * FIFO) exactly like the MLP runtime; per-inference state lives on `neuron.bag`.
 *
 * Differentiability: FFT, the per-bin complex multiply, and coupling are all
 * differentiable (Wirtinger, or each complex as two reals through the FFT —
 * the Fourier Neural Operator precedent). No training happens here; this note
 * marks where a gradient on `gain`/`phase`/`coupling` would flow.
 */
export class SpectralInferenceRuntime {
    public constructor(public readonly graph: ISpectralGraph) {}

    /**
     * Runs the spectral forward pass. `inputFrame` is the time-domain signal
     * fed to the (single) input neuron; returns the output neuron's frame.
     * The canonical Étape A topology is one input → one output; multi-input
     * graphs are out of scope at this milestone.
     */
    public run(inputFrame: number[] | Float32Array): number[] {
        if (this.graph.inputs.length !== 1) {
            throw new Error(`SpectralInferenceRuntime: expected exactly 1 input neuron, got ${this.graph.inputs.length}.`);
        }

        // Reset per-inference context (frame accumulators + fan-in counter).
        for (const neuron of this.graph.nodes) {
            resetSpectralContext(neuron);
        }

        // Seed the input neuron with the composite frame. Its fan-in is 0, so
        // it is already "fired": we set its output signal directly and hand it
        // to the dispatcher as a seed (which does NOT re-fire seeds).
        const input = this.graph.inputs[0];
        const inCtx = input.bag as ISpectralNeuronContext;
        inCtx.signal = fitFrame(inputFrame, input.nfft);
        inCtx.remainingInputs = 0;

        readyQueueDispatch<ISpectralNeuron, ISpectralSynapse>(this.graph, {
            seed: [input],
            getCount: (n) => (n.bag as ISpectralNeuronContext).remainingInputs,
            setCount: (n, c) => {
                (n.bag as ISpectralNeuronContext).remainingInputs = c;
            },
            propagate: (source, target, syn) => {
                const src = source.bag as ISpectralNeuronContext;
                const tgt = target.bag as ISpectralNeuronContext;
                const contribution = applyTransfer(src.signal, syn, target.nfft, target.sampleRate, target.bandHalfWidthBins);
                addInPlace(tgt.acc, contribution);
            },
            fire: (n) => {
                // Finalize: the neuron's output frame is the sum of its
                // spectrally-filtered inputs. (A per-neuron non-linearity —
                // the harmonic source of H7 — would apply here later.)
                const ctx = n.bag as ISpectralNeuronContext;
                ctx.signal = ctx.acc;
            },
        });

        const out = this.graph.outputs[0].bag as ISpectralNeuronContext;
        return Array.from(out.signal);
    }

    /** Drop every neuron's per-inference bag (frees the frame buffers). */
    public deleteContext(): void {
        for (const neuron of this.graph.nodes) {
            neuron.bag = undefined;
        }
    }
}

/** (Re)initialize a neuron's spectral inference context on its `bag`. */
function resetSpectralContext(neuron: ISpectralNeuron): void {
    const fanIn = neuron.opsc<ISpectralSynapse>()?.length ?? 0;
    const n = neuron.nfft;
    const bag = neuron.bag as ISpectralNeuronContext | undefined;
    if (!bag || bag.acc.length !== n) {
        neuron.bag = { acc: new Float32Array(n), signal: new Float32Array(n), remainingInputs: fanIn, totalInputs: fanIn };
    } else {
        bag.acc.fill(0);
        bag.signal.fill(0);
        bag.remainingInputs = fanIn;
        bag.totalInputs = fanIn;
    }
}

/** Copy `frame` into a fresh Float32Array of length `n` (truncate / zero-pad). */
function fitFrame(frame: number[] | Float32Array, n: number): Float32Array {
    const out = new Float32Array(n);
    const len = Math.min(frame.length, n);
    for (let i = 0; i < len; i++) out[i] = frame[i];
    return out;
}

/** `dst += src` elementwise. */
function addInPlace(dst: Float32Array, src: Float32Array): void {
    const len = Math.min(dst.length, src.length);
    for (let i = 0; i < len; i++) dst[i] += src[i];
}

/**
 * The synapse transfer function: FFT the signal, apply the complex per-band
 * weight `w_b = gain[b]·e^{i·phase[b]}` (plus optional cross-band coupling) to
 * the bins within each band's half-width, zero every out-of-band bin, and
 * IFFT back to the time domain. `getFFTEngine` is the shared core/dsp brick.
 */
function applyTransfer(signal: Float32Array, syn: ISpectralSynapse, nfft: number, sampleRate: number, halfWidth: number): Float32Array {
    const engine = getFFTEngine(nfft);
    const X = engine.forwardComplex(signal); // interleaved [re,im] half-spectrum
    const nBins = nfft / 2 + 1;
    const Y = new Float32Array(X.length); // zeros = every out-of-band bin dropped

    const centers = syn.bands.map((f) => Math.round((f * nfft) / sampleRate));

    for (let b = 0; b < centers.length; b++) {
        const cb = centers[b];
        const g = syn.gain[b] ?? 1;
        const ph = syn.phase[b] ?? 0;
        const wre = g * Math.cos(ph);
        const wim = g * Math.sin(ph);

        // w_b · X over the band window (band-pass; windows of separated bands
        // do not overlap, `+=` just keeps overlap well-defined).
        for (let k = cb - halfWidth; k <= cb + halfWidth; k++) {
            if (k < 0 || k >= nBins) continue;
            const xre = X[2 * k];
            const xim = X[2 * k + 1];
            Y[2 * k] += wre * xre - wim * xim;
            Y[2 * k + 1] += wre * xim + wim * xre;
        }

        // Complex cross-band coupling: Σ_j coupling[b][j] · X[center_j], added
        // onto band b's center bin (rotates phases — Decision 001, H4).
        const row = syn.coupling?.[b];
        if (row) {
            let cre = 0;
            let cim = 0;
            for (let j = 0; j < centers.length; j++) {
                const c = row[j];
                if (!c) continue;
                const cj = centers[j];
                if (cj < 0 || cj >= nBins) continue;
                const xjre = X[2 * cj];
                const xjim = X[2 * cj + 1];
                cre += c.re * xjre - c.im * xjim;
                cim += c.re * xjim + c.im * xjre;
            }
            if (cb >= 0 && cb < nBins) {
                Y[2 * cb] += cre;
                Y[2 * cb + 1] += cim;
            }
        }
    }

    return engine.inverse(Y);
}
