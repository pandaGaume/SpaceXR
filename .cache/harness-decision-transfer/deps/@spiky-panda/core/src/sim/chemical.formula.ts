/**
 * Chemical FORMULA parsing and the stoichiometry that follows from it.
 *
 * The thesis of this file, in one sentence: a mass fraction of Fe2O3 is
 * NOT a mass fraction of Fe, and every conversion between the two needs
 * the formula, the atomic masses and an explicit basis. Getting this
 * wrong silently inflates an iron concentration by a factor 1.43, which
 * is exactly the kind of error that looks like a model problem later.
 *
 * Supported syntax:
 *   - element symbols with an optional integer count:  `Fe2O3`, `CaCO3`
 *   - nested groups with a multiplier:                 `Ca(OH)2`, `Al2(SO4)3`
 *   - a bare element:                                  `Fe`, `Si`
 *
 * NOT supported, and refused rather than guessed: hydrates (`CuSO4·5H2O`),
 * charges (`SO4^2-`), isotope notation (`13C`), fractional subscripts
 * (`Fe0.95O`) and any element outside `CHEMICAL_ELEMENTS`. Each refusal
 * carries the offending text, because a silent default here is how a
 * composition becomes wrong without anyone noticing.
 *
 * Basis handling: `mass` and `mole` are two different statements about
 * the same material, and the conversion between them needs molar masses.
 * The resolver therefore always returns BOTH vectors, and never lets a
 * caller read one while believing the other.
 */

import { CHEMICAL_ELEMENTS, elementMolarMass } from "./chemical.elements";

/** How a component's fraction is meant to be read. */
export type FractionBasis = "mass" | "mole";

/** One constituent of a material as the user declares it. */
export interface IMaterialComponent {
    /** Chemical formula of the constituent: `SiO2`, `Fe2O3`, `Fe`, ... */
    readonly formula: string;
    /** Fraction of the whole, in the composition's basis. Not required
     *  to sum to 1: the resolver normalises and reports what it did. */
    readonly fraction: number;
}

/** A parsed formula: atom counts per element, and the molar mass. */
export interface IParsedFormula {
    readonly formula: string;
    /** Atom count per element symbol, e.g. `Fe2O3` -> { Fe: 2, O: 3 }. */
    readonly counts: Readonly<Record<string, number>>;
    /** Molar mass of the compound [kg/mol]. */
    readonly molarMass: number;
}

/** The elemental composition a material resolves to. */
export interface IElementalComposition {
    /** Basis the input fractions were read in. */
    readonly basis: FractionBasis;
    /** Mass fraction per element, summing to 1 (or all zero for an
     *  empty material). */
    readonly massFractions: Readonly<Record<string, number>>;
    /** Mole (atom) fraction per element, summing to 1. */
    readonly moleFractions: Readonly<Record<string, number>>;
    /** Sum of the input fractions BEFORE normalisation. A value far
     *  from 1 means the user's numbers did not add up, and the caller
     *  should surface it rather than hide the rescale. */
    readonly inputFractionSum: number;
    /** Elements present, ordered by atomic number. */
    readonly elements: ReadonlyArray<string>;
}

/** Thrown for any formula this module refuses to interpret. */
export class ChemicalFormulaError extends Error {
    public constructor(
        message: string,
        public readonly formula: string
    ) {
        super(message);
        this.name = "ChemicalFormulaError";
    }
}

/**
 * Parse a chemical formula into atom counts and a molar mass.
 *
 * Throws `ChemicalFormulaError` on empty input, unknown element,
 * unbalanced parenthesis, or any character the grammar does not cover.
 */
export function parseChemicalFormula(formula: string): IParsedFormula {
    const text = formula.trim();
    if (text.length === 0) {
        throw new ChemicalFormulaError("empty formula", formula);
    }

    // Each parenthesis level accumulates its own counts; closing a level
    // multiplies it into its parent.
    const stack: Array<Record<string, number>> = [{}];
    let i = 0;

    const addTo = (target: Record<string, number>, symbol: string, n: number): void => {
        target[symbol] = (target[symbol] ?? 0) + n;
    };

    const readInteger = (): number => {
        let digits = "";
        while (i < text.length && text[i] >= "0" && text[i] <= "9") {
            digits += text[i];
            i++;
        }
        if (digits.length === 0) return 1;
        // A leading zero ("Fe02") or a zero count ("Fe0") is a typo, not
        // a composition: refuse instead of dropping the element.
        const n = Number(digits);
        if (n === 0) {
            throw new ChemicalFormulaError(`zero atom count in "${text}"`, formula);
        }
        return n;
    };

    while (i < text.length) {
        const c = text[i];

        if (c === "(" || c === "[") {
            stack.push({});
            i++;
            continue;
        }

        if (c === ")" || c === "]") {
            if (stack.length === 1) {
                throw new ChemicalFormulaError(`unbalanced closing bracket in "${text}"`, formula);
            }
            const group = stack.pop() as Record<string, number>;
            i++;
            const multiplier = readInteger();
            const parent = stack[stack.length - 1];
            for (const [symbol, n] of Object.entries(group)) {
                addTo(parent, symbol, n * multiplier);
            }
            continue;
        }

        // An element symbol is an uppercase letter optionally followed
        // by lowercase letters. Two-letter symbols are tried first so
        // "Co" reads as cobalt and not as carbon plus oxygen.
        if (c >= "A" && c <= "Z") {
            let symbol = c;
            let j = i + 1;
            while (j < text.length && text[j] >= "a" && text[j] <= "z") {
                symbol += text[j];
                j++;
            }
            if (!Object.prototype.hasOwnProperty.call(CHEMICAL_ELEMENTS, symbol)) {
                throw new ChemicalFormulaError(`unknown element "${symbol}" in "${text}"`, formula);
            }
            i = j;
            const n = readInteger();
            addTo(stack[stack.length - 1], symbol, n);
            continue;
        }

        throw new ChemicalFormulaError(`unexpected character "${c}" in "${text}" (hydrates, charges and isotopes are not supported)`, formula);
    }

    if (stack.length !== 1) {
        throw new ChemicalFormulaError(`unbalanced opening bracket in "${text}"`, formula);
    }

    const counts = stack[0];
    if (Object.keys(counts).length === 0) {
        throw new ChemicalFormulaError(`no element found in "${text}"`, formula);
    }

    let molarMass = 0;
    for (const [symbol, n] of Object.entries(counts)) {
        molarMass += (elementMolarMass(symbol) as number) * n;
    }

    return Object.freeze({ formula: text, counts: Object.freeze(counts), molarMass });
}

/**
 * Mass fraction of each element WITHIN one compound. `Fe2O3` gives
 * Fe = 0.6994, O = 0.3006: the two numbers sum to 1 because they
 * describe the compound, not a mixture.
 */
export function elementMassFractionsOf(formula: string): Readonly<Record<string, number>> {
    const parsed = parseChemicalFormula(formula);
    const out: Record<string, number> = {};
    for (const [symbol, n] of Object.entries(parsed.counts)) {
        out[symbol] = ((elementMolarMass(symbol) as number) * n) / parsed.molarMass;
    }
    return Object.freeze(out);
}

/**
 * Resolve a list of components into an elemental composition.
 *
 * `basis` says how to read the component fractions:
 *   - `mass`: fraction of the total MASS. An element's mass contribution
 *     is `fraction * (its mass fraction inside the compound)`.
 *   - `mole`: fraction of the total MOLES OF COMPOUND. An element's mole
 *     contribution is `fraction * (its atom count in the compound)`, and
 *     its mass follows by multiplying by the atomic mass.
 *
 * Negative fractions are refused: a composition cannot contain a
 * negative amount of anything, and tolerating it would silently cancel
 * another component. A total of zero (or an empty list) returns all-zero
 * vectors rather than dividing by zero.
 */
export function resolveElementalComposition(components: ReadonlyArray<IMaterialComponent>, basis: FractionBasis): IElementalComposition {
    let inputFractionSum = 0;
    for (const c of components) {
        if (!Number.isFinite(c.fraction)) {
            throw new ChemicalFormulaError(`non-finite fraction for "${c.formula}"`, c.formula);
        }
        if (c.fraction < 0) {
            throw new ChemicalFormulaError(`negative fraction ${c.fraction} for "${c.formula}"`, c.formula);
        }
        inputFractionSum += c.fraction;
    }

    // Unnormalised accumulators, in moles of atoms and in mass units.
    const moles: Record<string, number> = {};
    const mass: Record<string, number> = {};

    for (const c of components) {
        if (c.fraction === 0) {
            // Parse anyway: a typo in a zeroed component is still a typo,
            // and the user should hear about it now, not when they raise
            // the fraction.
            parseChemicalFormula(c.formula);
            continue;
        }
        const parsed = parseChemicalFormula(c.formula);
        for (const [symbol, n] of Object.entries(parsed.counts)) {
            const M = elementMolarMass(symbol) as number;
            if (basis === "mole") {
                const atomMoles = c.fraction * n;
                moles[symbol] = (moles[symbol] ?? 0) + atomMoles;
                mass[symbol] = (mass[symbol] ?? 0) + atomMoles * M;
            } else {
                // Mass basis: split the component's mass over its
                // elements by their mass share inside the compound.
                const elementMass = c.fraction * ((M * n) / parsed.molarMass);
                mass[symbol] = (mass[symbol] ?? 0) + elementMass;
                moles[symbol] = (moles[symbol] ?? 0) + elementMass / M;
            }
        }
    }

    const totalMass = Object.values(mass).reduce((s, v) => s + v, 0);
    const totalMoles = Object.values(moles).reduce((s, v) => s + v, 0);

    const massFractions: Record<string, number> = {};
    const moleFractions: Record<string, number> = {};
    for (const symbol of Object.keys(mass)) {
        massFractions[symbol] = totalMass > 0 ? mass[symbol] / totalMass : 0;
        moleFractions[symbol] = totalMoles > 0 ? moles[symbol] / totalMoles : 0;
    }

    const elements = Object.keys(massFractions).sort((a, b) => CHEMICAL_ELEMENTS[a].atomicNumber - CHEMICAL_ELEMENTS[b].atomicNumber);

    return Object.freeze({
        basis,
        massFractions: Object.freeze(massFractions),
        moleFractions: Object.freeze(moleFractions),
        inputFractionSum,
        elements: Object.freeze(elements),
    });
}
