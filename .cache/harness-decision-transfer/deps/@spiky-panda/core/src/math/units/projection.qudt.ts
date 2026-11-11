/**
 * QUDT projection. The reference semantic exposition, and the one that is
 * implemented.
 *
 * QUDT gives a unit an IRI and separates it from the quantity kind it
 * measures, which is the same two-level model used here. That makes the
 * projection close to a rename for most units, and exactly not a rename for
 * the cases that matter.
 *
 * The unit table is keyed by UCUM code because UCUM is the canonical
 * identifier; its rows were read off the published QUDT unit vocabulary
 * rather than derived from a naming rule, since the naming is not regular
 * ("HZ" but "KiloHZ", "KiloGM" but "GM", "DeciB" but "PERCENT"). A row that
 * has not been checked against the vocabulary does not belong in the table:
 * the whole contract of this layer is that an absent projection is honest and
 * an invented one is not.
 *
 * Where the UCUM code is ambiguous, the quantity kind decides. Apparent power
 * and reactive power are both "V.A" and QUDT separates them into `unit:VA`
 * and `unit:VAR`; without the second argument the projection could only pick
 * one and be wrong half the time.
 */
import type { Unit } from "../math.units";
import type { IUnitProjection } from "./projection.interfaces";
import { registerUnitProjection } from "./projection.registry";

/** A QUDT-annotated unit, in the prefixed form a Thing Description carries. */
export interface IQudtProjection {
    /** `unit:` IRI in prefixed form, e.g. "unit:A". */
    readonly unit: string;
    /** `quantitykind:` IRI in prefixed form, e.g. "quantitykind:ElectricCurrent". */
    readonly quantityKind?: string;
}

/** Namespace of the unit vocabulary, for a consumer expanding the prefix. */
export const QUDT_UNIT_NS = "http://qudt.org/vocab/unit/";
/** Namespace of the quantity-kind vocabulary. */
export const QUDT_QUANTITYKIND_NS = "http://qudt.org/vocab/quantitykind/";

/**
 * UCUM code to QUDT unit local name.
 *
 * Covers the units this repository actually declares. A unit absent from this
 * table projects to undefined, which is the designed outcome and not a gap to
 * be papered over.
 */
const UNITS: { readonly [ucum: string]: string } = {
    // Electrical
    A: "A",
    mA: "MilliA",
    V: "V",
    mV: "MilliV",
    kV: "KiloV",
    Ohm: "OHM",
    H: "H",
    Wb: "WB",
    // Power and energy
    W: "W",
    kW: "KiloW",
    MW: "MegaW",
    J: "J",
    "W.h": "W-HR",
    // Time
    s: "SEC",
    ms: "MilliSEC",
    us: "MicroSEC",
    min: "MIN",
    h: "HR",
    d: "DAY",
    // Frequency and rotation
    Hz: "HZ",
    kHz: "KiloHZ",
    MHz: "MegaHZ",
    GHz: "GigaHZ",
    "{rev}/min": "REV-PER-MIN",
    "rad/s": "RAD-PER-SEC",
    // Geometry
    m: "M",
    mm: "MilliM",
    cm: "CentiM",
    km: "KiloM",
    m2: "M2",
    m3: "M3",
    L: "L",
    rad: "RAD",
    deg: "DEG",
    // Mechanics
    kg: "KiloGM",
    g: "GM",
    N: "N",
    "N/m": "N-PER-M",
    "N.m": "N-M",
    "kg.m2": "KiloGM-M2",
    "m/s": "M-PER-SEC",
    "m/s2": "M-PER-SEC2",
    "[g]": "G",
    Pa: "PA",
    "Pa.s": "PA-SEC",
    // Thermal and material
    K: "K",
    Cel: "DEG_C",
    "[degF]": "DEG_F",
    "kg/m3": "KiloGM-PER-M3",
    "g/mol": "GM-PER-MOL",
    "W/(m.K)": "W-PER-M-K",
    "J/(kg.K)": "J-PER-KiloGM-K",
    // Dimensionless
    "%": "PERCENT",
    "[ppm]": "PPM",
    dB: "DeciB",
};

/**
 * Overrides consulted before the table, for UCUM codes that name more than
 * one QUDT unit.
 *
 * Keyed by "<quantityKind>|<ucum>". The single entry today is the power
 * triangle, and it is the reason the projection signature carries a quantity
 * kind at all.
 */
const BY_KIND: { readonly [key: string]: string } = {
    "ApparentPower|V.A": "VA",
    "ReactivePower|V.A": "VAR",
};

/**
 * Quantity kind to QUDT local name.
 *
 * Separate from the unit table and separately fallible: a unit may project
 * while its kind does not, in which case the result carries the unit alone.
 * That is a legitimate partial answer, unlike a guessed kind.
 */
const KINDS: { readonly [kind: string]: string } = {
    Time: "Time",
    Length: "Length",
    Area: "Area",
    PlaneAngle: "PlaneAngle",
    Acceleration: "Acceleration",
    AngularVelocity: "AngularVelocity",
    ApparentPower: "ApparentPower",
};

export const qudtProjection: IUnitProjection<IQudtProjection> = {
    id: "qudt",
    spec: "https://www.qudt.org/doc/DOC_VOCAB-UNITS.html",
    project(unit: Unit, quantityKind: string): IQudtProjection | undefined {
        const ucum = unit.ucum;
        if (!ucum) return undefined;
        const local = BY_KIND[`${quantityKind}|${ucum}`] ?? UNITS[ucum];
        if (!local) return undefined;
        const kind = KINDS[quantityKind];
        return kind ? { unit: `unit:${local}`, quantityKind: `quantitykind:${kind}` } : { unit: `unit:${local}` };
    },
};

registerUnitProjection(qudtProjection);
