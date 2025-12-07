import * as BABYLON from "@babylonjs/core";
import { CameraState } from "./camera.state";

/// <summary>
/// Camera state machine that fires events when the camera transitions between Moving, Settling and Stable.
/// Also supports heartbeat ticks (global and while-moving) to drive periodic lightweight updates.
/// </summary>
export enum CameraMotionState {
    Moving,
    Settling,
    Stable,
}

/// <summary>
/// Options to tune thresholds, smoothing and heartbeat behavior.
/// </summary>
export interface ICameraMotionOptions {
    /** Translation speed threshold (meters per second) to consider as "settling". */
    settlePos_mps?: number;
    /** Angular speed threshold (radians per second) to consider as "settling". */
    settleRot_rps?: number;
    /** Zoom/FOV speed threshold (radians per second) to consider as "settling". */
    settleFov_rps?: number;
    /** Resume threshold multiplier for hysteresis (e.g., 1.5). */
    hysteresisFactor?: number;

    /** Minimum time (ms) under thresholds before transitioning to Stable. */
    dwell_ms?: number;
    /** EMA alpha for smoothing raw speeds (0..1). Higher = more reactive. */
    emaAlpha?: number;
    /** Minimum delay (ms) between consecutive Stable firings (anti-thrashing). */
    cooldown_ms?: number;

    /** Global heartbeat: fire onTick every N frames (0 disables). */
    forceTickEveryNFrames?: number;
    /** MOVING-only heartbeat: fire onMovingTick every N frames while Moving (0 disables). */
    movingTickEveryNFrames?: number;
}

/// <summary>
/// Detects when a Babylon.js Camera becomes stable (after movement/zoom) using speed thresholds,
/// dwell time, and hysteresis; emits events to let the app update expensive state only when needed.
/// </summary>
export class CameraMotionDetector implements BABYLON.IDisposable {
    private state: CameraMotionState = CameraMotionState.Moving;
    private lastT = performance.now();

    // Previous pose
    private lastPos = new BABYLON.Vector3(Number.NaN, Number.NaN, Number.NaN);
    private lastRot = new BABYLON.Quaternion(Number.NaN, Number.NaN, Number.NaN, Number.NaN);
    private lastFov = Number.NaN;

    // Smoothed speeds
    private emaPos = 0;
    private emaRot = 0;
    private emaFov = 0;

    private belowSince = 0;
    private lastFiredStable = -Infinity;

    // Subscriptions
    private sub: BABYLON.Nullable<BABYLON.Observer<BABYLON.Camera>> = null;

    // Heartbeat counters
    private globalFrameCounter = 0;
    private movingFrameCounter = 0;

    // Events
    /** Entered Moving. */
    public onMoving = new BABYLON.Observable<void>();
    /** Entered Settling. */
    public onSettling = new BABYLON.Observable<void>();
    /** Entered Stable (use this to run heavy updates). */
    public onStable = new BABYLON.Observable<void>();
    /** Global heartbeat tick (fires every forceTickEveryNFrames if > 0). */
    public onTick = new BABYLON.Observable<void>();
    /** Heartbeat tick while Moving only (fires every movingTickEveryNFrames if > 0). */
    public onMovingTick = new BABYLON.Observable<void>();

    private opts: Required<ICameraMotionOptions>;

    /// <summary>
    /// Create a CameraStateDetector bound to a camera and scene.
    /// </summary>
    constructor(public camera: BABYLON.Camera, options: ICameraMotionOptions = {}) {
        this.opts = {
            settlePos_mps: options.settlePos_mps ?? 0.1,
            settleRot_rps: options.settleRot_rps ?? (0.5 * Math.PI) / 180, // 0.5°/s
            settleFov_rps: options.settleFov_rps ?? (0.5 * Math.PI) / 180, // 0.5°/s
            hysteresisFactor: options.hysteresisFactor ?? 1.5,

            dwell_ms: options.dwell_ms ?? 200,
            emaAlpha: options.emaAlpha ?? 0.3,
            cooldown_ms: options.cooldown_ms ?? 250,

            forceTickEveryNFrames: options.forceTickEveryNFrames ?? 0,
            movingTickEveryNFrames: options.movingTickEveryNFrames ?? 0,
        };

        // Attach to camera input loop
        this.sub = this.camera.onAfterCheckInputsObservable.add(() => this._tick());
    }

    /// <summary>
    /// Internal per-frame update.
    /// </summary>
    private _tick() {
        const now = performance.now();
        const dt = Math.max((now - this.lastT) / 1000, 1e-6);
        this.lastT = now;

        const pos = this.camera.globalPosition;
        const rot = CameraState.GetWorldRotationToRef(this.camera, BABYLON.Quaternion.Identity());
        const fov = (this.camera as any).fov ?? 0;

        if (Number.isNaN(this.lastPos.x)) {
            this.lastPos.copyFrom(pos);
            this.lastRot.copyFrom(rot);
            this.lastFov = fov;
            return;
        }

        // --- Compute raw speeds ---
        const vPos = BABYLON.Vector3.Distance(pos, this.lastPos) / dt;

        const dq = rot.multiply(BABYLON.Quaternion.Inverse(this.lastRot));
        const w = Math.min(1, Math.max(-1, dq.w));
        const angle = 2 * Math.acos(w); // [0..π]
        const vRot = angle / dt;

        const vFov = Math.abs(fov - this.lastFov) / dt;

        // --- EMA smoothing ---
        const a = this.opts.emaAlpha;
        this.emaPos = a * vPos + (1 - a) * this.emaPos;
        this.emaRot = a * vRot + (1 - a) * this.emaRot;
        this.emaFov = a * vFov + (1 - a) * this.emaFov;

        // Update previous pose
        this.lastPos.copyFrom(pos);
        this.lastRot.copyFrom(rot);
        this.lastFov = fov;

        // Thresholds
        const underSettle = this.emaPos <= this.opts.settlePos_mps && this.emaRot <= this.opts.settleRot_rps && this.emaFov <= this.opts.settleFov_rps;

        const overResume =
            this.emaPos >= this.opts.settlePos_mps * this.opts.hysteresisFactor ||
            this.emaRot >= this.opts.settleRot_rps * this.opts.hysteresisFactor ||
            this.emaFov >= this.opts.settleFov_rps * this.opts.hysteresisFactor;

        // --- FSM ---
        switch (this.state) {
            case CameraMotionState.Moving: {
                // MOVING heartbeat
                if (this.opts.movingTickEveryNFrames > 0) {
                    this.movingFrameCounter++;
                    if (this.movingFrameCounter >= this.opts.movingTickEveryNFrames) {
                        this.movingFrameCounter = 0;
                        this.onMovingTick.notifyObservers();
                    }
                }
                if (underSettle) {
                    this.state = CameraMotionState.Settling;
                    this.belowSince = this.lastT;
                    this.onSettling.notifyObservers();
                }
                break;
            }
            case CameraMotionState.Settling: {
                if (overResume) {
                    this.state = CameraMotionState.Moving;
                    this.onMoving.notifyObservers();
                } else if (now - this.belowSince >= this.opts.dwell_ms) {
                    this.state = CameraMotionState.Stable;
                    if (now - this.lastFiredStable >= this.opts.cooldown_ms) {
                        this.lastFiredStable = now;
                        this.onStable.notifyObservers();
                    }
                }
                break;
            }
            case CameraMotionState.Stable: {
                if (overResume) {
                    this.state = CameraMotionState.Moving;
                    this.onMoving.notifyObservers();
                }
                break;
            }
        }

        // Global heartbeat regardless of state
        if (this.opts.forceTickEveryNFrames > 0) {
            this.globalFrameCounter++;
            if (this.globalFrameCounter >= this.opts.forceTickEveryNFrames) {
                this.globalFrameCounter = 0;
                this.onTick.notifyObservers();
            }
        }
    }

    /// <summary>
    /// Force the detector into Moving (e.g., on pointer down / wheel start).
    /// </summary>
    public armMoving() {
        if (this.state !== CameraMotionState.Moving) {
            this.state = CameraMotionState.Moving;
            this.onMoving.notifyObservers();
        }
    }

    /// <summary>
    /// Get current camera state.
    /// </summary>
    public getState(): CameraMotionState {
        return this.state;
    }

    /// <summary>
    /// Dispose subscriptions and observers.
    /// </summary>
    public dispose() {
        if (this.sub) {
            this.camera.onAfterCheckInputsObservable.remove(this.sub);
            this.sub = null;
        }
        this.onMoving.clear();
        this.onSettling.clear();
        this.onStable.clear();
        this.onTick.clear();
        this.onMovingTick.clear();
    }
}
