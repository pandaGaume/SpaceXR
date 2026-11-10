/**
 * Solver attachment helper — leaf-centric resolution.
 *
 * Single entry point used by:
 *   - `SimGraphNode.reset()` (sub-graph case): scene descriptors come
 *     from the wrapping Sim.Graph's bound Scene.
 *   - `attachRootScopedSolvers` in the editor's graph-session-builder
 *     (root canvas case): scene descriptors come from the SceneItem
 *     sitting at root.
 *
 * Steps:
 *   1. Walk the graph, collect IIntegrable leaves grouped by their
 *      declared `solverKind` (default = DEFAULT_SOLVER_KIND).
 *   2. For each kind, find a matching descriptor in the Scene's list.
 *      When missing AND the registry has a factory for that kind,
 *      AUTO-FILL with `{ kind, options: SOLVER_REGISTRY.defaultOptions(kind) }`.
 *      When missing AND the registry has no factory, log a warning
 *      and skip the leaves (they stay at initialArmatureCurrent / initialAngularVelocity / ...).
 *   3. Merge per-leaf `solverOptions` into the descriptor's `options`
 *      using `mergeSolverOptions` (tightening rules).
 *   4. Ask `SOLVER_REGISTRY.create(kind, mergedOptions, leaves)` for an
 *      `ISolver` instance and return the list. Callers attach each
 *      returned solver to their session via `session.attachSolver`.
 *
 * Caller is responsible for `attachSolver` because the session lives
 * one frame above this helper (the inner session for SimGraphNode, the
 * outer session for the root). Returning the solvers lets the caller
 * also tear them down on next bind without re-running the resolution.
 */

import type { IRuntimeGraph } from "../execution/execution.interfaces";
import type { IIntegrable, ISolver } from "./sim.interfaces";
import { isIntegrable } from "./sim.interfaces";
import { DEFAULT_SOLVER_KIND, ISolverDescriptor, mergeSolverOptions, SOLVER_REGISTRY } from "./solver.registry";

/**
 * Walk the graph, build a `kind → leaves` index. Leaves that don't
 * declare `solverKind` fall into the `DEFAULT_SOLVER_KIND` bucket.
 */
function groupLeavesByKind(graph: IRuntimeGraph): Map<string, IIntegrable[]> {
    const groups = new Map<string, IIntegrable[]>();
    for (const node of graph.nodes) {
        if (!isIntegrable(node)) continue;
        const kind = (node as IIntegrable).solverKind ?? DEFAULT_SOLVER_KIND;
        let bucket = groups.get(kind);
        if (!bucket) {
            bucket = [];
            groups.set(kind, bucket);
        }
        bucket.push(node);
    }
    return groups;
}

/**
 * Build the list of `ISolver` instances for `graph`, drawing options
 * from `sceneDescriptors` and auto-filling missing kinds from the
 * `SOLVER_REGISTRY`. Returns an empty array when no IIntegrable leaves
 * are present.
 *
 * The caller attaches each returned solver to its session.
 */
export function buildSolverAttachmentsForGraph(sceneDescriptors: ReadonlyArray<ISolverDescriptor>, graph: IRuntimeGraph): ISolver[] {
    const groups = groupLeavesByKind(graph);
    if (groups.size === 0) return [];

    const solvers: ISolver[] = [];
    for (const [kind, leaves] of groups) {
        // 1. Pick a descriptor: prefer the Scene's, fall back to a
        //    registry-default descriptor if the kind is registered.
        let desc = sceneDescriptors.find((d) => d.kind === kind);
        if (!desc) {
            if (!SOLVER_REGISTRY.hasKind(kind)) {
                // eslint-disable-next-line no-console
                console.warn(`[solver-attachment] no factory registered for kind "${kind}", ` + `${leaves.length} leaves will not be integrated`);
                continue;
            }
            desc = { kind, options: SOLVER_REGISTRY.defaultOptions(kind) };
        }

        // 2. Merge per-leaf overrides into the descriptor's options.
        const leafOverrides = leaves.map((l) => l.solverOptions);
        const mergedOptions = mergeSolverOptions(desc.options, leafOverrides);

        // 3. Instantiate via the registry's factory.
        const solver = SOLVER_REGISTRY.create(kind, mergedOptions, leaves);
        if (solver) solvers.push(solver);
    }
    return solvers;
}

/**
 * Convenience: collect descriptors from an array of `ISolverDescriptorSource`-
 * compatible objects (SolverItem GraphItems). Tolerates the array
 * containing nulls (filter-friendly).
 */
export function collectDescriptors(sources: ReadonlyArray<{ toSolverDescriptor?: () => ISolverDescriptor } | null | undefined>): ISolverDescriptor[] {
    const descriptors: ISolverDescriptor[] = [];
    for (const source of sources) {
        if (!source || typeof source.toSolverDescriptor !== "function") continue;
        try {
            descriptors.push(source.toSolverDescriptor());
        } catch {
            // Bad descriptor source — silently skip rather than break
            // the whole attachment pass.
        }
    }
    return descriptors;
}

/**
 * Inverse of `buildSolverAttachmentsForGraph`: synonym kept as a
 * single export point so callers don't have to import from two places.
 */
export { mergeSolverOptions } from "./solver.registry";
export type { ISolverDescriptor, ISolverOptions } from "./solver.registry";
