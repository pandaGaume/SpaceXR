/**
 * Solver Registry — leaf-centric, factory-based.
 *
 * Architecture (refactor 2026-06-09):
 *
 *   Old (solver-centric, push):
 *     - `Rk4SolverNode` was a RuntimeNode with a `leafFilter` glob.
 *     - The SimGraphNode/SceneBindingResolver asked the solver
 *       "claim your leaves" via a regex on each leaf's `typeId`.
 *     - The solver decided who it integrated.
 *
 *   New (leaf-centric, pull):
 *     - Each IIntegrable leaf declares a `solverKind` string
 *       (e.g. `"rk4-adaptive"`).
 *     - A Scene carries SOLVER DESCRIPTORS (kind + common options),
 *       wired via `solver_in_<k>`. These are GraphItem-style
 *       descriptors, not RuntimeNodes; they don't fire().
 *     - At session bind, an attachment helper groups leaves by their
 *       declared kind, resolves a descriptor from the Scene's list
 *       (or auto-creates one from this registry's defaults when the
 *       Scene doesn't carry that kind), and asks the registered
 *       factory to instantiate an ISolver bound to that leaf group.
 *
 * What the registry holds:
 *   - kind → factory function `(mergedOptions, leaves) → ISolver`
 *   - kind → default options (used when auto-creating a descriptor)
 *
 * What "stateless" means here:
 *   The SOLVER INSTANCE carries options + transient run state (current
 *   y, accumulator, lastStep diagnostic), but it carries NO persistent
 *   simulation state. State persistence lives in the IIntegrable leaves'
 *   `gatherState / writeState`. A solver can be reconstructed from
 *   scratch at every session.start() without losing simulation state,
 *   as long as the leaves keep their fields. This lets the factory
 *   pattern work: solvers are cheap to create and dispose.
 *
 * What "common options + per-leaf overrides" means:
 *   The descriptor carries solver-wide defaults (e.g. `tolerance = 1e-6`,
 *   `maxStep = 0.01`). Each leaf can also expose `solverOptions` that
 *   tighten those defaults for ITS slice of the integration. The factory
 *   is responsible for merging: typically tolerance = min over all leaves,
 *   maxStep = min, etc. This lets a fast leaf (e.g. a PWM-driven motor)
 *   request a tight step cap without forcing every other leaf in the
 *   same solver to honor it (the solver still runs ONE step for all,
 *   but at the tightest cap requested).
 */

import type { IIntegrable, ISolver } from "./sim.interfaces";

// =====================================================================
// Options + Descriptor
// =====================================================================

/**
 * Solver-tuning options. Free-form bag so each solver kind can declare
 * its own keys without modifying this interface. Known keys honored by
 * the built-in solvers:
 *
 *   tolerance — embedded-error threshold per accepted step. Smaller =
 *               more sub-steps, tighter accuracy. Tightening rule: min.
 *   maxStep   — hard cap on dt [s]. Tightening rule: min.
 *   minStep   — floor on dt before the solver gives up [s]. Tightening
 *               rule: max (a larger floor leads to earlier give-up).
 *   jacobian  — optional kind-specific hint ("auto", "analytic", ...).
 *
 * Solver-kind-specific options can be added freely (e.g. a Rosenbrock
 * solver could expose `stagecount`); the factory is responsible for
 * recognising and merging the options it understands.
 */
export interface ISolverOptions {
    readonly tolerance?: number;
    readonly maxStep?: number;
    readonly minStep?: number;
    readonly [key: string]: unknown;
}

/**
 * Parameter carrier wired on a Scene. A SolverItem (GraphItem) returns
 * one of these from its `toDescriptor()` method; the attachment helper
 * collects them at session bind.
 */
export interface ISolverDescriptor {
    readonly kind: string;
    readonly options: ISolverOptions;
}

/**
 * Anything that can produce a descriptor. SolverItem classes implement
 * this; the attachment helper duck-types on it so plugins can introduce
 * their own descriptor sources without coupling to this file.
 */
export interface ISolverDescriptorSource {
    toSolverDescriptor(): ISolverDescriptor;
}

/** Type guard for `ISolverDescriptorSource`. */
export function isSolverDescriptorSource(x: unknown): x is ISolverDescriptorSource {
    return !!x && typeof (x as ISolverDescriptorSource).toSolverDescriptor === "function";
}

// =====================================================================
// Factory + Registry
// =====================================================================

/**
 * Factory function: given the merged options for THIS solver instance
 * AND the IIntegrable leaves it owns, build and initialise a ready-to-
 * attach `ISolver`. The factory is responsible for:
 *
 *   1. Calling `solver.initialize(leaves, t0)` if applicable.
 *   2. Picking sensible defaults for any option not present in
 *      `mergedOptions` (the registry's `defaultOptions` already
 *      pre-fills the kind's standard set; the factory tops up any
 *      kind-specific keys).
 *   3. Returning the solver instance; null when the leaves list is
 *      empty (the caller skips zero-leaf attachments to avoid no-op
 *      solvers).
 */
export type SolverFactoryFn = (mergedOptions: ISolverOptions, leaves: ReadonlyArray<IIntegrable>) => ISolver | null;

/**
 * Per-kind registration entry.
 */
interface SolverRegistration {
    factory: SolverFactoryFn;
    defaults: ISolverOptions;
}

/**
 * Module-level singleton. Plugins register at activate() time:
 *
 *     SOLVER_REGISTRY.register("rk4-adaptive", {
 *         factory: (opts, leaves) => {
 *             const s = new RK4AdaptiveSolver({...opts});
 *             s.initialize(leaves, 0);
 *             return s;
 *         },
 *         defaults: { tolerance: 1e-6, maxStep: 1e-2 },
 *     });
 *
 * Leaves declare `solverKind = "rk4-adaptive"`; the attachment helper
 * consults this registry to instantiate.
 */
class SolverRegistry {
    private readonly _entries: Map<string, SolverRegistration> = new Map();

    public register(kind: string, registration: SolverRegistration): void {
        this._entries.set(kind, registration);
    }

    public unregister(kind: string): void {
        this._entries.delete(kind);
    }

    public hasKind(kind: string): boolean {
        return this._entries.has(kind);
    }

    public defaultOptions(kind: string): ISolverOptions {
        return { ...(this._entries.get(kind)?.defaults ?? {}) };
    }

    public create(kind: string, options: ISolverOptions, leaves: ReadonlyArray<IIntegrable>): ISolver | null {
        const entry = this._entries.get(kind);
        if (!entry) return null;
        if (leaves.length === 0) return null;
        try {
            return entry.factory(options, leaves);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn(`[solver-registry] factory for "${kind}" threw:`, e);
            return null;
        }
    }

    public listKinds(): ReadonlyArray<string> {
        return [...this._entries.keys()];
    }
}

/**
 * Cross-bundle singleton pinch.
 *
 * Plugins (physics, control, ...) load this module through the
 * `spikypanda-core` UMD external, getting one instance. The nodeeditor
 * bundle INLINES the core source via webpack alias (see
 * `packages/dev/nodeeditor/webpack.config.js`), getting a second
 * instance. Without the global pinch, plugin-control would register
 * `"rk4-adaptive"` on instance A, and nodeeditor's attachment helper
 * would consult instance B (empty) — auto-fill would always fail and
 * IIntegrable leaves would never get integrated.
 *
 * The Symbol.for key is content-stable across module-loading paths,
 * so both module instances reach the same SolverRegistry object.
 */
const GLOBAL_SOLVER_REGISTRY_KEY = Symbol.for("spikypanda.solver-registry");
type GlobalSlot = { [k: symbol]: SolverRegistry | undefined };
const __globalSlot = globalThis as unknown as GlobalSlot;
if (!__globalSlot[GLOBAL_SOLVER_REGISTRY_KEY]) {
    __globalSlot[GLOBAL_SOLVER_REGISTRY_KEY] = new SolverRegistry();
}
export const SOLVER_REGISTRY: SolverRegistry = __globalSlot[GLOBAL_SOLVER_REGISTRY_KEY] as SolverRegistry;

/**
 * The canonical fallback kind. Used by IIntegrable leaves that don't
 * declare a solverKind, and by the attachment helper as the auto-fill
 * target when a Scene carries no descriptor at all. The plugin-control
 * package registers a factory for this kind in its activate(); when
 * plugin-control is not loaded, the attachment helper logs a warning
 * and leaves the leaves un-integrated.
 */
export const DEFAULT_SOLVER_KIND = "rk4-adaptive";

// =====================================================================
// Option merging helpers
// =====================================================================

/**
 * Default merge modulationStrategy applied by the attachment helper before
 * calling the factory:
 *
 *   For each numeric option key present on at least one leaf:
 *     tolerance, maxStep   → take the MIN (most restrictive)
 *     minStep              → take the MAX (most restrictive)
 *     anything else        → last write wins (leaf overrides
 *                            descriptor in encounter order)
 *
 * Factories are free to disregard / re-merge if they need different
 * rules; this is just a convenient default applied before the factory
 * is called.
 */
export function mergeSolverOptions(base: ISolverOptions, leafOverrides: ReadonlyArray<ISolverOptions | undefined>): ISolverOptions {
    const merged: Record<string, unknown> = { ...base };
    for (const overrides of leafOverrides) {
        if (!overrides) continue;
        for (const [key, val] of Object.entries(overrides)) {
            if (val === undefined) continue;
            const curRaw = merged[key];
            if (key === "tolerance" || key === "maxStep") {
                const cur = typeof curRaw === "number" ? curRaw : Infinity;
                merged[key] = Math.min(cur, val as number);
            } else if (key === "minStep") {
                const cur = typeof curRaw === "number" ? curRaw : 0;
                merged[key] = Math.max(cur, val as number);
            } else {
                merged[key] = val;
            }
        }
    }
    return merged as ISolverOptions;
}
