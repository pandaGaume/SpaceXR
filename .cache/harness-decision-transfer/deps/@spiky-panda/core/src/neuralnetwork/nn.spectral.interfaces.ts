import { IGraph, INode, IOlink } from "../graph";
import { INeuron } from "./nn.interfaces";

/**
 * Spectral synapse (edge). Its "weight" is not a scalar but a COMPLEX
 * per-band transfer function `w_b = gain[b]·e^{i·phase[b]}` applied to the
 * presynaptic signal, band by band, in the frequency domain (Decision 001:
 * complex latents, phase carries routing / spike timing).
 *
 * `bands` are carrier frequencies in Hz (an INHARMONIC grid — see
 * `assertInharmonic`). `gain`/`phase` are same-length as `bands`. The real
 * case (scalar gain, no dephasing) is simply `phase[b] = 0`.
 *
 * `coupling` is an optional COMPLEX cross-band term: `coupling[b][j]` is the
 * influence of band `j` on band `b`, so the transferred bin `b` becomes
 * `w_b·X[b] + Σ_j coupling[b][j]·X[j]`. Multiplying two complex numbers
 * rotates phases, so coupling is more than a rescale (Decision 001, H4).
 */
export interface ISpectralSynapse<B = unknown> extends IOlink<B> {
    /** Carrier frequencies f_b (Hz), inharmonic grid. */
    bands: ReadonlyArray<number>;
    /** Per-band gain g_b >= 0, same length as `bands`. */
    gain: number[];
    /** Per-band phase φ_b (radians), same length as `bands`. */
    phase: number[];
    /** Optional complex cross-band coupling: coupling[b][j] = influence of j on b. */
    coupling?: { re: number; im: number }[][];
}

/**
 * Spectral neuron (node). Structural, like every `Neuron` in this codebase:
 * it carries the discretization parameters used to read its spectral inputs
 * (FFT size, sample rate, per-band half-width in bins) but performs no work
 * itself — the forward pass lives in `SpectralInferenceRuntime`.
 *
 * A future per-neuron NON-LINEARITY would live here: a non-linearity is what
 * manufactures harmonics (Decision 001, H7). Absent at this milestone, so the
 * substrate is strictly linear.
 */
export interface ISpectralNeuron<B = unknown> extends INeuron<B> {
    /** FFT size used to transform this neuron's incoming signals. */
    nfft: number;
    /** Sample rate (Hz), maps a band frequency to an FFT bin: bin = round(f·nfft/fs). */
    sampleRate: number;
    /** Half-width (in bins) of the band-pass window around each carrier bin. */
    bandHalfWidthBins: number;
}

/**
 * Per-inference state stashed on `neuron.bag` during a forward pass:
 * `acc` accumulates the spectrally-filtered contributions of the incoming
 * synapses; `signal` is the finalized output frame; `remainingInputs` is the
 * fan-in counter driven by `readyQueueDispatch`.
 */
export interface ISpectralNeuronContext {
    acc: Float32Array;
    signal: Float32Array;
    remainingInputs: number;
    totalInputs: number;
}

/** A spectral network: neurons + spectral synapses. */
export interface ISpectralGraph extends IGraph<ISpectralNeuron, ISpectralSynapse> {}

/** Duck-typed guard for an ISpectralSynapse (bands/gain/phase arrays). */
export function isSpectralSynapse(obj: unknown): obj is ISpectralSynapse {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const c = obj as Partial<ISpectralSynapse>;
    return Array.isArray(c.bands) && Array.isArray(c.gain) && Array.isArray(c.phase);
}

/** Duck-typed guard for an ISpectralNeuron. */
export function isSpectralNeuron(obj: unknown): obj is ISpectralNeuron {
    if (typeof obj !== "object" || obj === null) {
        return false;
    }
    const c = obj as Partial<ISpectralNeuron> & Partial<INode>;
    return typeof c.nfft === "number" && typeof c.sampleRate === "number" && typeof c.onsc === "function";
}

/**
 * Design-time check for an INHARMONIC band grid (Decision 001): no carrier
 * may be an integer multiple, sum, or difference of the others, otherwise the
 * harmonics / intermodulation products of a non-linearity or of coupling fall
 * onto a band and pollute it. `tol` is the Hz tolerance for "falls onto".
 * Throws with a descriptive message on the first offending relation.
 */
export function assertInharmonic(bands: ReadonlyArray<number>, tol = 0.5): void {
    const n = bands.length;
    for (let b = 0; b < n; b++) {
        const fb = bands[b];
        // Harmonic: fb ≈ m·fi with integer m >= 2.
        for (let i = 0; i < n; i++) {
            if (i === b) {
                continue;
            }
            const fi = bands[i];
            if (fi <= 0) {
                continue;
            }
            const m = Math.round(fb / fi);
            if (m >= 2 && Math.abs(fb - m * fi) <= tol) {
                throw new Error(`assertInharmonic: band ${fb}Hz is ~${m}× band ${fi}Hz (harmonic); choose an inharmonic grid.`);
            }
        }
        // Intermodulation: fb ≈ fi + fj or fb ≈ |fi − fj| for a distinct pair.
        for (let i = 0; i < n; i++) {
            if (i === b) {
                continue;
            }
            for (let j = i + 1; j < n; j++) {
                if (j === b) {
                    continue;
                }
                const fi = bands[i];
                const fj = bands[j];
                if (Math.abs(fb - (fi + fj)) <= tol) {
                    throw new Error(`assertInharmonic: band ${fb}Hz ≈ ${fi}Hz + ${fj}Hz (sum intermodulation).`);
                }
                if (Math.abs(fb - Math.abs(fi - fj)) <= tol) {
                    throw new Error(`assertInharmonic: band ${fb}Hz ≈ |${fi}Hz − ${fj}Hz| (difference intermodulation).`);
                }
            }
        }
    }
}
