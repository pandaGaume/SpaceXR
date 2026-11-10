/**
 * Cross-plugin contract for particulate-matter metadata.
 *
 * Lives in core (NOT in chemistry.interfaces.ts) because particulate
 * matter is solid-phase matter, not a chemical species: its dynamics
 * (settling under gravity, drag, re-suspension, filtration) are
 * physics, and its concrete implementation lives in the physics
 * plugin under `Physics.Particulate:*`. Keeping the contract in core
 * lets any plugin duck-type against it without taking a dependency
 * on the physics-plugin bundle — the same pattern `IGasMetadata`
 * follows.
 *
 * V1 only declares the descriptor SHAPE so the atmosphere's
 * `particulate_in_<k>` config-link slot has a recognisable consumer.
 * No integration logic is wired up yet: a bound ParticulateNode is
 * recorded by the SceneBindingResolver but contributes nothing to
 * the state vector at session bind. V2 will:
 *   - Add a second state segment to AtmosphereStateNode for
 *     particulate mass-loading per size bin [kg/m³].
 *   - Define `delta_particulate_<id>_<k>` variadic input ports.
 *   - Settle / re-suspend via gravity-dependent terms read from
 *     SceneStateView.
 *
 * Forward-compatible fields:
 *   - `characteristicDiameter` [m]: median aerodynamic diameter
 *     (PM2.5 → 2.5e-6, PM10 → 1e-5).
 *   - `density` [kg/m³]: bulk material density (used by V2 settling
 *     velocity / re-suspension calculations).
 *   - `pmClass`: opaque tag ("pm2_5", "pm10", "dust", "smoke").
 */
export interface IParticulateMetadata {
    readonly particulateId: string;
    readonly displayName: string;
    readonly characteristicDiameter?: number;
    readonly density?: number;
    readonly pmClass?: string;
}

/**
 * Structural guard for IParticulateMetadata. Minimal: id + label.
 * The optional fields stay opaque to the runtime in V1.
 */
export function isParticulateMetadata(v: unknown): v is IParticulateMetadata {
    if (!v || typeof v !== "object") return false;
    const c = v as Partial<IParticulateMetadata>;
    return typeof c.particulateId === "string" && c.particulateId.length > 0 && typeof c.displayName === "string";
}
