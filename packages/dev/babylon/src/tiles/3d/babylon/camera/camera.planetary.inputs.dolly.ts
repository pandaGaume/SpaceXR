import { Camera, ICameraInput, KeyboardEventTypes, KeyboardInfo, Observer, PointerEventTypes, PointerInfo, Scene } from "@babylonjs/core";
import { IPlaneteryCamera } from "./camera.interfaces";
import { Cartesian3, ICartesian3 } from "core/geometry";
import { IPlanetoryMeterPerStepProvider, PlaneteryInputConstant } from "./camera.planetary.inputs";


export class PlaneteryDollyMetersInput<T extends IPlaneteryCamera & Camera> implements ICameraInput<T> 
{

  private _obs?: Observer<PointerInfo>;
  private _kbObs?: Observer<KeyboardInfo>;
  private _beforeRenderObs?: Observer<Scene>;

  private _cartCache: ICartesian3 = Cartesian3.Zero();

  // calibration
  private _wheelSamples: number[] = [];
  private _wheelNotchPx = PlaneteryInputConstant.WheelNotchPx;
  private _wheelCalibrated = false;

  // keyboard state
  private _keyDir: -1 | 0 | 1 = 0;
  private _keyHoldEnabled = true;
  private _keyNotchesPerSecond = 8;

    public constructor(
        public camera: T,
        private metersPerStepProvider: IPlanetoryMeterPerStepProvider,
        private invert:boolean = false,
    ) {}

    public getSimpleName() {
    return "dollyMeters";
    }

    public getClassName(): string {
    return this.camera
        ? `PlaneteryDollyMetersInput$1[${this.camera.getClassName()}]`
        : "PlaneteryDollyMetersInput";
    }

public attachControl(noPreventDefault?: boolean): void {
    const scene: Scene = this.camera.getScene();

    this._obs = scene.onPointerObservable.add((pi) => {
      if (pi.type !== PointerEventTypes.POINTERWHEEL) return;

      const ev = pi.event as WheelEvent;
      if (!ev) return;

      let raw = ev.deltaY ?? 0;
      if (!raw) return;

      if (ev.deltaMode === 1) {
        raw *= PlaneteryInputConstant.PixelPerLine;
      } else if (ev.deltaMode === 2) {
        raw *= (window.innerHeight || PlaneteryInputConstant.PixelPerPage);
      }

      if (!this._wheelCalibrated) {
        this._pushWheelSample(Math.abs(raw));
      }

      this._applyStepFromRawDelta(raw);

      if (!noPreventDefault && ev.cancelable) {
        ev.preventDefault();
      }
    });

    this._kbObs = scene.onKeyboardObservable.add((ki) => {
      const ev = ki.event as KeyboardEvent;
      if (!ev) return;

      if (ki.type === KeyboardEventTypes.KEYDOWN) {
        if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;

        const dir: -1 | 1 = (ev.key === "ArrowUp") ? -1 : 1;

        if (this._keyHoldEnabled) {
          this._keyDir = dir;
          this._ensureBeforeRenderObserver();
        } else {
          if (!ev.repeat) {
            const raw = dir * this._wheelNotchPx;
            this._applyStepFromRawDelta(raw);
          }
        }

        if (!noPreventDefault && ev.cancelable) {
          ev.preventDefault();
        }
        return;
      }

      if (ki.type === KeyboardEventTypes.KEYUP) {
        if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;

        const releasedDir: -1 | 1 = (ev.key === "ArrowUp") ? -1 : 1;
        if (this._keyDir === releasedDir) {
          this._keyDir = 0;
        }
        this._maybeStopBeforeRenderObserver();

        if (!noPreventDefault && ev.cancelable) {
          ev.preventDefault();
        }
      }
    });
  }

  public detachControl(): void {
    const scene = this.camera.getScene();

    if (this._obs) scene.onPointerObservable.remove(this._obs);
    this._obs = undefined;

    if (this._kbObs) scene.onKeyboardObservable.remove(this._kbObs);
    this._kbObs = undefined;

    if (this._beforeRenderObs) scene.onBeforeRenderObservable.remove(this._beforeRenderObs);
    this._beforeRenderObs = undefined;

    this._keyDir = 0;
  }

  private _applyStepFromRawDelta(raw: number): void {
    const mag = Math.min(1, Math.abs(raw) / this._wheelNotchPx);

    const alt = this.camera.location.alt ?? 0;
    const stepMeters = this.metersPerStepProvider.getStep(alt, raw) * mag;

    const sgn = (raw > 0 ? 1 : -1) * (this.invert ? -1 : 1);

    const ecefDir = Cartesian3.MultiplyByFloatToRef(
      this.camera.ecefDirectionN,
      sgn * stepMeters,
      this._cartCache
    );

    const newEcefPosition = Cartesian3.AddInPlace(ecefDir, this.camera.ecefPosition);
    this.camera.setEcefPosition(newEcefPosition);
  }

  private _ensureBeforeRenderObserver(): void {
    if (this._beforeRenderObs) return;

    const scene = this.camera.getScene();

    this._beforeRenderObs = scene.onBeforeRenderObservable.add(() => {
      if (this._keyDir === 0) return;

      const dtSec = (scene.getEngine().getDeltaTime() || 0) / 1000;
      if (dtSec <= 0) return;

      // Treat the key as "notches per second"
      const rawPerNotch = this._keyDir * this._wheelNotchPx;

      const alt = this.camera.location.alt ?? 0;
      const metersPerNotch = this.metersPerStepProvider.getStep(alt, rawPerNotch);

      const metersThisFrame = metersPerNotch * this._keyNotchesPerSecond * dtSec;

      const sgn = (this._keyDir > 0 ? 1 : -1) * (this.invert ? -1 : 1);

      const ecefDir = Cartesian3.MultiplyByFloatToRef(
        this.camera.ecefDirectionN,
        sgn * metersThisFrame,
        this._cartCache
      );

      const newEcefPosition = Cartesian3.AddInPlace(ecefDir, this.camera.ecefPosition);
      this.camera.setEcefPosition(newEcefPosition);
    });
  }

  private _maybeStopBeforeRenderObserver(): void {
    if (this._keyDir !== 0) return;

    const scene = this.camera.getScene();
    if (this._beforeRenderObs) {
      scene.onBeforeRenderObservable.remove(this._beforeRenderObs);
      this._beforeRenderObs = undefined;
    }
  }

  private _pushWheelSample(absPixelDeltaY: number): void {
    if (this._wheelCalibrated) return;
    if (!isFinite(absPixelDeltaY) || absPixelDeltaY <= 0) return;

    const v = Math.min(2000, absPixelDeltaY);

    this._wheelSamples.push(v);
    if (this._wheelSamples.length > 24) this._wheelSamples.shift();

    if (this._wheelSamples.length >= PlaneteryInputConstant.CalibrationWindowSize) {
      const sorted = [...this._wheelSamples].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        (sorted.length % 2 === 1)
          ? sorted[mid]
          : 0.5 * (sorted[mid - 1] + sorted[mid]);

      this._wheelNotchPx = Math.max(
        PlaneteryInputConstant.MinWheelNotxhPx,
        Math.min(PlaneteryInputConstant.MaxWheelNotxhPx, median)
      );

      this._wheelCalibrated = true;
    }
  }
}