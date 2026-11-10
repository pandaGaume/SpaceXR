import { cloneable, GraphOLink, INode } from "../graph";
import { ISpectralSynapse } from "./nn.spectral.interfaces";

/**
 * A spectral edge whose weight is a COMPLEX per-band transfer function
 * `w_b = gain[b]·e^{i·phase[b]}` (gain AND dephasing), optionally with a
 * complex cross-band `coupling` term. This is the spectral generalization of
 * `Synapse` (a single real scalar `weight`): the real case is `phase[b] = 0`.
 *
 * Differentiability (prepared for later milestones, not trained here): the
 * forward pass is superposition (addition) + complex filtering (per-bin
 * multiply by `w_b`) + coupling (multiply). All three are differentiable — in
 * the complex domain via Wirtinger calculus, or by treating each complex
 * number as two reals (re, im) and backpropagating through the FFT, exactly as
 * the Fourier Neural Operator does with per-mode complex weights. `gain` and
 * `phase` (or `coupling.re`/`coupling.im`) are the natural learnable leaves.
 *
 * Mirrors `nn.synapse.ts` (relative imports, `@cloneable`, generic `<B>`);
 * `Synapse` is left untouched. The constructor takes all parameters as
 * optional so that `GraphItem.clone()` (which calls `new ctor()` with no
 * arguments before copying the `@cloneable` fields) works.
 */
export class SpectralSynapse<B = unknown> extends GraphOLink<B> implements ISpectralSynapse<B> {
    @cloneable public bands: ReadonlyArray<number>;
    @cloneable public gain: number[];
    @cloneable public phase: number[];
    @cloneable public coupling?: { re: number; im: number }[][];

    public constructor(oini?: INode, ofin?: INode, bands: ReadonlyArray<number> = [], gain?: number[], phase?: number[], coupling?: { re: number; im: number }[][]) {
        super(oini, ofin);
        this.bands = bands;
        // Default gain = 1 (pass-through) and phase = 0 (real case), so a
        // freshly-cloned or default-constructed synapse is the identity edge.
        this.gain = gain ?? bands.map(() => 1);
        this.phase = phase ?? bands.map(() => 0);
        this.coupling = coupling;
    }
}
