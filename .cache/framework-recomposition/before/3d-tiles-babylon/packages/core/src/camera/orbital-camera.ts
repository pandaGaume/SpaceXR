import { Camera } from "@babylonjs/core/Cameras/camera.js";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { Observer } from "@babylonjs/core/Misc/observable.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { ICartesian3 } from "@spacexr/tiles";

import { OrbitFrame, type IOrbitFrameOptions } from "./orbit-frame";
import type { VerticalScale } from "@spacexr/3d-tiles-runtime";

/** Share of the gap to the terrain closed per frame by the height of the orbited point. */
const TERRAIN_FOLLOW = 0.15;
/** Fraction of the view height crossed per second with the arrow keys. */
const KEY_PAN_RATE = 0.6;
const KEY_TURN_RATE = 1;
const POINTER_TURN_RATE = 0.005;
const WHEEL_ZOOM_RATE = 0.001;
const KEY_ZOOM_RATE = 1.5;

export interface IOrbitalCameraOptions extends IOrbitFrameOptions {
    name?: string;
    /** Height of the terrain in a unit direction, in metres, or `NaN` where unknown. The camera follows it and stays above it. */
    heightAt?: (direction: Readonly<ICartesian3>) => number;
    /** Vertical scale of the scene, applied to {@link heightAt}. */
    verticalScale?: VerticalScale;
    /** Lowest altitude of the camera above the terrain, in metres. Defaults to 50 m. */
    altitudeMin?: number;
    /** Attaches pointer, wheel and keyboard controls. Defaults to true. */
    attachControl?: boolean;
}

/**
 * Camera orbiting a point of a body, which can cross the poles; see {@link OrbitFrame}. Babylon's `GeospatialCamera` keeps
 * its centre about 2.87 degrees from the poles, measures its yaw from the north and slows its pan down to zero there.
 *
 * Drag to pan. Drag with the right or middle button, or with Ctrl, to turn and tilt. Use the wheel or a pinch to zoom, and
 * two fingers to turn. The arrow keys pan, `+` and `-` zoom, `Q` and `E` turn, `Page Up` and `Page Down` tilt.
 */
export class OrbitalCamera extends Camera {
    public readonly frame: OrbitFrame;
    /** Height of the terrain in a direction; see {@link IOrbitalCameraOptions.heightAt}. */
    public heightAt: ((direction: Readonly<ICartesian3>) => number) | undefined;
    private readonly verticalScale: VerticalScale | undefined;
    private readonly stopVerticalScale: (() => void) | undefined;
    public readonly altitudeMin: number;
    private readonly viewMatrix = new Matrix();
    private readonly target = new Vector3();
    private readonly pointers = new Map<number, { x: number; y: number }>();
    private readonly keys = new Set<string>();
    private readonly frameObserver: Observer<Scene>;
    private element: HTMLElement | undefined;
    private removeControls: (() => void) | undefined;
    private dragMode: "pan" | "turn" | undefined;
    private dirty = true;

    public constructor(scene: Scene, options: IOrbitalCameraOptions) {
        super(options.name ?? "orbital-camera", Vector3.Zero(), scene);
        this.frame = new OrbitFrame(options);
        this.heightAt = options.heightAt;
        this.verticalScale = options.verticalScale;
        this.stopVerticalScale = options.verticalScale?.subscribe(() => this.poseChanged());
        this.altitudeMin = options.altitudeMin ?? 50;
        const terrain = this.terrainHeight(this.frame.direction);
        if (!Number.isNaN(terrain)) this.frame.centerHeight = terrain;
        this.place();
        this.frameObserver = scene.onBeforeRenderObservable.add(() => this.updateFrame());
        if (options.attachControl ?? true) this.attachControl();
    }

    public override getClassName(): string {
        return "OrbitalCamera";
    }

    /** Moves the orbited point by pixels of the view, along its great circle. */
    public panPixels(rightPixels: number, forwardPixels: number): void {
        const perPixel = this.metresPerPixel() / this.frame.surface.radius(this.frame.direction);
        this.frame.pan(rightPixels * perPixel, forwardPixels * perPixel);
        this.dirty = true;
    }

    /** Applies a change of the pose made directly on {@link frame}. */
    public poseChanged(): void {
        this.dirty = true;
    }

    public override attachControl(): void {
        if (this.removeControls) return;
        const element = this.getScene().getEngine().getInputElement();
        if (!element) return;
        this.element = element;
        const down = (event: PointerEvent): void => {
            element.setPointerCapture?.(event.pointerId);
            element.focus?.();
            this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            this.dragMode = event.button !== 0 || event.ctrlKey ? "turn" : "pan";
            event.preventDefault();
        };
        const move = (event: PointerEvent): void => {
            const previous = this.pointers.get(event.pointerId);
            if (!previous) return;
            const others = [...this.pointers.entries()].filter(([id]) => id !== event.pointerId);
            const current = { x: event.clientX, y: event.clientY };
            if (others.length === 1) {
                this.pinch(others[0]![1], previous, current);
            } else {
                this.drag(current.x - previous.x, current.y - previous.y);
            }
            this.pointers.set(event.pointerId, current);
        };
        const up = (event: PointerEvent): void => {
            this.pointers.delete(event.pointerId);
            if (this.pointers.size === 0) this.dragMode = undefined;
        };
        const wheel = (event: WheelEvent): void => {
            this.frame.radius *= Math.exp(event.deltaY * WHEEL_ZOOM_RATE);
            this.dirty = true;
            event.preventDefault();
        };
        const keyDown = (event: KeyboardEvent): void => {
            this.keys.add(event.key);
        };
        const keyUp = (event: KeyboardEvent): void => {
            this.keys.delete(event.key);
        };
        const menu = (event: Event): void => event.preventDefault();
        const blur = (): void => this.keys.clear();
        element.addEventListener("pointerdown", down);
        element.addEventListener("pointermove", move);
        element.addEventListener("pointerup", up);
        element.addEventListener("pointercancel", up);
        element.addEventListener("wheel", wheel, { passive: false });
        element.addEventListener("contextmenu", menu);
        window.addEventListener("keydown", keyDown);
        window.addEventListener("keyup", keyUp);
        window.addEventListener("blur", blur);
        this.removeControls = () => {
            element.removeEventListener("pointerdown", down);
            element.removeEventListener("pointermove", move);
            element.removeEventListener("pointerup", up);
            element.removeEventListener("pointercancel", up);
            element.removeEventListener("wheel", wheel);
            element.removeEventListener("contextmenu", menu);
            window.removeEventListener("keydown", keyDown);
            window.removeEventListener("keyup", keyUp);
            window.removeEventListener("blur", blur);
        };
    }

    public override detachControl(): void {
        this.removeControls?.();
        this.removeControls = undefined;
        this.element = undefined;
        this.pointers.clear();
        this.keys.clear();
        this.dragMode = undefined;
    }

    public override dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void {
        this.stopVerticalScale?.();
        this.detachControl();
        this.getScene().onBeforeRenderObservable.remove(this.frameObserver);
        super.dispose(doNotRecurse, disposeMaterialAndTextures);
    }

    public override _isSynchronizedViewMatrix(): boolean {
        return !this.dirty && super._isSynchronizedViewMatrix();
    }

    public override _getViewMatrix(): Matrix {
        if (this.getScene().useRightHandedSystem) Matrix.LookAtRHToRef(this.position, this.target, this.upVector, this.viewMatrix);
        else Matrix.LookAtLHToRef(this.position, this.target, this.upVector, this.viewMatrix);
        return this.viewMatrix;
    }

    private terrainHeight(direction: Readonly<ICartesian3>): number {
        return this.heightAt ? this.heightAt(direction) * (this.verticalScale?.value ?? 1) : Number.NaN;
    }

    private metresPerPixel(): number {
        const height = this.getScene().getEngine().getRenderHeight() || 1;
        return (2 * Math.tan(this.fov / 2) * this.frame.radius) / height;
    }

    private drag(dx: number, dy: number): void {
        if (this.dragMode === "turn") {
            this.frame.rotateHeading(-dx * POINTER_TURN_RATE);
            this.frame.pitch -= dy * POINTER_TURN_RATE;
            this.dirty = true;
        } else {
            // The terrain follows the pointer: dragging to the right moves the orbited point to the left.
            const scale = this.getScene().getEngine().getHardwareScalingLevel();
            this.panPixels(-dx / scale, dy / scale);
        }
    }

    /** One of two fingers moved: the change of their distance zooms, the change of their angle turns. */
    private pinch(other: { x: number; y: number }, previous: { x: number; y: number }, current: { x: number; y: number }): void {
        const before = Math.hypot(previous.x - other.x, previous.y - other.y);
        const after = Math.hypot(current.x - other.x, current.y - other.y);
        if (before > 0 && after > 0) this.frame.radius *= before / after;
        const turn = Math.atan2(current.y - other.y, current.x - other.x) - Math.atan2(previous.y - other.y, previous.x - other.x);
        this.frame.rotateHeading(turn);
        this.dirty = true;
    }

    private applyKeys(seconds: number): void {
        if (this.keys.size === 0) return;
        const height = this.getScene().getEngine().getRenderHeight() || 1;
        const step = KEY_PAN_RATE * height * seconds;
        const pressed = (...names: string[]): boolean => names.some((name) => this.keys.has(name));
        const right = (pressed("ArrowRight") ? step : 0) - (pressed("ArrowLeft") ? step : 0);
        const forward = (pressed("ArrowUp") ? step : 0) - (pressed("ArrowDown") ? step : 0);
        if (right !== 0 || forward !== 0) this.panPixels(right, forward);
        const turn = (pressed("e", "E") ? 1 : 0) - (pressed("q", "Q") ? 1 : 0);
        const tilt = (pressed("PageUp") ? 1 : 0) - (pressed("PageDown") ? 1 : 0);
        const zoom = (pressed("-", "_") ? 1 : 0) - (pressed("+", "=") ? 1 : 0);
        if (turn !== 0) this.frame.rotateHeading(turn * KEY_TURN_RATE * seconds);
        if (tilt !== 0) this.frame.pitch += tilt * KEY_TURN_RATE * seconds;
        if (zoom !== 0) this.frame.radius *= Math.exp(zoom * KEY_ZOOM_RATE * seconds);
        if (turn !== 0 || tilt !== 0 || zoom !== 0) this.dirty = true;
    }

    private updateFrame(): void {
        this.applyKeys(this.getScene().getEngine().getDeltaTime() / 1000);
        // The orbited point settles on the terrain as it loads, and as the point moves.
        const terrain = this.terrainHeight(this.frame.direction);
        if (!Number.isNaN(terrain) && Math.abs(terrain - this.frame.centerHeight) > 0.01) {
            this.frame.centerHeight += (terrain - this.frame.centerHeight) * TERRAIN_FOLLOW;
            this.dirty = true;
        }
        if (this.dirty) this.place();
    }

    /** Writes the pose into the camera, above the terrain, and adapts the clipping planes to the altitude. */
    private place(): void {
        const { frame } = this;
        let eye = frame.position;
        const distance = Math.hypot(eye.x, eye.y, eye.z);
        const eyeDirection = { x: eye.x / distance, y: eye.y / distance, z: eye.z / distance };
        const reference = frame.surface.radius(eyeDirection);
        const terrain = this.terrainHeight(eyeDirection);
        const ground = reference + (Number.isNaN(terrain) ? 0 : terrain);
        if (distance < ground + this.altitudeMin) {
            const raised = ground + this.altitudeMin;
            eye = { x: eyeDirection.x * raised, y: eyeDirection.y * raised, z: eyeDirection.z * raised };
        }
        this.position.set(eye.x, eye.y, eye.z);
        const center = frame.center;
        this.target.set(center.x, center.y, center.z);
        const up = frame.viewUp;
        this.upVector.set(up.x, up.y, up.z);
        const altitude = Math.max(1, Math.hypot(eye.x, eye.y, eye.z) - ground);
        this.minZ = Math.max(1, altitude * 0.001);
        // Sees to the horizon and beyond, and to the orbited point however far it is.
        const horizon = Math.sqrt(2 * reference * altitude + altitude * altitude);
        this.maxZ = Math.max(horizon + reference * 0.1, frame.radius * 1.5);
        this.dirty = false;
        this.getViewMatrix(true);
    }
}
