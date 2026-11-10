/**
 * OPC UA projection. NOT IMPLEMENTED, and the one that must not be written
 * from the UCUM code alone.
 *
 * Read this whole comment before starting. It carries what an implementer
 * would otherwise have to rediscover, which is the reason the file exists
 * empty rather than not existing.
 *
 * ---------------------------------------------------------------------------
 * TARGET SHAPE
 * ---------------------------------------------------------------------------
 *
 * OPC UA describes an engineering unit with the `EUInformation` structured
 * type, attached to a variable through the `EngineeringUnits` property. Four
 * fields, all of them meant:
 *
 *   namespaceUri  String        Where `unitId` is defined. For the UN/CEFACT
 *                               common code this is
 *                               "http://www.opcfoundation.org/UA/units/un/cefact".
 *   unitId        Int32         The identifier within that namespace. An
 *                               INTEGER, not a string. See below.
 *   displayName   LocalizedText The symbol shown to an operator, e.g. "Hz".
 *   description   LocalizedText The unit's name, e.g. "hertz".
 *
 * Hertz, as an example of the shape:
 *
 *   { namespaceUri: "http://www.opcfoundation.org/UA/units/un/cefact",
 *     unitId: 4403780,
 *     displayName: { locale: "en", text: "Hz" },
 *     description: { locale: "en", text: "hertz" } }
 *
 * ---------------------------------------------------------------------------
 * WHAT IS MISSING BEYOND UCUM, AND WHERE TO FIND IT
 * ---------------------------------------------------------------------------
 *
 * `unitId` cannot be derived from a UCUM code. It comes from UN/CEFACT
 * Recommendation 20, a different vocabulary with its own identifiers, and the
 * integer is that recommendation's alphanumeric common code reinterpreted as
 * bytes. Hertz has common code "HTZ", and 4403780 is 0x434C48 read from the
 * ASCII of its characters. Deriving it therefore needs the common code, which
 * this repository does not hold.
 *
 * So the work is a UCUM-to-UN/CEFACT correspondence table, built by hand and
 * verified row by row. It is the only route. Sources, in order of authority:
 *
 *   - OPC UA Part 8, section 5.6.4, "Mapping of UN/CEFACT to EUInformation".
 *     Defines the encoding of the common code into `unitId`.
 *     https://reference.opcfoundation.org/Core/Part8/v105/docs/5.6.4
 *   - UN/CEFACT Recommendation 20, "Codes for Units of Measure Used in
 *     International Trade". The list of common codes and their meanings.
 *     https://unece.org/trade/uncefact/cl-recommendations
 *   - The OPC Foundation publishes a machine-readable table of the codes
 *     with their unitIds, which is the practical starting point.
 *
 * ---------------------------------------------------------------------------
 * THE TRAP
 * ---------------------------------------------------------------------------
 *
 * `unitId` being an integer makes a wrong value indistinguishable from a
 * right one at the receiving end. There is no parse step to fail on: a client
 * reads 4403780, looks it up, and displays whatever it finds. A transposed
 * digit produces a different real unit, silently.
 *
 * Which is why the refusal rule of `IUnitProjection` matters more here than
 * anywhere else in this directory. A unit not in the verified table returns
 * undefined. It does not get a plausible integer.
 *
 * Second trap, smaller: UN/CEFACT is a trade vocabulary. Its coverage of
 * industrial electrical quantities is good and its coverage of the corners is
 * not. Expect legitimate holes, and leave them as holes.
 *
 * ---------------------------------------------------------------------------
 * TO IMPLEMENT
 * ---------------------------------------------------------------------------
 *
 * Fill `project`, add the table, then uncomment the registration at the
 * bottom of the file. The walkthrough is in
 * `docs/architecture/unit-projection.md`.
 */
import type { Unit } from "../math.units";
import type { IUnitProjection } from "./projection.interfaces";

/** OPC UA `EUInformation`, as OPC UA Part 8 defines it. */
export interface IOpcUaEuInformation {
    readonly namespaceUri: string;
    readonly unitId: number;
    readonly displayName: { readonly locale: string; readonly text: string };
    readonly description: { readonly locale: string; readonly text: string };
}

/** Namespace of the UN/CEFACT common codes, the usual source of `unitId`. */
export const OPCUA_UNECE_NS = "http://www.opcfoundation.org/UA/units/un/cefact";

export const opcUaProjection: IUnitProjection<IOpcUaEuInformation> = {
    id: "opcua",
    spec: "https://reference.opcfoundation.org/Core/Part8/v105/docs/5.6.4",
    project(_unit: Unit, _quantityKind: string): IOpcUaEuInformation | undefined {
        // Not implemented. Returning undefined is the correct behaviour of an
        // unimplemented projection, and it is what every consumer already
        // handles: the unit is simply not exposed to OPC UA.
        return undefined;
    },
};

// Deliberately not registered. Registering a projection that answers
// undefined to everything would advertise an OPC UA capability that does not
// exist, and `unitProjectionIds()` is meant to list what actually works.
// Uncomment once the table is in:
//
// registerUnitProjection(opcUaProjection);
