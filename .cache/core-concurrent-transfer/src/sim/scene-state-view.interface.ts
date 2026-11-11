/**
 * Scene state view — runtime contract.
 *
 * The view is the LIVE binding consumers (motors, sensors, future
 * gates, atmospheres, dashboards) read each tick to obtain the
 * environmental context of their owning scene. It is intentionally
 * NOT a frozen snapshot: each accessor is a getter that re-reads its
 * underlying source on every call, so a temperature wired to a
 * publisher node, a worldPosition driven by a kinematics chain, or an
 * atmosphere whose state evolves via the integrator are all visible
 * to consumers on the same tick they change.
 *
 * The view is built once per session at reset() by the SceneItem (the
 * editor-side descriptor — a GraphItem, NOT a RuntimeNode). Building
 * the view captures references to the publisher nodes and to the
 * Atmosphere (and resolves the implicit 3D parent chain via Sim.Graph
 * nesting); it does not copy values. The same view instance is reused
 * across ticks; consumers cache the reference at fire-loop bind time
 * and only pay the getter cost when they actually read a field.
 *
 * A SceneItem with no wired publisher for a given latent serves its
 * `@cloneable` default as the static value through the same getter.
 *
 * V1 scope:
 *   - gravity, temperature, pressure, timeScale: scalars, optionally
 *     pilot-driven via a source node ref.
 *   - (transform is NOT carried here: a world object's pose is the
 *     geometry node chain `parent.worldTransform() × local`, with the
 *     scene wired as the resident's `parent` at bind. The view holds
 *     only world-fixed latents.)
 *   - atmosphere: direct reference to an AtmosphereStateNode (or
 *     null). Consumers read its observables via standard runtime
 *     cables; this ref serves identification + metadata lookup.
 *   - effectiveHz: aggregated max(requiredHz) over owned IIntegrable
 *     leaves; consumed by Sim.Graph to size sub-stepping.
 *   - parent: the enclosing scene in the 3D tree, derived from the
 *     Sim.Graph nesting (the scene referenced by the enclosing
 *     Sim.Graph's scene input). null at the root.
 */

import { Cartesian3 } from "../geometry/geometry.cartesian";
import type { ICartesian3 } from "../geometry/geometry.interfaces";
import { Frequency, Pressure, Temperature } from "../math/math.units";
import type { IIntegrable } from "./sim.interfaces";

/**
 * Aggregated snapshot the SceneStateView reads off a wired atmosphere
 * to drive the Scene's temperature / pressure / density displays.
 *
 * Any concrete Atmosphere node (the multi-layer `Physics.Scene:atmosphere`
 * container or any future single-layer variant) exposes a
 * `sampleAggregates()` method returning this shape. The SceneItem
 * stores a reference to the bound atmosphere at session build and
 * the SceneStateView source-resolver thunks invoke `sampleAggregates()`
 * whenever a consumer reads `temperature` / `pressure` / `density`.
 *
 * Session-free by design: layers own their own temperature and
 * compute their pressure from current mass + volume + their own T,
 * so there is no cycle through the SceneStateView. A null binding
 * (no atmosphere wired) sends consumers to the SceneItem's editable
 * defaults instead.
 */
export interface IAtmosphereAggregate {
    /** Pa, volume-weighted across active layers. */
    readonly pressure: number;
    /** K, volume-weighted across active layers. */
    readonly temperatureK: number;
    /** kg/m³, total mass / total volume across active layers. */
    readonly density: number;
    /** Sum of layer masses, kg. */
    readonly mass: number;
    /** Sum of layer volumes, m³. */
    readonly volumeM3: number;
}

/**
 * Duck-type for atmosphere nodes the SceneStateView can pull
 * aggregates from. A concrete Atmosphere class satisfies this by
 * implementing `sampleAggregates()` — the SceneItem queries it
 * lazily on each scene-state read.
 */
export interface IAtmosphereAggregator {
    sampleAggregates(): IAtmosphereAggregate;
}

/** Structural guard for `IAtmosphereAggregator`. */
export function isAtmosphereAggregator(v: unknown): v is IAtmosphereAggregator {
    return !!v && typeof v === "object" && typeof (v as IAtmosphereAggregator).sampleAggregates === "function";
}

/** Earth-surface sane default for an unconfigured scene's gravity,
 *  in m/s². Vector quantities are not Quantity-wrapped (V1 scope);
 *  the unit is part of the contract on the `ICartesian3` axes.
 *  Frozen so an accidental `default.gravity.z = 0` from a buggy
 *  consumer poisons no one else. */
export const DEFAULT_GRAVITY: ICartesian3 = Object.freeze(new Cartesian3(0, 0, -9.81));

/**
 * Earth-surface default ambient temperature, declared as a `Temperature`
 * Quantity rather than a bare number so the unit travels with the value
 * across the codebase (no more "is this K or °C?" guessing at consumer
 * sites). The instance is frozen — any consumer that needs to mutate
 * should `clone()` first.
 *
 * 293.15 K = 20 °C, the conventional engineering lab default.
 */
export const DEFAULT_TEMPERATURE: Temperature = Object.freeze(new Temperature(293.15, Temperature.Units.k)) as Temperature;

/**
 * Earth sea-level default ambient pressure (1 atm ≡ 101325 Pa). Frozen
 * `Pressure` Quantity, same rationale as `DEFAULT_TEMPERATURE`.
 */
export const DEFAULT_PRESSURE: Pressure = Object.freeze(new Pressure(101325, Pressure.Units.Pa)) as Pressure;

/**
 * Earth sea-level default ambient air density [kg/m³]. Same role as
 * DEFAULT_TEMPERATURE / DEFAULT_PRESSURE: the SceneStateView's density
 * accessor falls back to this when no atmosphere is wired AND no
 * dynamic source supplies one. 1.225 kg/m³ is the U.S. Standard
 * Atmosphere value at sea level, 15 °C.
 */
export const DEFAULT_DENSITY = 1.225;

/** Sim-to-wall time multiplier neutral value (dimensionless). Kept as
 *  a bare number because the underlying quantity has no unit. */
export const DEFAULT_TIME_SCALE: number = 1.0;

/**
 * Floor on the runner's derived sample rate so an unconfigured graph
 * still ticks at a sensible visualisation cadence. 60 Hz mirrors the
 * default display refresh, which avoids visible jitter when no leaf
 * has declared a stronger `requiredHz`. Frozen `Frequency` Quantity.
 */
export const MIN_EFFECTIVE_HZ: Frequency = Object.freeze(new Frequency(60, Frequency.Units.Hz)) as Frequency;

/**
 * Live read-through view of a scene's runtime state. Consumers hold a
 * reference (resolved once at session bind) and call getters per tick.
 *
 * Every getter is intentionally O(1) and side-effect-free at the
 * implementation level: a wired source resolves to `publisher.lastPublished(slot)`
 * accessor, an unwired latent resolves to `this._sceneItem.<field>`. No
 * caching, no per-tick allocation for scalars, no observers — the
 * freshness IS the dataflow itself. Transform getters DO allocate
 * (one ITransform + one Matrix4 per access if you read both); that is
 * acceptable because each consumer reads them at most a few times
 * per `fire()`.
 *
 * The view never extends `IGraphItem` and never appears on the canvas.
 * It is a pure binding object materialised from the editor model at
 * session build, lifetime tied to the session.
 */
export interface SceneStateView {
    /** Stable identifier of the originating SceneItem; useful for
     *  diagnostic UIs and for cross-Sim.Graph proxy resolution (atmosphere
     *  sharing). */
    readonly id: string;

    /** The enclosing scene in the 3D tree, resolved at session build
     *  from the Sim.Graph nesting chain. `null` when this scene is at
     *  the editor's root canvas (no enclosing Sim.Graph). */
    readonly parent: SceneStateView | null;

    /** The owning scene's atmosphere, if one is wired on its
     *  `atmosphereIn` slot. Consumers read the atmosphere's
     *  observables via the standard runtime port mechanism (the
     *  cable connecting them); this reference exists for
     *  identification, for gate-node bidirectional lookups, and for
     *  the proxy generation inside child Sim.Graphs. */
    readonly atmosphere: IIntegrable | null;

    // ── Scalar latents (live read-through, may evolve per tick) ───────

    /** Body-frame gravity acceleration in m/s². Vector field — not
     *  Quantity-wrapped (V1 scope). Static fallback unless a
     *  `gravitySourceId` is wired on the SceneItem (V1: static only;
     *  dynamic gravity source deferred to V3). */
    readonly gravity: ICartesian3;

    /** Ambient temperature as a `Temperature` Quantity. Consumers call
     *  `.getValue(Temperature.Units.k)` to obtain kelvin (the canonical
     *  storage unit), `.getValue(Temperature.Units.c)` for celsius,
     *  etc. Each getter access returns a fresh Quantity instance over
     *  the SceneItem's live storage; mutating the Quantity has no
     *  effect on the SceneItem. */
    readonly temperature: Temperature;

    /** Ambient pressure as a `Pressure` Quantity. Canonical storage in
     *  pascal. Same access semantics as `temperature`. When a wired
     *  Atmosphere is bound, this resolves to the atmosphere's volume-
     *  weighted aggregate pressure (live, updated each tick); else it
     *  falls back to the SceneItem's editable. */
    readonly pressure: Pressure;

    /** Ambient mass density [kg/m³]. Plain number — V1 doesn't carry a
     *  Density Quantity through the SceneStateView surface (the
     *  Density type exists in math.units but the scene-level reading
     *  is rarely converted between units). When a wired Atmosphere is
     *  bound, resolves to its mass / volume aggregate; else falls back
     *  to DEFAULT_DENSITY. */
    readonly density: number;

    /** Sim-clock multiplier (mirror of UE5 `WorldSettings.TimeDilation`).
     *  Dimensionless — kept as a plain number. Static for V1; dynamic
     *  source deferred. */
    readonly timeScale: number;

    /** Sample rate this scene wants the runner / containing Sim.Graph
     *  to tick at, as a `Frequency` Quantity. Derived from
     *  `max(requiredHz)` over the IIntegrable leaves directly owned by
     *  this scene's solvers, with a floor of `MIN_EFFECTIVE_HZ`.
     *  Canonical storage in hertz. Sim.Graph reads
     *  `.getValue(Frequency.Units.Hz)` once per fire to compute the
     *  sub-stepping ratio K = childHz / parentHz. */
    readonly effectiveHz: Frequency;

    // NOTE: the 3D transform is NOT carried here. The single source of
    // truth for a world object's pose is the geometry node chain
    // (`IHasTransform.worldTransform()` = `parent.worldTransform() x local`),
    // with the scene node wired as the resident's `parent` at session bind.
    // The SceneStateView carries only environmental LATENTS (gravity,
    // temperature, ...), which are world-fixed and orthogonal to pose.
}

/**
 * Structural guard for `SceneStateView`. Used by tooling that
 * inspects whatever object a session returns from `getSceneStateView`;
 * does not catch every nuance (it is not a perfect runtime mirror of
 * the interface), but rejects obvious type mistakes.
 *
 * The scalar latents (temperature / pressure / effectiveHz) are
 * Quantity instances on a real view, so we check `instanceof` against
 * their concrete classes. `timeScale` stays dimensionless and number-
 * typed. Gravity is an ICartesian3 with `{x, y, z}` axes (Cartesian3
 * instances satisfy the shape structurally, as do any literals
 * returned by a dynamic source resolver).
 */
export function isSceneStateView(v: unknown): v is SceneStateView {
    if (!v || typeof v !== "object") return false;
    const c = v as Partial<SceneStateView>;
    if (typeof c.id !== "string") return false;
    if (typeof c.timeScale !== "number") return false;
    if (typeof c.density !== "number") return false;
    if (!(c.temperature instanceof Temperature)) return false;
    if (!(c.pressure instanceof Pressure)) return false;
    if (!(c.effectiveHz instanceof Frequency)) return false;
    if (!c.gravity || typeof c.gravity !== "object") return false;
    if (typeof (c.gravity as ICartesian3).x !== "number") return false;
    if (typeof (c.gravity as ICartesian3).y !== "number") return false;
    if (typeof (c.gravity as ICartesian3).z !== "number") return false;
    return true;
}

/** Anchor / slot names reserved on `SceneItem`. Centralised here so the
 *  editor renderer (config-link routing) and the runtime binder both
 *  agree on the same string literals. */
export const SCENE_ANCHOR_OUT = "scene_out";
export const SCENE_ANCHOR_IN = "scene_in";
export const ATMOSPHERE_ANCHOR_IN = "atmosphere_in";
export const SOLVER_ANCHOR_IN_PREFIX = "solver_in_";
export const SHARED_ANCHOR_IN_PREFIX = "shared_in_";
export const SOLVER_ANCHOR_OUT = "solver_out";
export const ATMOSPHERE_ANCHOR_OUT = "atmosphere_out";
export const SHARED_ANCHOR_OUT = "scene_share_out";
