/**
 * The projection contract: one declaration, N expositions.
 *
 * A property declares its unit once, as a UCUM code plus a quantity kind.
 * Every standard that wants to see it (QUDT, W3C WoT, OPC UA, Sparkplug B,
 * OM) is produced by a projection from that pair. Nothing is declared twice,
 * and adding a standard never touches a node.
 *
 * ---------------------------------------------------------------------------
 * ADDING A PROJECTION
 * ---------------------------------------------------------------------------
 *
 * The full walkthrough, with the reasoning, is in
 * `docs/architecture/unit-projection.md`. In short:
 *
 *   1. Create `projection.<target>.ts` next to this file.
 *   2. Declare the output type. Make it the target's own shape, not a
 *      convenience shape: an OPC UA consumer expects an `EUInformation`
 *      record with a `namespaceUri`, a `unitId`, a `displayName` and a
 *      `description`, and anything less is a translation the consumer then
 *      has to finish.
 *   3. Implement `IUnitProjection<T>`, keyed on the UCUM code, consulting
 *      the quantity kind where the code alone is ambiguous.
 *   4. Register it with `registerUnitProjection`.
 *   5. Test the mechanism and a hand-verified sample, including one case
 *      where `project` must return undefined.
 *
 * ---------------------------------------------------------------------------
 * THE ASYMMETRY, WHICH IS THE POINT
 * ---------------------------------------------------------------------------
 *
 * UCUM is canonical here. It is not universally sufficient, and a projection
 * written on the assumption that it is will be wrong in ways that do not
 * announce themselves.
 *
 *   QUDT, OM     derive from the UCUM code by table. Direct.
 *   WoT          derives from QUDT, plus the JSON Schema type.
 *   OPC UA       does NOT derive from UCUM. `EUInformation.unitId` is an
 *                integer from the UN/CEFACT Recommendation 20 common code,
 *                a different system with its own vocabulary. OPC UA Part 8
 *                carries a "Mapping of UN/CEFACT to EUInformation" section
 *                precisely because the two need bridging.
 *   Sparkplug B  is a convention rather than a registry: the unit rides as a
 *                metric property, and its spelling is a house decision.
 *
 * Two consequences follow, and both are load-bearing.
 *
 * First, every projection owns its own correspondence table. `Unit` is not
 * loaded with the codes of every standard, because a canonical identifier
 * that accumulates its own alternatives has stopped being canonical.
 *
 * Second, the code alone is sometimes not enough even inside a single target.
 * Apparent power and reactive power are both "V.A" in UCUM, and QUDT gives
 * them `unit:VA` and `unit:VAR`. Only the quantity kind separates them, which
 * is why `project` receives it.
 *
 * ---------------------------------------------------------------------------
 * THE REFUSAL RULE
 * ---------------------------------------------------------------------------
 *
 * `project` returns undefined when the target has no equivalent. It never
 * returns a near match. An absent unit is visibly absent and a consumer can
 * decide what to do; an approximate one travels without saying that it is
 * approximate, is read as exact at the far end, and is discovered later by
 * whoever is holding the wrong answer.
 */
import type { Unit } from "../math.units";

/**
 * One target standard's view of a unit.
 *
 * `T` is that standard's own record shape. There is no common denominator
 * between an `EUInformation` and a QUDT IRI pair worth inventing, so the
 * interface is generic and each projection publishes its own type.
 */
export interface IUnitProjection<T> {
    /** Stable key used to register and look the projection up, e.g. "qudt". */
    readonly id: string;
    /** URL of the specification that decides what is correct here. */
    readonly spec: string;
    /**
     * Project one unit onto the target.
     *
     * @param unit         The canonical unit. Read `unit.ucum`; the display
     *                     symbol is for humans and is not an identifier.
     * @param quantityKind What the value measures, from
     *                     `resolveQuantityKind`. Needed wherever the UCUM
     *                     code is ambiguous on its own.
     * @returns The target's record, or undefined when the target has no
     *          equivalent. Never an approximation.
     */
    project(unit: Unit, quantityKind: string): T | undefined;
}
