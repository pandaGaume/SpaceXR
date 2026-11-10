// ═══════════════════════════════════════════════════════════════════════════
// FFT — Cooley-Tukey radix-2 (ported from Guillaume Pelletier's dsp.js / FFTPanel)
//
// Pure, dependency-free DSP primitive. It lives in `core` (not in the onnx
// plugin where it used to be buried) so that BOTH the onnx DSP kernels and the
// spectral neural-network family can consume a single implementation. `core`
// depends on nothing above it, which is exactly why the reusable brick belongs
// here: onnx and the plugins can import it, never the other way around.
//
// Complex layout convention (shared with the onnx SpFFT/SpIFFT kernels):
//   a half-spectrum is stored as INTERLEAVED real/imag pairs
//   [re_0, im_0, re_1, im_1, ..., re_{N/2}, im_{N/2}], length 2·(N/2 + 1).
// ═══════════════════════════════════════════════════════════════════════════

export class FFTEngine {
    readonly size: number;
    private reverseTable: Uint32Array;
    private sinTable: Float64Array;
    private cosTable: Float64Array;
    private real: Float64Array;
    private imag: Float64Array;

    constructor(size: number) {
        this.size = size;
        this.reverseTable = new Uint32Array(size);
        this.sinTable = new Float64Array(size);
        this.cosTable = new Float64Array(size);
        this.real = new Float64Array(size);
        this.imag = new Float64Array(size);

        // Build bit-reversal table
        let limit = 1;
        let bit = size >> 1;
        while (limit < size) {
            for (let i = 0; i < limit; i++) {
                this.reverseTable[i + limit] = this.reverseTable[i] + bit;
            }
            limit <<= 1;
            bit >>= 1;
        }

        // Pre-compute twiddle factors
        for (let i = 0; i < size; i++) {
            this.sinTable[i] = Math.sin(-Math.PI / i);
            this.cosTable[i] = Math.cos(-Math.PI / i);
        }
    }

    /**
     * Forward FFT. Returns power spectrum [size/2 + 1].
     */
    forward(buffer: Float32Array): Float32Array {
        this._loadReal(buffer);
        this._butterfly();
        const nBins = this.size / 2 + 1;
        const power = new Float32Array(nBins);
        for (let i = 0; i < nBins; i++) {
            power[i] = this.real[i] * this.real[i] + this.imag[i] * this.imag[i];
        }
        return power;
    }

    /**
     * Forward FFT. Returns the unique half of the spectrum as interleaved
     * real/imag pairs: [re_0, im_0, re_1, im_1, ..., re_{N/2}, im_{N/2}].
     * Length = 2 * (N/2 + 1).
     */
    forwardComplex(buffer: Float32Array): Float32Array {
        this._loadReal(buffer);
        this._butterfly();
        const nBins = this.size / 2 + 1;
        const out = new Float32Array(nBins * 2);
        for (let i = 0; i < nBins; i++) {
            out[i * 2] = this.real[i];
            out[i * 2 + 1] = this.imag[i];
        }
        return out;
    }

    /**
     * Inverse FFT from a Hermitian half-spectrum [re_0, im_0, ..., re_{N/2}, im_{N/2}]
     * back to an N-sample real-valued time-domain signal. Uses the conjugate
     * trick: ifft(X) = conj(fft(conj(X))) / N.
     */
    inverse(complexHalf: Float32Array): Float32Array {
        const N = this.size;
        const half = N >> 1;
        const reverseTable = this.reverseTable;
        const real = this.real;
        const imag = this.imag;

        // Expand the half-spectrum into a temporary full spectrum
        // (DC and Nyquist are real, every other bin mirrors as conjugate).
        const fullReal = new Float64Array(N);
        const fullImag = new Float64Array(N);
        fullReal[0] = complexHalf[0];
        fullReal[half] = complexHalf[half * 2];
        for (let k = 1; k < half; k++) {
            const re = complexHalf[k * 2];
            const im = complexHalf[k * 2 + 1];
            fullReal[k] = re;
            fullImag[k] = im;
            fullReal[N - k] = re;
            fullImag[N - k] = -im;
        }

        // Conjugate (IFFT trick) and bit-reverse permute in one pass.
        for (let i = 0; i < N; i++) {
            const j = reverseTable[i];
            real[i] = fullReal[j];
            imag[i] = -fullImag[j];
        }

        this._butterfly();

        const out = new Float32Array(N);
        const invN = 1 / N;
        for (let i = 0; i < N; i++) out[i] = real[i] * invN;
        return out;
    }

    private _loadReal(buffer: Float32Array): void {
        const N = this.size;
        const reverseTable = this.reverseTable;
        const real = this.real;
        const imag = this.imag;
        for (let i = 0; i < N; i++) {
            real[i] = buffer[reverseTable[i]] ?? 0;
            imag[i] = 0;
        }
    }

    private _butterfly(): void {
        const N = this.size;
        const real = this.real;
        const imag = this.imag;
        const cosTable = this.cosTable;
        const sinTable = this.sinTable;

        let halfSize = 1;
        while (halfSize < N) {
            const phaseShiftStepReal = cosTable[halfSize];
            const phaseShiftStepImag = sinTable[halfSize];
            let currentPhaseShiftReal = 1;
            let currentPhaseShiftImag = 0;

            for (let fftStep = 0; fftStep < halfSize; fftStep++) {
                let i = fftStep;
                while (i < N) {
                    const off = i + halfSize;
                    const tr = currentPhaseShiftReal * real[off] - currentPhaseShiftImag * imag[off];
                    const ti = currentPhaseShiftReal * imag[off] + currentPhaseShiftImag * real[off];
                    real[off] = real[i] - tr;
                    imag[off] = imag[i] - ti;
                    real[i] += tr;
                    imag[i] += ti;
                    i += halfSize << 1;
                }
                const tmpReal = currentPhaseShiftReal;
                currentPhaseShiftReal = tmpReal * phaseShiftStepReal - currentPhaseShiftImag * phaseShiftStepImag;
                currentPhaseShiftImag = tmpReal * phaseShiftStepImag + currentPhaseShiftImag * phaseShiftStepReal;
            }
            halfSize <<= 1;
        }
    }
}

// FFT engine cache (avoid re-creating per frame). Keyed by transform size;
// each engine reuses its internal buffers, so calls must not be interleaved
// re-entrantly for the same size (single-threaded JS makes sequential calls
// safe, which is all any consumer does).
const fftEngines = new Map<number, FFTEngine>();
export function getFFTEngine(size: number): FFTEngine {
    let engine = fftEngines.get(size);
    if (!engine) {
        engine = new FFTEngine(size);
        fftEngines.set(size, engine);
    }
    return engine;
}
