/**
 * OM projection. NOT IMPLEMENTED, and interoperability support only.
 *
 * OM, the Ontology of units of Measure, is a target here and never a model.
 * It is implemented when a specific consumer asks for it, and it does not get
 * a say in how anything upstream is shaped. QUDT is the reference ontology.
 *
 * ---------------------------------------------------------------------------
 * TARGET SHAPE
 * ---------------------------------------------------------------------------
 *
 * OM is an OWL ontology, so a unit is an IRI in the `om:` namespace and it
 * names both a unit and, separately, a quantity:
 *
 *   http://www.ontology-of-units-of-measure.org/resource/om-2/hertz
 *   http://www.ontology-of-units-of-measure.org/resource/om-2/Frequency
 *
 * ---------------------------------------------------------------------------
 * WHAT IS MISSING BEYOND UCUM
 * ---------------------------------------------------------------------------
 *
 * A correspondence table, as everywhere. OM's local names are spelled-out
 * English in lowerCamelCase for units ("metrePerSecond-Time", "hertz",
 * "kilogramPerCubicMetre") and capitalised for quantities ("Frequency",
 * "Density"), so they cannot be derived from a UCUM code by rule.
 *
 * Two shortcuts that look available and are not:
 *
 *   - OM's names look predictable enough to generate. They are not: compound
 *     units carry a disambiguating suffix ("-Time") where a name would
 *     otherwise be reused, and the suffix is not derivable.
 *   - QUDT publishes alignments to other vocabularies, and going through QUDT
 *     rather than from UCUM is tempting. It composes two tables and therefore
 *     two chances to be wrong, and it makes OM's correctness depend on QUDT
 *     coverage this repository does not control.
 *
 * Source:
 *   - OM 2 vocabulary.
 *     https://github.com/HajoRijgersberg/OM
 *
 * ---------------------------------------------------------------------------
 * THE TRAP
 * ---------------------------------------------------------------------------
 *
 * OM distinguishes a unit from a "unit of measure applied to a quantity", and
 * a consumer expecting the second while receiving the first gets a graph that
 * validates and answers no query. Decide which of the two the consumer needs
 * before writing the table, because it changes every row.
 *
 * ---------------------------------------------------------------------------
 * TO IMPLEMENT
 * ---------------------------------------------------------------------------
 *
 * Fill `project`, add the table, then uncomment the registration. The
 * walkthrough is in `docs/architecture/unit-projection.md`.
 */
import type { Unit } from "../math.units";
import type { IUnitProjection } from "./projection.interfaces";

/** An OM unit, with the quantity it measures when one is known. */
export interface IOmProjection {
    /** Full IRI of the unit, e.g. ".../om-2/hertz". */
    readonly unit: string;
    /** Full IRI of the quantity, e.g. ".../om-2/Frequency". */
    readonly quantity?: string;
}

/** OM 2 resource namespace. */
export const OM_NS = "http://www.ontology-of-units-of-measure.org/resource/om-2/";

export const omProjection: IUnitProjection<IOmProjection> = {
    id: "om",
    spec: "https://github.com/HajoRijgersberg/OM",
    project(_unit: Unit, _quantityKind: string): IOmProjection | undefined {
        // Not implemented: no consumer has asked for OM yet, and this target
        // is demand-driven by design.
        return undefined;
    },
};

// registerUnitProjection(omProjection);
