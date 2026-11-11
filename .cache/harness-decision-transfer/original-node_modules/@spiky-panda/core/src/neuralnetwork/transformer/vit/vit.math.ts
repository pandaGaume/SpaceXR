import { ILayerNorm } from "./vit.interfaces";

// ---------------------------------------------------------------------------
// Softmax
// ---------------------------------------------------------------------------

/// <summary>
/// Numerically stable softmax over an array of values.
/// Subtracts the max value before exponentiating to prevent overflow.
/// </summary>
export function softmax(values: number[]): number[] {
    const max = Math.max(...values);
    const exps = values.map((v) => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
}

/// <summary>
/// Jacobian of softmax for backpropagation.
/// Given softmax output s, computes ds_i/dz_j = s_i * (delta_ij - s_j)
/// and returns the gradient w.r.t. input logits given the upstream gradient.
/// </summary>
export function softmaxBackward(softmaxOutput: number[], upstreamGrad: number[]): number[] {
    const n = softmaxOutput.length;
    const grad = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const kronecker = i === j ? 1 : 0;
            grad[i] += upstreamGrad[j] * softmaxOutput[j] * (kronecker - softmaxOutput[i]);
        }
    }
    return grad;
}

// ---------------------------------------------------------------------------
// GELU activation (used in ViT MLP blocks)
// ---------------------------------------------------------------------------

/// <summary>
/// GELU activation function approximation.
/// GELU(x) = x * 0.5 * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
/// </summary>
export function gelu(x: number): number {
    const c = Math.sqrt(2 / Math.PI);
    return 0.5 * x * (1 + Math.tanh(c * (x + 0.044715 * x * x * x)));
}

/// <summary>
/// GELU derivative for backpropagation.
/// </summary>
export function geluDerivative(x: number): number {
    const c = Math.sqrt(2 / Math.PI);
    const inner = c * (x + 0.044715 * x * x * x);
    const tanhVal = Math.tanh(inner);
    const sech2 = 1 - tanhVal * tanhVal;
    const dinnerDx = c * (1 + 3 * 0.044715 * x * x);
    return 0.5 * (1 + tanhVal) + 0.5 * x * sech2 * dinnerDx;
}

// ---------------------------------------------------------------------------
// Layer Normalization
// ---------------------------------------------------------------------------

/// <summary>
/// Creates a LayerNorm parameter set initialized to identity (gamma=1, beta=0).
/// </summary>
export function createLayerNorm(size: number, epsilon: number = 1e-5): ILayerNorm {
    return {
        gamma: new Array(size).fill(1),
        beta: new Array(size).fill(0),
        epsilon,
    };
}

/// <summary>
/// Applies layer normalization to an array of values.
/// Returns the normalized values and caches mean/variance for backprop.
///
///   output_i = gamma_i * (x_i - mean) / sqrt(var + eps) + beta_i
/// </summary>
export function layerNormForward(values: number[], norm: ILayerNorm): { output: number[]; mean: number; invStd: number; normalized: number[] } {
    const n = values.length;

    // Compute mean
    let mean = 0;
    for (let i = 0; i < n; i++) mean += values[i];
    mean /= n;

    // Compute variance
    let variance = 0;
    for (let i = 0; i < n; i++) {
        const d = values[i] - mean;
        variance += d * d;
    }
    variance /= n;

    const invStd = 1 / Math.sqrt(variance + norm.epsilon);

    // Normalize, scale, and shift
    const normalized = new Array(n);
    const output = new Array(n);
    for (let i = 0; i < n; i++) {
        normalized[i] = (values[i] - mean) * invStd;
        output[i] = norm.gamma[i] * normalized[i] + norm.beta[i];
    }

    return { output, mean, invStd, normalized };
}

/// <summary>
/// Backpropagation through layer normalization.
/// Returns gradients w.r.t. input, gamma, and beta.
/// </summary>
export function layerNormBackward(upstreamGrad: number[], normalized: number[], invStd: number, norm: ILayerNorm): { dInput: number[]; dGamma: number[]; dBeta: number[] } {
    const n = upstreamGrad.length;

    // dGamma and dBeta
    const dGamma = new Array(n);
    const dBeta = new Array(n);
    for (let i = 0; i < n; i++) {
        dGamma[i] = upstreamGrad[i] * normalized[i];
        dBeta[i] = upstreamGrad[i];
    }

    // dInput through normalization
    // dnorm_i = upstream_i * gamma_i
    const dnorm = new Array(n);
    for (let i = 0; i < n; i++) {
        dnorm[i] = upstreamGrad[i] * norm.gamma[i];
    }

    // dvar and dmean
    let dvar = 0;
    let dmean = 0;
    for (let i = 0; i < n; i++) {
        dvar += dnorm[i] * normalized[i];
        dmean += dnorm[i];
    }
    dvar *= -0.5 * invStd;
    dmean = (-invStd * dmean) / n + dvar * (-2 / n) * normalized.reduce((s, v) => s + v, 0);

    const dInput = new Array(n);
    for (let i = 0; i < n; i++) {
        dInput[i] = dnorm[i] * invStd + (dvar * 2 * normalized[i]) / n + dmean / n;
    }

    return { dInput, dGamma, dBeta };
}
