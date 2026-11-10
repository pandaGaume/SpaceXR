/**
 * Where projections are registered and looked up.
 *
 * A flat map keyed by id, deliberately. The registry's job is to make the
 * extension point real rather than intended: a projection written outside
 * this directory, in a plugin or an application, registers here and is
 * resolved by every consumer without a single edit to the core.
 */
import { resolveQuantityKind, resolveUnit, type IUnitTag, type Unit } from "../math.units";
import type { IUnitProjection } from "./projection.interfaces";

const REGISTRY = new Map<string, IUnitProjection<unknown>>();

/**
 * Register a projection under its own id.
 *
 * Re-registering the same id replaces the previous entry, so an application
 * can substitute a house variant of a built-in without forking it.
 */
export function registerUnitProjection<T>(projection: IUnitProjection<T>): void {
    REGISTRY.set(projection.id, projection as IUnitProjection<unknown>);
}

/** The projection registered under `id`, or undefined. */
export function getUnitProjection<T>(id: string): IUnitProjection<T> | undefined {
    return REGISTRY.get(id) as IUnitProjection<T> | undefined;
}

/** Every registered id, for tooling that enumerates the available targets. */
export function unitProjectionIds(): ReadonlyArray<string> {
    return [...REGISTRY.keys()];
}

/**
 * Project a serializable unit tag onto one target, in one call.
 *
 * The convenience most callers want: they hold an `IUnitTag` from a
 * declaration, not a resolved `Unit` and a quantity kind. Returns undefined
 * when the tag does not resolve, when no projection is registered under that
 * id, or when the target has no equivalent, and the three cases are
 * deliberately not distinguished: in all of them there is nothing correct to
 * emit, and a caller that needs to know why has `resolveUnit` and
 * `getUnitProjection` to ask with.
 */
export function projectUnit<T>(tag: IUnitTag, projectionId: string): T | undefined {
    const projection = getUnitProjection<T>(projectionId);
    if (!projection) return undefined;
    const unit: Unit | undefined = resolveUnit(tag);
    if (!unit) return undefined;
    const kind = resolveQuantityKind(tag.quantity);
    return kind ? projection.project(unit, kind) : undefined;
}
