import { IOlink } from "../graph/graph.interfaces";
import { ApplyTo, isApplyToRelation } from "../graph/graph.olink";
import { IChannel, IDeclaresPorts, IPortDescriptor, ISession, inSlotOf } from "../execution/execution.interfaces";
import type { ICartesian, ICartesian3 } from "../geometry/geometry.interfaces";
import type { Nullable } from "../types";
import { TransformNode } from "./transform.node";

/**
 * Canonical fault descriptor carried on the variadic `fault_N` ports.
 *
 *   target   the physical quantity the fault perturbs. By convention:
 *            "tau"  → additive torque [Nm]   (bearing, gear, shaft, modulator)
 *            "flux" → multiplicative magnet-flux modulation (sag, eccentricity)
 *            "R"    → stator/armature resistance multiplicative delta
 *            "L"    → inductance multiplicative delta
 *            "backEmfConstant"   → back-EMF constant multiplicative delta (demag)
 *            "torqueConstant"   → torque constant multiplicative delta
 *            "b"    → viscous friction additive delta [Nm·s/rad]
 *            "J"    → inertia additive delta [kg·m²]
 *            "broken_bar" → induction-machine rotor-bar asymmetry, ...
 *            Subclasses MAY introduce model-specific targets. A subclass
 *            decides which targets are physically meaningful for it by
 *            overriding `acceptFault` (e.g. a brushless motor rejects
 *            "broken_bar", which only an induction machine models).
 *
 *   value    the numerical perturbation, units context-dependent on target.
 *
 * A plain `number` token auto-wraps to `{ target: "tau", value }`, the V1
 * lingua franca every scalar fault generator (Bearing, Shaft, Gear,
 * Fault.modulator) still emits.
 */
export interface IFaultDescriptor {
    target: string;
    value: number;
}

/** Lightweight structural guard; matches duck-typed objects too. */
export function isFaultDescriptor(v: unknown): v is IFaultDescriptor {
    if (!v || typeof v !== "object") return false;
    const o = v as Partial<IFaultDescriptor>;
    return typeof o.target === "string" && typeof o.value === "number";
}

/**
 * Runtime context handed to a fault operator's `applyTo`: the integration
 * timestep, the latent body-frame gravity of the target's scene (undefined when
 * none is bound), and an accumulator the fault writes its effect into (target
 * -> summed value, read back by the target model via `getFault`).
 */
export interface IFaultContext {
    readonly dt: number;
    readonly bodyGravity?: ICartesian3;
    accumulate(target: string, value: number): void;
}

/**
 * A fault OPERATOR. Instead of publishing an opaque `{ target, value }`
 * descriptor on a port, it APPLIES its physics to a target MODEL:
 * `applyTo(target, ctx)` reads the target's PROPERTIES directly (e.g.
 * `motor.rotorMass`, `motor.airGap`) plus its own tuning editables plus the
 * runtime `ctx`, and accumulates its effect via `ctx.accumulate`. Linked to its
 * target by an `ApplyTo` relation; the target drives `link.oini.applyTo(this,
 * ctx)`. A property is read from the model, never published as a port.
 */
export interface IFault {
    applyTo(target: unknown, ctx: IFaultContext): void;
    /** Ontology type of the fault, consulted by the target's `acceptsFault`. */
    readonly faultType?: string;
}

/** Slot prefix that identifies a variadic fault input. */
const FAULT_SLOT_PREFIX = "fault_";

/** Returns true when `slot` looks like `fault_<int>`. */
function isFaultSlot(slot: string): boolean {
    if (slot.indexOf(FAULT_SLOT_PREFIX) !== 0) return false;
    const idxStr = slot.slice(FAULT_SLOT_PREFIX.length);
    if (idxStr.length === 0) return false;
    const n = Number(idxStr);
    return Number.isFinite(n) && Number.isInteger(n) && n >= 0;
}

/**
 * Base class for every runtime object that accepts fault perturbations on
 * a variadic `fault_N` input bank. Sits between TransformNode and the
 * concrete motor/sensor classes:
 *
 *     RuntimeNode → TransformNode → FaultableNode → DcMotorDynamicNode
 *                                                 → BldcMotorDynamicNode
 *                                                 → ...
 *
 * On every fire(): `super.fire()` (the TransformNode hop) consumes
 * local/parentWorld and publishes the world matrix, then this class
 * iterates opsc again, consumes every wired `fault_N` token, and routes
 * it through `acceptFault()` before accumulating. Plain numbers auto-wrap
 * to target "tau"; structured `{ target, value }` tokens flow through.
 *
 * Subclasses query the accumulator via `getFault(target)` (SUM this tick,
 * 0 if none) and restrict their physically-meaningful targets by
 * overriding `acceptFault`.
 *
 * This is a CORE primitive (previously vendored inside the physics plugin).
 */
export class FaultableNode extends TransformNode implements IDeclaresPorts {
    /** First variadic fault slot. The editor grows fault_1, fault_2, ... */
    public static readonly INPUT_FAULT_0 = "fault_0";

    /** Reusable port block: spread into subclass inputPorts. */
    public static readonly FAULT_INPUT_PORTS: ReadonlyArray<IPortDescriptor> = [{ slot: FaultableNode.INPUT_FAULT_0, optional: true, type: "any" }];

    /** Aggregated transform + fault input ports. */
    public static readonly BASE_INPUT_PORTS: ReadonlyArray<IPortDescriptor> = [...TransformNode.TRANSFORM_INPUT_PORTS, ...FaultableNode.FAULT_INPUT_PORTS];

    /** Faults add no outputs; alias of the transform output block. */
    public static readonly BASE_OUTPUT_PORTS: ReadonlyArray<IPortDescriptor> = TransformNode.TRANSFORM_OUTPUT_PORTS;

    /** Per-tick accumulator: target → summed value. Reset every fire(). */
    private readonly _faultSum: Map<string, number> = new Map();

    public override readonly inputPorts: ReadonlyArray<IPortDescriptor> = FaultableNode.BASE_INPUT_PORTS;
    public override readonly outputPorts: ReadonlyArray<IPortDescriptor> = FaultableNode.BASE_OUTPUT_PORTS;

    public constructor(onsc: Nullable<IOlink[]> = null, opsc: Nullable<IOlink[]> = null, position?: ICartesian) {
        super(onsc, opsc, position);
    }

    /**
     * Decide whether a fault is physically meaningful for THIS model.
     * Default accepts every target. Subclasses override to whitelist the
     * targets their physics actually implements, so an incoherent fault
     * (e.g. a broken-rotor-bar fault wired into a brushless PMSM, which
     * has no cage) is silently ignored rather than corrupting the model.
     *
     *     protected override acceptFault(f: IFaultDescriptor): boolean {
     *         return f.target === "tau" || f.target === "flux";
     *     }
     *
     * Called once per wired-and-ready fault token, before accumulation.
     */
    protected acceptFault(_fault: IFaultDescriptor): boolean {
        return true;
    }

    /**
     * Validate that THIS model accepts a fault OPERATOR (by its `faultType`),
     * before driving its `applyTo`. Default accepts any; subclasses narrow to
     * the fault kinds their physics actually models.
     */
    protected acceptsFault(_fault: IFault): boolean {
        return true;
    }

    /**
     * Returns the accumulated, accepted fault value for `target` this tick
     * (0 when none). Safe to call before fire() in a tick (returns 0).
     */
    protected getFault(target: string): number {
        return this._faultSum.get(target) ?? 0;
    }

    /** Iterate every accepted entry in the accumulator. */
    protected forEachFault(cb: (target: string, value: number) => void): void {
        this._faultSum.forEach((v, k) => cb(k, v));
    }

    public override reset(session: ISession): void {
        super.reset(session);
        this._faultSum.clear();
    }

    public override fire(session: ISession, t: number): void {
        // 1) TransformNode hop: consume local/parentWorld, publish world.
        super.fire(session, t);

        // 2) Reset the accumulator and scan fault_N tokens.
        this._faultSum.clear();

        const links = session.graph.links as ReadonlyArray<IChannel>;
        for (const link of this.opsc<IChannel>()) {
            if (!link.enabled) continue;
            const slot = String(inSlotOf(link));
            if (!isFaultSlot(slot)) continue;
            const idx = links.indexOf(link);
            if (idx < 0 || !session.linkStates[idx].ready) continue;
            const value = session.consume(idx);

            let fault: IFaultDescriptor | null = null;
            if (typeof value === "number") {
                fault = { target: "tau", value };
            } else if (isFaultDescriptor(value)) {
                fault = value;
            }
            if (!fault) continue;

            // Model-coherence filter: drop faults this model does not own.
            if (!this.acceptFault(fault)) continue;

            const prev = this._faultSum.get(fault.target) ?? 0;
            this._faultSum.set(fault.target, prev + fault.value);
        }

        // 3) Drive ApplyTo faults: each linked fault OPERATOR applies its
        //    physics to THIS model, reading the model's PROPERTIES + its own
        //    tuning + the runtime ctx, accumulating its effect into the same
        //    per-tick sum the legacy descriptor path fills.
        // Recognised by ontology id, not by class. The editor bundles core
        // inline while the plugins externalise it, so a link the editor built
        // is not an instance of the class this module sees. Its endpoints and
        // its `type` are right; only `instanceof` disagrees, and it does so
        // silently: every fault would be skipped and the machine would look
        // healthy. See `isApplyToRelation`.
        const applyLinks = this.opsc<ApplyTo>(isApplyToRelation);
        if (applyLinks.length > 0) {
            this._updateGravityCoupling(session);
            const sum = this._faultSum;
            const ctx: IFaultContext = {
                dt: session.dt,
                bodyGravity: this._bodyGravity,
                accumulate(target: string, value: number): void {
                    sum.set(target, (sum.get(target) ?? 0) + value);
                },
            };
            for (const link of applyLinks) {
                const fault = link.oini as unknown as Partial<IFault> | null;
                if (fault && typeof fault.applyTo === "function" && this.acceptsFault(fault as IFault)) {
                    (fault as IFault).applyTo(this, ctx);
                }
            }
        }
    }
}
