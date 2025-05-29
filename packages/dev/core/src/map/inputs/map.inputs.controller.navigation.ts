import { Observer } from "../../events";
import { ITileNavigationApi } from "../../tiles";
import { IDisposable, Nullable } from "../../types";
import { IInputSource, IPointerDragEvent } from "./map.inputs.interfaces";
import { AnyTouchGesture, TouchGestureType } from "./map.inputs.interfaces.touch";

export class InputsNavigationController implements IDisposable {
    static readonly DEFAULT_ZOOM_INCREMENT = 0.1;

    _source: IInputSource;
    _target: ITileNavigationApi;
    _zoomIncrement?: number;
    _inverty?: boolean;
    _invertz?: boolean;
    _onDragObserver: Nullable<Observer<IPointerDragEvent>> = null;
    _onWheelObserver: Nullable<Observer<WheelEvent>> = null;
    _onTouchObserver: Nullable<Observer<AnyTouchGesture>> = null;

    public constructor(source: IInputSource, target: ITileNavigationApi, zoomIncrement?: number, invertY: boolean = true, invertZ: boolean = false) {
        this._source = source;
        this._target = target;
        this._zoomIncrement = zoomIncrement ?? InputsNavigationController.DEFAULT_ZOOM_INCREMENT;
        this._inverty = invertY;
        this._invertz = invertZ;
        this._attachSource(this._source);
    }

    dispose(): void {
        this._detachSource();
    }

    protected _attachSource(source: IInputSource): void {
        this._onDragObserver = source.onDragObservable.add(this._onDrag);
        this._onWheelObserver = source.onWheelObservable.add(this._onWheel);
        this._onTouchObserver = source.onTouchObservable.add(this._onTouch);
    }

    protected _detachSource(): void {
        this._onDragObserver?.disconnect();
        this._onWheelObserver?.disconnect();
        this._onDragObserver = null;
        this._onWheelObserver = null;
    }

    protected _onDrag = (event: IPointerDragEvent): void => {
        switch (event.type) {
            case "drag": {
                switch (event.button) {
                    case 0: {
                        if (event.deltaX || event.deltaY) {
                            // translate the center of the map according the drag displacement
                            // then we have to negate the drag displacement.
                            this._target.translateUnitsMap(-event.deltaX, -event.deltaY);
                        }
                        break;
                    }
                    case 2: {
                        if (event.deltaX) {
                            // rotate the map according the drag displacement
                            this._target.rotateMap(event.deltaX);
                        }
                        break;
                    }
                }
                break;
            }
        }
    };

    protected _onWheel = (event: WheelEvent): void => {
        const delta = Math.sign(event.deltaY) * (this._zoomIncrement ?? Math.abs(event.deltaY));
        this._target.zoomMap(this._invertz ? delta : -delta);
    };

    protected _onTouch = (event: AnyTouchGesture): void => {
        switch (event.type) {
            case TouchGestureType.Drag: {
                // translate the center of the map according the drag displacement
                // then we have to negate the drag displacement.
                this._target.translateUnitsMap(-event.deltaX, -event.deltaY);
                break;
            }
            case TouchGestureType.Pinch: {
                const delta = (Math.sign(event.scale) * (this._zoomIncrement ?? Math.abs(event.scale))) / 2;
                this._target.zoomMap(this._invertz ? delta : -delta);
                break;
            }
            case TouchGestureType.Rotate: {
                this._target.rotateMap(event.angle);
                break;
            }
        }
    };
}
