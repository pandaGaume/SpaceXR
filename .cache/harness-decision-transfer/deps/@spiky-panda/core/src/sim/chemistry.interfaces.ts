/**
 * Cross-plugin contract for chemical-species metadata.
 *
 * `IGasMetadata` is what an atmosphere / composition / gate consumes
 * from a wired gas node. Living in core (alongside `ISceneStateView`,
 * `IIntegrable`, etc.) means physics-plugin nodes can duck-type on
 * this interface without importing the chemistry plugin — the same
 * pattern used by `SceneStateView` → SceneItem (the runtime never
 * sees the SceneItem class, only the descriptor shape).
 *
 * Canonical SI throughout: kg/mol for molar mass, kg/m³ for density,
 * J/(kg·K) for specific heat, W/(m·K) for thermal conductivity, Pa·s
 * for dynamic viscosity. Plugins that expose user-facing fields in
 * engineering units (g/mol, μPa·s, ...) convert to SI at the
 * IGasMetadata boundary so consumers always see one set of units.
 *
 * V1 scope: scalar constants. Temperature- / pressure-dependent
 * properties (Antoine vapor-pressure coefficients, Sutherland-form
 * viscosity laws, Lennard-Jones potential parameters) are deferred
 * to V2 — the V1 atmosphere uses ideal-gas equations and constant
 * viscosity / Cp, which the scalar form covers.
 */
export interface IGasMetadata {
    /** Stable string identifier ("N2", "O2", "CO2", ...). Used as
     *  the slot suffix in `delta_<speciesId>_<k>` variadic inputs on
     *  atmospheres and as the lookup key in compositions. Distinct
     *  from `GraphItem.id` (which is the editor-assigned UUID); the
     *  species identifier is a chemistry-level constant. */
    readonly speciesId: string;
    /** Human-readable label for property panels and dashboards. */
    readonly displayName: string;
    /** Molar mass [kg/mol]. */
    readonly molarMass: number;
    /** Mass density at standard conditions (0 °C, 100 kPa) [kg/m³].
     *  Optional — derivable from `molarMass` via ideal gas when absent. */
    readonly density?: number;
    /** Specific heat at constant pressure, per unit mass [J/(kg·K)]. */
    readonly specificHeat?: number;
    /** Thermal conductivity [W/(m·K)]. */
    readonly thermalConductivity?: number;
    /** Dynamic viscosity [Pa·s]. */
    readonly viscosity?: number;
    /** CAS registry number (e.g. "7727-37-9" for nitrogen). */
    readonly casNumber?: string;
    /** Empirical formula string (e.g. "N₂", "CO₂"). */
    readonly formula?: string;

    // ─── Pollutant attributes (P9.4 redesign 2026-06-08) ─────────────
    // Pollutant status is an ATTRIBUTE on the gas, not a separate node
    // class. A gas with any of the thresholds below set (or a non-empty
    // hazardClass) qualifies as a pollutant for downstream alarm /
    // panel renderers. None of these fields affect the integrator: the
    // mass-balance treats every species uniformly, only the UI layer
    // and gate-condition logic consult the toxicology block.

    /** Occupational Exposure Limit — 8-hour Time-Weighted Average
     *  [ppm]. Undefined / 0 = not regulated. */
    readonly oelTwa?: number;
    /** Short-Term Exposure Limit, 15-minute [ppm]. */
    readonly oelStel?: number;
    /** Immediately Dangerous to Life or Health [ppm]. */
    readonly idlh?: number;
    /** Free-form hazard tag ("voc", "asphyxiant", "irritant",
     *  "carcinogen", "corrosive", ...) consumed by panel renderers
     *  and gate-mode logic. */
    readonly hazardClass?: string;
}

/** Returns true when a gas carries any pollutant-class metadata
 *  (OEL TWA, OEL STEL, IDLH > 0, or a non-empty hazardClass tag).
 *  Replaces the deleted IPollutantMetadata duck-type: pollutant-ness
 *  is now an attribute on every IGasMetadata, queried at runtime. */
export function isPollutantGas(gas: IGasMetadata): boolean {
    if (typeof gas.oelTwa === "number" && gas.oelTwa > 0) return true;
    if (typeof gas.oelStel === "number" && gas.oelStel > 0) return true;
    if (typeof gas.idlh === "number" && gas.idlh > 0) return true;
    if (typeof gas.hazardClass === "string" && gas.hazardClass.length > 0) return true;
    return false;
}

/**
 * Structural guard: any object exposing `id` + `displayName` + a
 * finite `molarMass` qualifies. Optional fields are not checked.
 *
 * Used by composition / atmosphere code to filter wired references
 * to plain GasNodes (vs. pollutants, particulates, or unrelated
 * graph items the user might erroneously drop on a gas slot).
 */
export function isGasMetadata(v: unknown): v is IGasMetadata {
    if (!v || typeof v !== "object") return false;
    const c = v as Partial<IGasMetadata>;
    return (
        typeof c.speciesId === "string" &&
        c.speciesId.length > 0 &&
        typeof c.displayName === "string" &&
        typeof c.molarMass === "number" &&
        Number.isFinite(c.molarMass) &&
        c.molarMass > 0
    );
}
