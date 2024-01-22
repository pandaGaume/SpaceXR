import { EventState, Nullable, Observer, PointerEventTypes, PointerInfo, Scene, Vector2, Vector3 } from "@babylonjs/core";
import { VirtualDisplay } from "./holograms.display";
import { Cartesian2WithInfos } from "core/map/inputs";

export class SceneInputController {
    _display: VirtualDisplay;
    _observer: Nullable<Observer<PointerInfo>>;

    _currentPosition: Nullable<Vector2>;

    public constructor(display: VirtualDisplay) {
        this._display = display;
        this._observer = this._display.getScene().onPointerObservable.add(this.onPointerEvent.bind(this));
        this._currentPosition = null;
    }

    public get display(): VirtualDisplay {
        return this._display;
    }

    public dispose(): void {
        if (this._observer) {
            this._display.getScene().onPointerObservable.remove(this._observer);
            this._observer = null;
        }
    }

    private onPointerEvent(pointerInfo: PointerInfo, eventState: EventState): void {
        switch (pointerInfo.type) {
            case PointerEventTypes.POINTERDOWN:
                if (pointerInfo.pickInfo?.hit) {
                    this._onPointerDown(pointerInfo);
                }
                break;
            case PointerEventTypes.POINTERUP:
                this._onPointerUp(pointerInfo);
                break;
            case PointerEventTypes.POINTERMOVE:
                this._onPointerMove(pointerInfo);
                break;
        }
    }

    private _onPointerDown(pointerInfo: PointerInfo): void {
        if (pointerInfo.pickInfo?.pickedMesh == this._display) {
            const pickedPoint = pointerInfo.pickInfo.pickedPoint;
            if (pickedPoint) {
                const pixelXY = this._display.getPixelToRef(pickedPoint);
                const e = new Cartesian2WithInfos(pixelXY.x, pixelXY.y, pointerInfo.event.button);
                this._display.onPointerDownObservable.notifyObservers(e, -1, this, this._display);
            }
        }
    }

    private _onPointerUp(pointerInfo: PointerInfo): void {
        if (pointerInfo.pickInfo?.pickedMesh == this._display) {
            const pickedPoint = pointerInfo.pickInfo.pickedPoint;
            if (pickedPoint) {
                const pixelXY = this._display.getPixelToRef(pickedPoint);
                const e = new Cartesian2WithInfos(pixelXY.x, pixelXY.y, pointerInfo.event.button);
                this._display.onPointerUpObservable.notifyObservers(e, -1, this, this._display);
            }
        }
    }

    private _onPointerMove(pointerInfo: PointerInfo): void {
        const current = this._getDisplayPosition();
        if (this._currentPosition) {
            if (current) {
                // move
                const pixelXY = this._display.getPixelToRef(current);
                this._display.onPointerMoveObservable.notifyObservers(pixelXY, -1, this, this._display);
            } else {
                // out
                this._display.onPointerOutObservable.notifyObservers(this._display, -1, this, this._display);
                this._currentPosition = null;
            }
        } else {
            if (current) {
                // enter
                this._display.onPointerEnterObservable.notifyObservers(this._display, -1, this, this._display);
                // then move
                const pixelXY = this._display.getPixelToRef(current);
                this._display.onPointerMoveObservable.notifyObservers(pixelXY, -1, this, this._display);
                this._currentPosition = pixelXY;
            }
        }
    }

    protected _getDisplayPosition(): Nullable<Vector3> {
        var scene = this._getScene();
        var pickinfo = scene.pick(scene.pointerX, scene.pointerY, this._pickFilter.bind(this));
        if (pickinfo.hit) {
            return pickinfo.pickedPoint;
        }
        return null;
    }

    protected _pickFilter(mesh: Nullable<any>): boolean {
        return mesh == this._display;
    }

    protected _getScene(): Scene {
        return this._display.getScene();
    }
}
