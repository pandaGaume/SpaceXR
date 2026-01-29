import { Scalar } from "core/math";
import { IPlanetoryMeterPerStepProvider } from "./camera.planetary.inputs";

export interface AltitudeDomain {
  refAlt?: number;
  minRelAlt?: number;
  maxRelAlt?: number;
}

function normalizeRelativeAltitude(alt: number, domain?: AltitudeDomain): number {
  const refAlt = domain?.refAlt ?? 0;
  const minRelAlt = domain?.minRelAlt ?? 0;
  const maxRelAlt = domain?.maxRelAlt ?? Number.POSITIVE_INFINITY;
  const rel = alt - refAlt;
  return Scalar.Clamp(rel, minRelAlt, maxRelAlt);
}

/* -------------------------- 1) Power law provider -------------------------- */

export interface PowerLawStepOptions {
  domain?: AltitudeDomain;
  minStep?: number;
  maxStep?: number;
  h0?: number;
  k?: number;
  exp?: number;
  accel?: number;
}

export class PowerLawStepProvider implements IPlanetoryMeterPerStepProvider {

  public static readonly DefaultMinStep = 0.25;
  public static readonly DefaultMaxStep = 2_000_000;
  public static readonly DefaultH0 = 10;
  public static readonly DefaultK = 0.12;
  public static readonly DefaultExp = 0.85;
  public static readonly DefaultAccel = 0.15;

  private readonly domain: AltitudeDomain;

  constructor(private readonly opt: PowerLawStepOptions = {}) {
    this.domain = opt.domain ?? {};
  }

  getStep(alt: number, rawDelta: number): number {
    const h = normalizeRelativeAltitude(alt, this.domain);

    const minStep = this.opt.minStep ?? PowerLawStepProvider.DefaultMinStep;
    const maxStep = this.opt.maxStep ?? PowerLawStepProvider.DefaultMaxStep;

    const h0 = this.opt.h0 ?? PowerLawStepProvider.DefaultH0;
    const k = this.opt.k ?? PowerLawStepProvider.DefaultK;
    const exp = this.opt.exp ?? PowerLawStepProvider.DefaultExp;
    const accel = this.opt.accel ?? PowerLawStepProvider.DefaultAccel;

    let step = k * Math.pow(h + h0, exp);

    const a = Math.min(3, Math.abs(rawDelta) / 120);
    step *= 1 + accel * (a - 1);

    return Scalar.Clamp(step, minStep, maxStep);
  }
}

/* --------------------- 2) Smooth fraction-of-alt provider ------------------ */

export interface SmoothFractionStepOptions {
  domain?: AltitudeDomain;
  minStep?: number;
  maxStep?: number;
  fracNear?: number;
  fracFar?: number;
  hNear?: number;
  hFar?: number;
}

export class SmoothFractionStepProvider implements IPlanetoryMeterPerStepProvider {

  public static readonly DefaultMinStep = 0.2;
  public static readonly DefaultMaxStep = 2_000_000;
  public static readonly DefaultFracNear = 0.002;
  public static readonly DefaultFracFar = 0.02;
  public static readonly DefaultHNear = 2_000;
  public static readonly DefaultHFar = 2_000_000;

  private readonly domain: AltitudeDomain;

  constructor(private readonly opt: SmoothFractionStepOptions = {}) {
    this.domain = opt.domain ?? {};
  }

  getStep(alt: number, rawDelta: number): number {
    const h = normalizeRelativeAltitude(alt, this.domain);

    const minStep = this.opt.minStep ?? SmoothFractionStepProvider.DefaultMinStep;
    const maxStep = this.opt.maxStep ?? SmoothFractionStepProvider.DefaultMaxStep;

    const fracNear = this.opt.fracNear ?? SmoothFractionStepProvider.DefaultFracNear;
    const fracFar = this.opt.fracFar ?? SmoothFractionStepProvider.DefaultFracFar;
    const hNear = this.opt.hNear ?? SmoothFractionStepProvider.DefaultHNear;
    const hFar = this.opt.hFar ?? SmoothFractionStepProvider.DefaultHFar;

    const t = (h - hNear) / (hFar - hNear);
    const s = Scalar.Smoothstep(t);
    const frac = fracNear + (fracFar - fracNear) * s;

    const step = Math.max(minStep, h * frac);
    return Math.min(maxStep, step);
  }
}

/* ---------------------- 3) Piecewise regime provider ----------------------- */

export interface PiecewiseRegimeStepOptions {
  domain?: AltitudeDomain;
  minStep?: number;
  maxStep?: number;
  h1?: number;
  h2?: number;
  nearBase?: number;
  nearSlope?: number;
  midFrac?: number;
  farFrac?: number;
}

export class PiecewiseRegimeStepProvider implements IPlanetoryMeterPerStepProvider {

  public static readonly DefaultMinStep = 0.25;
  public static readonly DefaultMaxStep = 2_000_000;
  public static readonly DefaultH1 = 5_000;
  public static readonly DefaultH2 = 200_000;
  public static readonly DefaultNearBase = 0.5;
  public static readonly DefaultNearSlope = 0.0008;
  public static readonly DefaultMidFrac = 0.006;
  public static readonly DefaultFarFrac = 0.02;

  private readonly domain: AltitudeDomain;

  constructor(private readonly opt: PiecewiseRegimeStepOptions = {}) {
    this.domain = opt.domain ?? {};
  }

  getStep(alt: number, rawDelta: number): number {
    const h = normalizeRelativeAltitude(alt, this.domain);

    const minStep = this.opt.minStep ?? PiecewiseRegimeStepProvider.DefaultMinStep;
    const maxStep = this.opt.maxStep ?? PiecewiseRegimeStepProvider.DefaultMaxStep;

    const h1 = this.opt.h1 ?? PiecewiseRegimeStepProvider.DefaultH1;
    const h2 = this.opt.h2 ?? PiecewiseRegimeStepProvider.DefaultH2;

    const nearBase = this.opt.nearBase ?? PiecewiseRegimeStepProvider.DefaultNearBase;
    const nearSlope = this.opt.nearSlope ?? PiecewiseRegimeStepProvider.DefaultNearSlope;

    const midFrac = this.opt.midFrac ?? PiecewiseRegimeStepProvider.DefaultMidFrac;
    const farFrac = this.opt.farFrac ?? PiecewiseRegimeStepProvider.DefaultFarFrac;

    const stepNear = nearBase + nearSlope * h;
    const stepMid = midFrac * h;
    const stepFar = farFrac * h;

    let step: number;
    if (h < h1) {
      step = stepNear;
    } else if (h < h2) {
      const t = Scalar.Smoothstep((h - h1) / (h2 - h1));
      step = Scalar.Lerp(stepMid, stepFar, t);
    } else {
      step = stepFar;
    }

    return Scalar.Clamp(step, minStep, maxStep);
  }
}
