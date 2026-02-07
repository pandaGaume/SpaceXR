/**
 *
 */
export interface IXmlSerializerNumberOptions {
    /**
     *
     */
    eps: number;
    /**
     *
     */
    maxDecimalsCap?: number; // default 15
    /**
     *
     */
    trimTrailingZeros?: boolean; // default true
    /**
     *
     */
    fixedDecimals?: number; // optional, overrides trim
    /**
     *
     */
    allowScientific?: boolean; // default false
    /**
     *
     */
    snapNearZero?: boolean; // default true
    /**
     *
     */
    zeroThreshold?: number; // default eps
    /**
     *
     */
    perAttributeEps?: Record<string, number>;
}

/**
 *
 */
export interface IXmlSerializerFormatOptions {
    /**
     *
     */
    number?: IXmlSerializerNumberOptions;
}

/**
 *
 * @param x
 * @param opts
 * @returns
 */
export function FormatNumberXml(x: number, opts: IXmlSerializerNumberOptions): string {
    if (!Number.isFinite(x)) {
        throw new Error(`Cannot format non-finite number: ${x}`);
    }
    if (!Number.isFinite(opts.eps) || opts.eps <= 0) {
        throw new Error("opts.eps must be a finite, positive number");
    }

    const maxDecimalsCap = _ClampInt(opts.maxDecimalsCap ?? 15, 0, 20);
    const trimTrailingZeros = opts.trimTrailingZeros ?? true;
    const snapNearZero = opts.snapNearZero ?? true;
    const zeroThreshold = opts.zeroThreshold ?? opts.eps;

    // Quantize to eps grid
    const inv = 1 / opts.eps;
    let q = Math.round(x * inv) / inv;

    // Normalize -0 to 0
    if (Object.is(q, -0)) {
        q = 0;
    }

    // Snap tiny values to 0 (helps size + stability)
    if (snapNearZero && Math.abs(q) <= zeroThreshold) {
        q = 0;
    }

    // Choose decimals policy
    let decimals: number;
    if (opts.fixedDecimals !== undefined) {
        decimals = _ClampInt(opts.fixedDecimals, 0, maxDecimalsCap);
    } else {
        // decimals needed for eps steps
        decimals = _ClampInt(Math.ceil(-Math.log10(opts.eps)), 0, maxDecimalsCap);
    }

    // Note: this implementation intentionally avoids scientific notation.
    // If allowScientific=true, you may want a different path (toPrecision).
    if (opts.allowScientific) {
        // Still avoid scientific here; keep deterministic fixed output.
        // If you really want scientific, implement a separate branch.
    }

    // Fast path when decimals = 0
    if (decimals === 0) {
        return String(Math.trunc(q));
    }

    // Start fixed, then optionally trim
    let s = q.toFixed(decimals);

    if (trimTrailingZeros && opts.fixedDecimals === undefined) {
        // Trim trailing zeros and optional trailing dot
        s = s
            .replace(/(\.\d*?[1-9])0+$/, "$1")
            .replace(/\.0+$/, "")
            .replace(/\.$/, "");
    }

    // Safety: ensure no scientific notation (should not happen with toFixed)
    if (/[eE]/.test(s)) {
        throw new Error(`Scientific notation not allowed in XML output: ${s}`);
    }

    return s;
}

function _ClampInt(n: number, min: number, max: number): number {
    if (!Number.isFinite(n)) {
        return min;
    }
    n = Math.trunc(n);
    return Math.max(min, Math.min(max, n));
}
