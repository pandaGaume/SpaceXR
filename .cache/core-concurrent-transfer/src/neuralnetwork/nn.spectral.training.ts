import { getFFTEngine } from "../dsp";
import { ISynapse } from "./nn.interfaces";
import { SpectralInferenceRuntime } from "./nn.spectral.inference";
import { ISpectralGraph, ISpectralNeuron, ISpectralNeuronContext, ISpectralSynapse } from "./nn.spectral.interfaces";
import { IBackpropSynapseContext, ILossFunction, IOptimizer, ITrainingContext } from "./nn.training";

/**
 * A single scalar parameter (one `gain[b]` or `phase[b]` slot of a
 * SpectralSynapse) exposed with the minimal `ISynapse` surface an optimizer
 * touches: a `weight` getter/setter (read/write the array slot) and its own
 * `bag` (Adam/momentum state). This lets the existing `Optimizers.*`
 * (`nn.optimizers.ts`) drive per-band spectral parameters unchanged — the
 * optimizer only ever does `target.weight += delta` and reads/writes `target.bag`.
 */
class ScalarParamHandle {
    public bag: IBackpropSynapseContext = {};
    public constructor(
        private readonly getter: () => number,
        private readonly setter: (v: number) => void
    ) {}
    public get weight(): number {
        return this.getter();
    }
    public set weight(v: number) {
        this.setter(v);
    }
}

/** Per-band gradients of the loss w.r.t. a synapse's `gain[b]` / `phase[b]`. */
export interface ISpectralSynapseGradients {
    dGain: number[];
    dPhase: number[];
}

/**
 * Training runtime for the spectral family, mirroring `MLPTrainingRuntime`.
 *
 * The learnable leaves are each synapse's per-band `gain[b]` and `phase[b]`.
 * The backward pass is EXACT and analytic: because `FFTEngine.inverse()` is
 * R-linear and the complex weight `w_b = gain_b·e^{i·phase_b}` enters the
 * forward linearly, the output decomposes as
 *
 *     y = Σ_b [ Re(w_b)·A_b + Im(w_b)·B_b ],   A_b = inverse(X_b), B_b = inverse(i·X_b)
 *
 * where `X_b` is the input half-spectrum restricted to band b's bins. Hence
 *
 *     dL/dRe = ⟨dL/dy, A_b⟩,   dL/dIm = ⟨dL/dy, B_b⟩
 *     dL/dgain_b  = dL/dRe·cosφ_b + dL/dIm·sinφ_b
 *     dL/dphase_b = gain_b·(dL/dIm·cosφ_b − dL/dRe·sinφ_b)
 *
 * No Hermitian adjoint is hand-derived: `A_b`/`B_b` reuse the very `inverse()`
 * of the forward, so the gradient is adjoint-consistent by construction (this
 * is the Fourier-Neural-Operator style of backprop through the FFT with complex
 * weights; Wirtinger, or each complex treated as two reals). This is where
 * H3's testable prediction — "the gradient traverses encode → sum → filter →
 * decode" — is realized.
 *
 * Scope: SINGLE spectral layer (the output neuron's incoming synapses come
 * from input neurons; multi-synapse fan-in is summed, which IS supported).
 * Multi-layer backprop and coupling gradients are left for later milestones.
 */
export class SpectralTrainingRuntime {
    private context: ITrainingContext = { iteration: 0 };
    private readonly handles: Map<ISpectralSynapse, { gain: ScalarParamHandle[]; phase: ScalarParamHandle[] }> = new Map();

    public constructor(
        public readonly graph: ISpectralGraph,
        public readonly runtime: SpectralInferenceRuntime,
        public readonly lossFn: ILossFunction,
        public readonly learningRate: number,
        public readonly optimizer: IOptimizer
    ) {
        for (const syn of graph.links) {
            const gain = syn.gain.map(
                (_, b) =>
                    new ScalarParamHandle(
                        () => syn.gain[b],
                        (v) => (syn.gain[b] = v)
                    )
            );
            const phase = syn.phase.map(
                (_, b) =>
                    new ScalarParamHandle(
                        () => syn.phase[b],
                        (v) => (syn.phase[b] = v)
                    )
            );
            this.handles.set(syn, { gain, phase });
        }
    }

    /**
     * Forward + analytic backward. Returns the scalar loss and the per-band
     * gradients for every synapse feeding the output neuron. Does NOT update
     * parameters (so callers can chain the gradients onto their own leaves —
     * e.g. an affine context→phase map in H3).
     */
    public backward(inputFrame: number[] | Float32Array, expected: number[] | Float32Array): { loss: number; grads: Map<ISpectralSynapse, ISpectralSynapseGradients> } {
        const y = this.runtime.run(inputFrame);
        const n = y.length;

        // dL/dy and the scalar loss, sample by sample (MSE-style scalar loss).
        const dLdy = new Float32Array(n);
        let loss = 0;
        for (let i = 0; i < n; i++) {
            const t = i < expected.length ? expected[i] : 0;
            loss += this.lossFn.loss(y[i], t);
            dLdy[i] = this.lossFn.dLoss(y[i], t);
        }

        const grads = new Map<ISpectralSynapse, ISpectralSynapseGradients>();
        const out = this.graph.outputs[0];
        for (const syn of out.opsc<ISpectralSynapse>()) {
            const src = syn.oini as ISpectralNeuron;
            const x = (src.bag as ISpectralNeuronContext).signal;
            grads.set(syn, this._synapseGradients(syn, x, dLdy, out.nfft, out.sampleRate, out.bandHalfWidthBins));
        }
        return { loss, grads };
    }

    /** One forward + backward + optimizer step. Returns the loss. */
    public trainStep(inputFrame: number[] | Float32Array, expected: number[] | Float32Array): number {
        const { loss, grads } = this.backward(inputFrame, expected);
        for (const [syn, g] of grads) {
            const h = this.handles.get(syn);
            if (!h) continue;
            for (let b = 0; b < g.dGain.length; b++) {
                this._apply(h.gain[b], g.dGain[b]);
                this._apply(h.phase[b], g.dPhase[b]);
            }
        }
        this.context.iteration++;
        return loss;
    }

    public get trainingContext(): Readonly<ITrainingContext> {
        return this.context;
    }

    public deleteContext(): void {
        this.runtime.deleteContext();
        for (const h of this.handles.values()) {
            for (const p of h.gain) p.bag = {};
            for (const p of h.phase) p.bag = {};
        }
    }

    private _apply(handle: ScalarParamHandle, gradient: number): void {
        handle.bag.gradient = gradient;
        this.optimizer.apply(handle as unknown as ISynapse, this.learningRate, gradient, this.context);
    }

    /** Analytic per-band gradients for one synapse (see class doc). */
    private _synapseGradients(syn: ISpectralSynapse, x: Float32Array, dLdy: Float32Array, nfft: number, sampleRate: number, halfWidth: number): ISpectralSynapseGradients {
        const engine = getFFTEngine(nfft);
        const X = engine.forwardComplex(x); // interleaved half-spectrum of the presynaptic signal
        const nBins = nfft / 2 + 1;
        const centers = syn.bands.map((f) => Math.round((f * nfft) / sampleRate));

        const dGain: number[] = new Array(syn.bands.length).fill(0);
        const dPhase: number[] = new Array(syn.bands.length).fill(0);

        for (let b = 0; b < centers.length; b++) {
            const cb = centers[b];
            // X_b (band-b bins only) and i·X_b, in the interleaved layout.
            const Xb = new Float32Array(X.length);
            const XbI = new Float32Array(X.length);
            for (let k = cb - halfWidth; k <= cb + halfWidth; k++) {
                if (k < 0 || k >= nBins) continue;
                const re = X[2 * k];
                const im = X[2 * k + 1];
                Xb[2 * k] = re;
                Xb[2 * k + 1] = im;
                XbI[2 * k] = -im; // i·(re + i·im) = -im + i·re
                XbI[2 * k + 1] = re;
            }
            const Ab = engine.inverse(Xb); // ∂y/∂Re(w_b)
            const Bb = engine.inverse(XbI); // ∂y/∂Im(w_b)

            let dRe = 0;
            let dIm = 0;
            const m = Math.min(dLdy.length, Ab.length);
            for (let i = 0; i < m; i++) {
                dRe += dLdy[i] * Ab[i];
                dIm += dLdy[i] * Bb[i];
            }

            const g = syn.gain[b] ?? 1;
            const ph = syn.phase[b] ?? 0;
            const cos = Math.cos(ph);
            const sin = Math.sin(ph);
            dGain[b] = dRe * cos + dIm * sin;
            dPhase[b] = g * (dIm * cos - dRe * sin);
        }

        return { dGain, dPhase };
    }
}
