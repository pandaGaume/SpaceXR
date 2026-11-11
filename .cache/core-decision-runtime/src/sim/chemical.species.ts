/**
 * V1 chemical-species registry.
 *
 * The species set is intentionally small (N2, O2, CO2, H2O, Ar — the
 * five components needed to model Earth-air, Mars-air, ISS-cabin
 * ECLSS, and the Helios habitat scrubber loop) and the entries carry
 * only the constants the V1 AtmosphereStateNode actually consumes:
 *
 *   - `id`          stable string identifier ("N2", "O2", ...). Used
 *                   as the slot suffix in variadic delta inputs
 *                   (`delta_N2_<k>`) and observable outputs
 *                   (`mass_N2`, `mole_fraction_N2`, ...).
 *   - `molarMass`   kg/mol, used to convert between mass (storage) and
 *                   moles (intensive output: mole fractions, partial
 *                   pressures via ideal gas).
 *   - `displayName` human-readable label for property panel /
 *                   diagnostics. Not a runtime hot path.
 *
 * Open species registry (F4 — full IChemicalStream contract) is
 * deferred: V1 ships a closed list because the editor's variadic-port
 * reconciler needs the species schema at registration time. Extending
 * to user-defined species is a P-future once we have a story for
 * "edit the species list, edit downstream wiring".
 */

export type ChemicalSpeciesId = "N2" | "O2" | "CO2" | "H2O" | "Ar";

export interface IChemicalSpecies {
    readonly id: ChemicalSpeciesId;
    readonly displayName: string;
    /** kg / mol. */
    readonly molarMass: number;
}

/**
 * V1 canonical species. Molar masses are CODATA 2018 atomic weights
 * summed by atom count; expressed in kg/mol to match the SI-base
 * convention of the rest of the sim layer.
 */
export const CHEMICAL_SPECIES_V1: Readonly<Record<ChemicalSpeciesId, IChemicalSpecies>> = Object.freeze({
    N2: Object.freeze({ id: "N2", displayName: "Nitrogen", molarMass: 28.0134e-3 }),
    O2: Object.freeze({ id: "O2", displayName: "Oxygen", molarMass: 31.9988e-3 }),
    CO2: Object.freeze({ id: "CO2", displayName: "Carbon dioxide", molarMass: 44.0095e-3 }),
    H2O: Object.freeze({ id: "H2O", displayName: "Water vapor", molarMass: 18.01528e-3 }),
    Ar: Object.freeze({ id: "Ar", displayName: "Argon", molarMass: 39.948e-3 }),
});

/** Canonical ordering for the V1 species — fixes the state-vector
 *  layout for snapshot serialization (Q-S11). */
export const V1_SPECIES_ORDER: ReadonlyArray<ChemicalSpeciesId> = ["N2", "O2", "CO2", "H2O", "Ar"];

/** Universal gas constant in J / (mol·K). Used for ideal-gas
 *  pressure / density conversions in AtmosphereStateNode. */
export const GAS_CONSTANT_R = 8.314462618;

/**
 * Initial-atmosphere presets keyed by name. The user picks one in
 * the property panel; the AtmosphereStateNode derives its initial
 * mass vector from the preset's mole fractions + the user-set
 * volume + temperature + pressure (ideal gas law).
 *
 * `moleFractions` MUST sum to ≈ 1. The AtmosphereStateNode does not
 * re-normalise — it trusts the preset to be well-formed.
 *
 * V1 presets:
 *   - `earthHumidAirSeaLevel`: 1 atm, 20 °C, ~50% RH. Mole fractions
 *     from the U.S. Standard Atmosphere with H2O scaled to a
 *     defensible humid-air default.
 *   - `earthDryAirSeaLevel`: same minus the water vapour, scaled up.
 *   - `marsAtmosphereMean`: Mars Climate Database mean. CO2-dominant.
 *   - `issCabinECLSS`: ISS cabin ECLSS spec — Earth dry air at
 *     reduced CO2 (~3000 ppm cap), no argon needed for the model.
 *   - `vacuum`: all-zero. The AtmosphereStateNode treats this as
 *     "no species inventory", useful for orbital exterior surfaces.
 */
export interface IAtmospherePreset {
    readonly id: string;
    readonly displayName: string;
    readonly description: string;
    /** Mole fractions keyed by species id. Sum ≈ 1. Missing species
     *  default to 0. */
    readonly moleFractions: Readonly<Partial<Record<ChemicalSpeciesId, number>>>;
}

export const ATMOSPHERE_PRESETS: Readonly<Record<string, IAtmospherePreset>> = Object.freeze({
    earthHumidAirSeaLevel: Object.freeze({
        id: "earthHumidAirSeaLevel",
        displayName: "Earth air, sea level (humid)",
        description: "ICAO standard atmosphere at sea level, 20 °C, ~50% RH.",
        moleFractions: Object.freeze({
            N2: 0.7715,
            O2: 0.2072,
            CO2: 0.00042,
            H2O: 0.0116,
            Ar: 0.00928,
        }),
    }),
    earthDryAirSeaLevel: Object.freeze({
        id: "earthDryAirSeaLevel",
        displayName: "Earth air, sea level (dry)",
        description: "U.S. Standard Atmosphere dry-air composition.",
        moleFractions: Object.freeze({
            N2: 0.78084,
            O2: 0.20946,
            CO2: 0.00042,
            Ar: 0.00928,
        }),
    }),
    marsAtmosphereMean: Object.freeze({
        id: "marsAtmosphereMean",
        displayName: "Mars atmosphere (mean)",
        description: "Mars Climate Database mean. CO2-dominated, traces of N2 and Ar.",
        moleFractions: Object.freeze({
            CO2: 0.9532,
            N2: 0.027,
            Ar: 0.0163,
            O2: 0.0013,
            H2O: 0.0003,
        }),
    }),
    issCabinECLSS: Object.freeze({
        id: "issCabinECLSS",
        displayName: "ISS cabin (ECLSS spec)",
        description: "Crewed cabin baseline: Earth dry air at CO2 cap ~3000 ppm.",
        moleFractions: Object.freeze({
            N2: 0.781,
            O2: 0.209,
            CO2: 0.003,
            H2O: 0.007,
        }),
    }),
    vacuum: Object.freeze({
        id: "vacuum",
        displayName: "Vacuum",
        description: "No species — pressure 0, no mass to track.",
        moleFractions: Object.freeze({}),
    }),
});
