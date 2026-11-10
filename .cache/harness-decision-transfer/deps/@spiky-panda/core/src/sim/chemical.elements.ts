/**
 * Chemical ELEMENTS, as opposed to `chemical.species.ts`, which carries
 * gas MOLECULES (N2, CO2, ...) for the atmosphere stack.
 *
 * Why a second table: a condensed-matter composition ("60 % SiO2, 20 %
 * Fe2O3, ...") resolves to a vector over elements, and the element is
 * what a spectroscopic line catalogue is keyed by (Fe I, Ca II, ...).
 * `ChemicalSpeciesId` is a CLOSED union of the 15 atmosphere gases, so
 * it cannot carry an arbitrary element; element symbols are therefore
 * plain strings validated against this table.
 *
 * `molarMass` is in canonical SI (kg/mol), matching
 * `IChemicalSpecies.molarMass`, even though standard atomic weights are
 * published dimensionless (relative to 1/12 of carbon-12) and read in
 * g/mol. A standard atomic weight is an abundance-weighted average over
 * the isotopes of a terrestrial sample: it is the right constant for a
 * bulk composition, and the WRONG one for an isotope-resolved
 * calculation.
 *
 * Coverage is deliberate, not exhaustive: the elements that appear in
 * rock, soil, metal and alloy analysis, which is what the LIBS track
 * needs. Adding one is a one-line entry; the table is sorted by atomic
 * number so a reader can see what is missing.
 *
 * Provenance: values are the IUPAC / CIAAW standard atomic weights as
 * commonly tabulated, rounded to five significant digits. They are
 * marked `a_verifier` in the LIBS track's parameter file until checked
 * against the primary source. Five digits is far below the uncertainty
 * that matters for a mass-fraction conversion (a 1e-5 relative error on
 * a molar mass is invisible next to a 1 % error on a measured
 * concentration), but it is not good enough to be quoted as a reference
 * value.
 */

/** One element of the periodic table, as this codebase needs it. */
export interface IChemicalElement {
    /** IUPAC symbol, case-sensitive: "Fe", not "FE" nor "fe". */
    readonly symbol: string;
    /** English name, for display. */
    readonly displayName: string;
    /** Proton count. Unique, and the table's sort key. */
    readonly atomicNumber: number;
    /** Standard atomic weight expressed in canonical SI [kg/mol]. */
    readonly molarMass: number;
}

const el = (symbol: string, displayName: string, atomicNumber: number, gPerMol: number): IChemicalElement =>
    Object.freeze({ symbol, displayName, atomicNumber, molarMass: gPerMol * 1e-3 });

/**
 * Element table, keyed by symbol. Frozen: a composition resolver must
 * not be able to mutate the constants it reads.
 */
export const CHEMICAL_ELEMENTS: Readonly<Record<string, IChemicalElement>> = Object.freeze({
    H: el("H", "Hydrogen", 1, 1.008),
    He: el("He", "Helium", 2, 4.0026),
    Li: el("Li", "Lithium", 3, 6.94),
    Be: el("Be", "Beryllium", 4, 9.0122),
    B: el("B", "Boron", 5, 10.81),
    C: el("C", "Carbon", 6, 12.011),
    N: el("N", "Nitrogen", 7, 14.007),
    O: el("O", "Oxygen", 8, 15.999),
    F: el("F", "Fluorine", 9, 18.998),
    Ne: el("Ne", "Neon", 10, 20.18),
    Na: el("Na", "Sodium", 11, 22.99),
    Mg: el("Mg", "Magnesium", 12, 24.305),
    Al: el("Al", "Aluminium", 13, 26.982),
    Si: el("Si", "Silicon", 14, 28.085),
    P: el("P", "Phosphorus", 15, 30.974),
    S: el("S", "Sulfur", 16, 32.06),
    Cl: el("Cl", "Chlorine", 17, 35.45),
    Ar: el("Ar", "Argon", 18, 39.948),
    K: el("K", "Potassium", 19, 39.098),
    Ca: el("Ca", "Calcium", 20, 40.078),
    Ti: el("Ti", "Titanium", 22, 47.867),
    V: el("V", "Vanadium", 23, 50.942),
    Cr: el("Cr", "Chromium", 24, 51.996),
    Mn: el("Mn", "Manganese", 25, 54.938),
    Fe: el("Fe", "Iron", 26, 55.845),
    Co: el("Co", "Cobalt", 27, 58.933),
    Ni: el("Ni", "Nickel", 28, 58.693),
    Cu: el("Cu", "Copper", 29, 63.546),
    Zn: el("Zn", "Zinc", 30, 65.38),
    Sr: el("Sr", "Strontium", 38, 87.62),
    Zr: el("Zr", "Zirconium", 40, 91.224),
    Mo: el("Mo", "Molybdenum", 42, 95.95),
    Ag: el("Ag", "Silver", 47, 107.87),
    Sn: el("Sn", "Tin", 50, 118.71),
    Ba: el("Ba", "Barium", 56, 137.33),
    W: el("W", "Tungsten", 74, 183.84),
    Au: el("Au", "Gold", 79, 196.97),
    Pb: el("Pb", "Lead", 82, 207.2),
});

/** Every symbol in the table, ordered by atomic number. */
export const CHEMICAL_ELEMENT_SYMBOLS: ReadonlyArray<string> = Object.freeze(
    Object.values(CHEMICAL_ELEMENTS)
        .slice()
        .sort((a, b) => a.atomicNumber - b.atomicNumber)
        .map((e) => e.symbol)
);

/** True when `symbol` is an element this table knows. */
export function isKnownElement(symbol: string): boolean {
    return Object.prototype.hasOwnProperty.call(CHEMICAL_ELEMENTS, symbol);
}

/**
 * Molar mass [kg/mol] of an element, or `undefined` for a symbol the
 * table does not carry. Callers decide whether an unknown element is a
 * refusal or a warning; this function never guesses.
 */
export function elementMolarMass(symbol: string): number | undefined {
    return CHEMICAL_ELEMENTS[symbol]?.molarMass;
}
