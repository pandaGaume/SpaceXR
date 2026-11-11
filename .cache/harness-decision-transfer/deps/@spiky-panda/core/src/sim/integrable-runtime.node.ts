import { cloneable } from "../graph/graph.interfaces";
import { editable, viewable } from "../graph/graph.editor";
import { RuntimeNode } from "../execution/execution.node";
import type { IHasSampleRateRequirement } from "./sim.interfaces";

/**
 * `IntegrableRuntimeNode` — base for any RuntimeNode that participates
 * in physics-style time integration and therefore wants to advertise a
 * required sample rate to the enclosing SimGraphNode.
 *
 * Bundles three concerns so subclasses (motors, gates, atmospheres,
 * sensors, ...) don't re-implement them:
 *
 *   1. IDeclaresPorts — inherited from RuntimeNode (already provides
 *      inputPorts / outputPorts arrays + the @port-style metadata).
 *
 *   2. IIntegrable — declared structurally by the subclass. The base
 *      class does NOT add stateSize / gatherState / writeState / rhs:
 *      those are node-specific and remain on the leaf. Non-IIntegrable
 *      participants in the sim (e.g. AtmosphereGate after the 2026-06-09
 *      refactor, which forward-Eulers on session.dt) still extend this
 *      class because the sample-rate plumbing is what they share.
 *
 *   3. IHasSampleRateRequirement — fully implemented here, with the
 *      following two-state model:
 *
 *      - `computeRequiredHz()` (protected, virtual). The PARAMETER-
 *        DERIVED minimum sample rate. Default returns 100 Hz; nodes
 *        with dynamics that scale with physical parameters override
 *        this. For example, DcMotorDynamicNode computes from L/R
 *        (electrical time constant) and J/b (mechanical time constant)
 *        so the editor's effectiveHz tracks the user's parameter edits
 *        automatically.
 *
 *      - The user can PIN a manual value via the `requiredSampleRateHz` editable.
 *        While pinned, `requiredHz` returns the manual value regardless
 *        of what `computeRequiredHz()` would say. To unpin, the user
 *        enters 0 (or any non-positive / NaN value): `requiredSampleRateHz` then
 *        reverts to the computed value, and the panel will track it as
 *        parameters change.
 *
 *        The `requiredSampleRateHzUserDefined` viewable surfaces the pinned
 *        state to the property panel so the user knows whether the
 *        displayed value is locked.
 *
 * Subclasses that already have a strict deeper base class (e.g. motors
 * extending `FaultableNode` extending `TransformNode`) cannot extend
 * this class directly; for those cases the boilerplate is duplicated
 * per node. AtmosphereLayerNode + AtmosphereGateNode extend
 * `RuntimeNode` directly and benefit from the migration.
 */
export class IntegrableRuntimeNode<B = unknown> extends RuntimeNode<B> implements IHasSampleRateRequirement {
    // ── User-override state ────────────────────────────────────────
    //
    // _requiredHzValue is the manually-pinned rate; 0 means "no pin,
    // use computed". _requiredHzUserDefined is the explicit toggle:
    // we keep it separate so a future config-load can restore pinned
    // state distinct from a transient default.
    @cloneable protected _requiredHzValue: number = 0;
    @cloneable protected _requiredHzUserDefined: boolean = false;

    /**
     * Default required sample rate when the user has not pinned a
     * manual value. Subclasses override to derive from their physical
     * parameters (L/R for motors, residence time for gates, ...).
     * Default = 100 Hz, a sensible floor for slow integrators.
     */
    protected computeRequiredHz(): number {
        return 100;
    }

    /**
     * Effective required sample rate. Branches on user-pin state:
     *   pinned + positive value  → return the pinned value
     *   otherwise                → return computeRequiredHz()
     */
    public get requiredHz(): number {
        if (this._requiredHzUserDefined && this._requiredHzValue > 0) {
            return this._requiredHzValue;
        }
        return this.computeRequiredHz();
    }

    /**
     * Property-panel viewable: read returns the effective requiredHz
     * (pinned value or computed). Write either pins a new value or
     * unpins (when a non-positive / NaN value is entered).
     */
    @editable("number", { unit: { quantity: "Frequency", unit: "Hz" } })
    public get requiredSampleRateHz(): number {
        return this.requiredHz;
    }
    public set requiredSampleRateHz(v: number) {
        if (!Number.isFinite(v) || v <= 0) {
            // Unpin: revert to computed.
            if (this._requiredHzUserDefined || this._requiredHzValue !== 0) {
                const prev = this.requiredHz;
                this._requiredHzUserDefined = false;
                this._requiredHzValue = 0;
                this.notifyPropertyChanged("requiredSampleRateHz", prev, this.requiredHz);
            }
            return;
        }
        const prev = this.requiredHz;
        if (this._requiredHzValue !== v || !this._requiredHzUserDefined) {
            this._requiredHzValue = v;
            this._requiredHzUserDefined = true;
            this.notifyPropertyChanged("requiredSampleRateHz", prev, v);
        }
    }

    /**
     * Panel-only flag: true when the user has pinned a manual value.
     * Lets the panel render a "(pinned)" badge or a reset button next
     * to requiredSampleRateHz.
     */
    @viewable("boolean")
    public get requiredSampleRateHzUserDefined(): boolean {
        return this._requiredHzUserDefined;
    }

    /**
     * Subclass hook: call after a parameter that affects
     * computeRequiredHz() changes, so the panel re-reads the
     * effective rate. No-op when the value is pinned (the displayed
     * value doesn't depend on the computed one in that case).
     */
    protected notifyComputedRequiredHzMayHaveChanged(): void {
        if (this._requiredHzUserDefined && this._requiredHzValue > 0) return;
        this.notifyPropertyChanged("requiredSampleRateHz", null, this.requiredHz);
    }
}
