/**
 * Sparkplug B projection. NOT IMPLEMENTED.
 *
 * ---------------------------------------------------------------------------
 * TARGET SHAPE
 * ---------------------------------------------------------------------------
 *
 * Sparkplug B has no unit registry. A metric carries a `PropertySet`, a
 * parallel pair of `keys` and `values`, and the convention across the
 * ecosystem is a key named "engUnit" holding a string:
 *
 *   { name: "motor/current",
 *     datatype: Float,
 *     value: 4.72,
 *     properties: { keys: ["engUnit"], values: [{ type: String, value: "A" }] } }
 *
 * So the projection is a string, and the only real question is which string.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS MISSING BEYOND UCUM
 * ---------------------------------------------------------------------------
 *
 * Nothing technical, and one decision. The specification names the property
 * and says nothing about its vocabulary, so "A", "Amp", "amps" and "ampere"
 * are all equally conformant and mutually unreadable. What is missing is a
 * house rule, and the honest options are:
 *
 *   a. the UCUM code verbatim, which is unambiguous, machine-readable and
 *      occasionally unfamiliar to an operator ("Cel", "[g]", "{rev}/min");
 *   b. the display symbol, which reads naturally and collides across
 *      quantities, "g" being both gram and standard gravity;
 *   c. UCUM in "engUnit" plus a second property carrying the symbol, which
 *      costs a few bytes per metric and settles both.
 *
 * Option (c) is the recommendation, since the reason this layer exists is
 * that a display string is not an identity. It is a decision to take
 * explicitly rather than to inherit from whichever line of code is written
 * first.
 *
 * Sources:
 *   - Sparkplug B specification, "Metric Properties" and the reserved
 *     property names.
 *     https://sparkplug.eclipse.org/specification/
 *
 * ---------------------------------------------------------------------------
 * THE TRAP
 * ---------------------------------------------------------------------------
 *
 * Sparkplug's birth-and-death model means a metric's properties are published
 * once, in the NBIRTH, and every DDATA after it is positional. A unit changed
 * without a rebirth is a unit the subscriber never learns about, and the data
 * keeps flowing under the old one. So a projection change is a rebirth
 * trigger, not just a serialization detail.
 *
 * ---------------------------------------------------------------------------
 * TO IMPLEMENT
 * ---------------------------------------------------------------------------
 *
 * Settle the vocabulary question above, fill `project`, then uncomment the
 * registration. The walkthrough is in
 * `docs/architecture/unit-projection.md`.
 */
import type { Unit } from "../math.units";
import type { IUnitProjection } from "./projection.interfaces";

/** The property pair a Sparkplug metric would carry for its unit. */
export interface ISparkplugUnit {
    /** Value of the conventional "engUnit" metric property. */
    readonly engUnit: string;
    /** Human symbol, when the house rule carries one alongside. */
    readonly displaySymbol?: string;
}

/** Conventional property name. Not reserved by the specification. */
export const SPARKPLUG_ENG_UNIT_KEY = "engUnit";

export const sparkplugProjection: IUnitProjection<ISparkplugUnit> = {
    id: "sparkplug",
    spec: "https://sparkplug.eclipse.org/specification/",
    project(_unit: Unit, _quantityKind: string): ISparkplugUnit | undefined {
        // Not implemented: the vocabulary decision above has not been taken.
        return undefined;
    },
};

// registerUnitProjection(sparkplugProjection);
