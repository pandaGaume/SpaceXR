import * as BABYLON from "@babylonjs/core";

/// <summary>
/// Plug-and-play distance-adaptive navigation for a Babylon.js UniversalCamera.
/// - Keyboard (WASD / arrows): moves scale with distance
/// - Mouse wheel / pinch: forward dolly scales with distance
/// - Right-drag: orbit (yaw/pitch)
/// - Shift + left-drag: pan (strafe/up)
/// - Smooth hysteresis to avoid speed flicker
/// </summary>
export interface IAdaptiveNavOptions {
    /** Anchor to measure distance from (e.g., tileset center). If omitted, uses world origin. */
    anchor?: BABYLON.Vector3;
    /** Clamp speeds: min & max world units per key press @ 60 FPS. */
    minStep?: number; // default 0.05
    maxStep?: number; // default 2_000_000
    /** Fraction of (distance) used as base step. Example: 0.001 => 0.1% of distance per second. */
    stepFraction?: number; // default 0.0005
    /** Mouse wheel fraction (forward dolly): fraction of distance per 120 wheel delta. */
    wheelFraction?: number; // default 0.05
    /** Rotation sensitivity scales; higher -> slower rotation at distance. */
    baseAngularSensibility?: number; // default 800
    angularScaleWithDistance?: boolean; // default true
    /** Smooth factor (0..1). 0=no smoothing, 0.15=pleasant. */
    smoothing?: number; // default 0.15
    /** Optional function to compute distance (altitude) if you fly over a planet. */
    getDistance?: () => number;
}

export function SetupAdaptiveUniversalCamera(camera: BABYLON.UniversalCamera, scene: BABYLON.Scene, opts: IAdaptiveNavOptions = {}): BABYLON.IDisposable {
    // Defaults
    const anchor = opts.anchor ?? BABYLON.Vector3.Zero();
    const minStep = opts.minStep ?? 0.05;
    const maxStep = opts.maxStep ?? 2_000_000;
    const stepFraction = opts.stepFraction ?? 0.0005; // 0.05%
    const wheelFraction = opts.wheelFraction ?? 0.05; // 5% per tick (at distance)
    const baseAngularSens = opts.baseAngularSensibility ?? 800;
    const angScale = opts.angularScaleWithDistance ?? true;
    const smoothing = BABYLON.Scalar.Clamp(opts.smoothing ?? 0.15, 0, 0.9);

    // State
    let targetStep = 1;
    let currentStep = targetStep;
    let keysDown = new Set<string>();
    let isRightDown = false;
    let isLeftDown = false;
    let shift = false;
    let lastPointerX = 0,
        lastPointerY = 0;

    // Attach Babylon default input handling for pointer lock etc.
    camera.attachControl(scene.getEngine().getRenderingCanvas(), true);
    // Disable built-in keyboard speeds (we’ll drive movement ourselves)
    camera.keysUp = camera.keysDown = camera.keysLeft = camera.keysRight = [];

    // Helpers
    const distanceFn = () => {
        if (opts.getDistance) return Math.max(1e-6, opts.getDistance());
        return BABYLON.Vector3.Distance(camera.position, anchor);
    };

    const updateTargetStep = () => {
        const d = Math.max(1e-6, distanceFn());
        const step = BABYLON.Scalar.Clamp(d * stepFraction, minStep, maxStep);
        targetStep = step;
    };

    const smoothUpdate = () => {
        // Exponential smoothing to avoid flicker when distance jitters
        currentStep = currentStep + (targetStep - currentStep) * smoothing;
        // Optional: scale rotation sensibility with distance so you don't overspin in orbit
        if (angScale) {
            const d = Math.max(1, distanceFn());
            // Keep rotation manageable over huge ranges (log scaling)
            const k = Math.log10(d + 10); // grows slowly with distance
            camera.angularSensibility = baseAngularSens * (1 + k); // higher = slower rotation
        } else {
            camera.angularSensibility = baseAngularSens;
        }
    };

    // Keyboard
    const keySub = scene.onKeyboardObservable.add((kb) => {
        const k = kb.event.key;
        if (kb.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
            keysDown.add(k);
            shift = kb.event.shiftKey;
        } else if (kb.type === BABYLON.KeyboardEventTypes.KEYUP) {
            keysDown.delete(k);
            shift = kb.event.shiftKey;
        }
    });

    // Pointer: orbit (RMB) / pan (Shift+LMB)
    const pointerSub = scene.onPointerObservable.add((po) => {
        if (!po.event) return;
        const ev = po.event as PointerEvent;
        if (po.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            if (ev.button === 2) {
                isRightDown = true;
            }
            if (ev.button === 0) {
                isLeftDown = true;
            }
            lastPointerX = ev.clientX;
            lastPointerY = ev.clientY;
        } else if (po.type === BABYLON.PointerEventTypes.POINTERUP) {
            if (ev.button === 2) {
                isRightDown = false;
            }
            if (ev.button === 0) {
                isLeftDown = false;
            }
        } else if (po.type === BABYLON.PointerEventTypes.POINTERMOVE) {
            const dx = ev.clientX - lastPointerX;
            const dy = ev.clientY - lastPointerY;
            lastPointerX = ev.clientX;
            lastPointerY = ev.clientY;

            if (isRightDown) {
                // Orbit (yaw/pitch around the anchor by rotating the view direction)
                // Convert pixels to radians using angularSensibility
                const yaw = -dx / camera.angularSensibility;
                const pitch = -dy / camera.angularSensibility;
                // const rot = BABYLON.Vector3.RotationFromAxis(camera.getDirection(BABYLON.Axis.X), camera.getDirection(BABYLON.Axis.Y), camera.getDirection(BABYLON.Axis.Z));
                camera.rotation.y += yaw;
                camera.rotation.x = BABYLON.Scalar.Clamp(camera.rotation.x + pitch, -Math.PI * 0.49, Math.PI * 0.49);
            } else if (isLeftDown && (ev.shiftKey || shift)) {
                // Pan: move sideways/up relative to camera axes, scaled by distance
                const panScale = currentStep * 0.5;
                const right = camera.getDirection(BABYLON.Axis.X);
                const up = camera.getDirection(BABYLON.Axis.Y);
                camera.position.addInPlace(right.scale(-dx * (1 / 250) * panScale));
                camera.position.addInPlace(up.scale(dy * (1 / 250) * panScale));
            }
        }
    });

    // Mouse wheel: forward/back dolly scaled by distance
    const wheelSub = scene.onPrePointerObservable.add((poi) => {
        if (poi.type !== BABYLON.PointerEventTypes.POINTERWHEEL) return;
        const ev = poi.event as WheelEvent;
        const delta = Math.sign(ev.deltaY); // 1 for zoom out, -1 for zoom in
        const d = Math.max(1e-6, distanceFn());
        const move = d * wheelFraction * delta;
        const forward = camera.getDirection(BABYLON.Axis.Z); // camera looks toward -Z, so invert
        camera.position.addInPlace(forward.scale(move));
        // prevent page scroll
        ev.preventDefault();
    }, BABYLON.PointerEventTypes.POINTERWHEEL);

    // Per-frame: recompute step & apply movement
    const beforeRender = scene.onBeforeRenderObservable.add(() => {
        updateTargetStep();
        smoothUpdate();

        if (keysDown.size) {
            // Normalize to 60 FPS feel
            const dt = scene.getEngine().getDeltaTime() / 1000; // s
            const perSec = currentStep; // world units / sec at 60fps baseline
            const amount = perSec * dt * 60;

            const forward = camera.getDirection(BABYLON.Axis.Z).scale(-1); // forward
            const right = camera.getDirection(BABYLON.Axis.X);
            const up = camera.getDirection(BABYLON.Axis.Y);

            // Arrow keys OR WASD
            if (keysDown.has("w") || keysDown.has("W") || keysDown.has("ArrowUp")) {
                camera.position.addInPlace(forward.scale(amount));
            }
            if (keysDown.has("s") || keysDown.has("S") || keysDown.has("ArrowDown")) {
                camera.position.addInPlace(forward.scale(-amount));
            }
            if (keysDown.has("a") || keysDown.has("A") || keysDown.has("ArrowLeft")) {
                camera.position.addInPlace(right.scale(-amount));
            }
            if (keysDown.has("d") || keysDown.has("D") || keysDown.has("ArrowRight")) {
                camera.position.addInPlace(right.scale(amount));
            }
            if (keysDown.has("q") || keysDown.has("Q")) {
                camera.position.addInPlace(up.scale(-amount));
            }
            if (keysDown.has("e") || keysDown.has("E")) {
                camera.position.addInPlace(up.scale(amount));
            }
        }
    });

    // Sensible camera defaults
    camera.inertia = 0.85; // keep some glide
    camera.speed = 1; // not used (we drive movement), but harmless
    camera.minZ = 0.01;

    // Disposal
    return {
        dispose() {
            scene.onKeyboardObservable.remove(keySub);
            scene.onPointerObservable.remove(pointerSub);
            scene.onPrePointerObservable.remove(wheelSub);
            scene.onBeforeRenderObservable.remove(beforeRender);
        },
    };
}
