/**
 * Fundamental physical constants, in canonical SI.
 *
 * Why here: `chemical.species.ts` already carries `GAS_CONSTANT_R` for the
 * atmosphere stack, and a spectroscopic model needs the same handful of
 * constants (Boltzmann, Planck, the speed of light, the electron mass).
 * Defining them once, with their status, keeps two plugins from each
 * rounding them their own way.
 *
 * Four of the five are EXACT by the 2019 definition of the SI: the
 * kilogram, the second, the metre and the kelvin are now fixed through
 * h, the caesium transition, c and k_B. They carry no uncertainty, and
 * writing more digits of them is not possible, only wrong. The electron
 * mass is measured, so it has one: the CODATA 2018 value is given here
 * to the digits that matter for this codebase.
 */

/** Boltzmann constant [J/K]. Exact, SI 2019. */
export const BOLTZMANN_CONSTANT = 1.380649e-23;

/** Planck constant [J.s]. Exact, SI 2019. */
export const PLANCK_CONSTANT = 6.62607015e-34;

/** Speed of light in vacuum [m/s]. Exact, SI 2019. */
export const SPEED_OF_LIGHT = 299792458;

/** Elementary charge [C]. Exact, SI 2019; also the electronvolt in joules. */
export const ELEMENTARY_CHARGE = 1.602176634e-19;

/** Electron rest mass [kg]. CODATA 2018, measured. */
export const ELECTRON_MASS = 9.1093837015e-31;

/** One electronvolt in joules. The same number as the elementary charge,
 *  named for the conversions that read better with it. */
export const ELECTRONVOLT = ELEMENTARY_CHARGE;

/** Convert an energy from electronvolts to joules. */
export function electronvoltsToJoules(ev: number): number {
    return ev * ELECTRONVOLT;
}

/**
 * `k_B * T` in electronvolts, the quantity every Boltzmann factor is
 * divided by. Written once because `exp(-E / kT)` with E in eV and T in
 * kelvin is where unit mistakes happen.
 */
export function thermalEnergyEv(temperatureK: number): number {
    return (BOLTZMANN_CONSTANT * temperatureK) / ELECTRONVOLT;
}
