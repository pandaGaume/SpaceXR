import { Observer } from "../../events";
import { ITileNavigationApi } from "../../tiles";
import { IDisposable, Nullable } from "../../types";
import { IInputSource, IPointerDragEvent } from "./map.inputs.interfaces";
import { AnyTouchGesture, TouchGestureType } from "./map.inputs.interfaces.touch";

export class InpustNavigationControllerOptions {
    static readonly DEFAULT_ZOOM_INCREMENT = 0.1;
    static readonly DEFAULT_TOUCH_ZOOM_INCREMENT = 0.05;
    static readonly DEFAULT_INVERT_Z = false;
    static readonly DEFAULT_ROTATE_FACTOR = 1;
    static readonly DEFAULT_TRANSLATE_FACTOR = 1;
    static readonly DEFAULT_ZOOM_FACTOR = 1;

    static readonly DEFAULT_OPTIONS: InpustNavigationControllerOptions = {
        zoomIncrement: InpustNavigationControllerOptions.DEFAULT_ZOOM_INCREMENT,
        touchZoomIncrement: InpustNavigationControllerOptions.DEFAULT_TOUCH_ZOOM_INCREMENT,
        invertZ: InpustNavigationControllerOptions.DEFAULT_INVERT_Z,
    };

    /// <summary>
    /// Incremental zoom factor for mouse wheel (default: 0.1).
    zoomIncrement?: number;
    /// <summary>
    /// Incremental zoom factor for touch gestures (default: 0.05).
    /// </summary>
    touchZoomIncrement?: number;
    /// <summary>
    /// If true, the zoom delta will be inverted (default: false).
    /// </summary>
    invertZ?: boolean;
    /// <summary>
    /// Factor into [0,1] to apply to the zoom delta (default: 1).
    /// </summary>
    zoomFactor?: number;
    /// <summary>
    /// Factor into [0,1] to apply to the rotate delta (default: 1).
    /// </summary>
    rotateFactor?: number;
    /// <summary>
    /// Factor into [0,1] to apply to the translate delta (default: 1).
    /// </summary>
    translateFactor?: number;
}

export class InputsNavigationController implements IDisposable {
    _source: IInputSource;
    _target: ITileNavigationApi;
    _options: InpustNavigationControllerOptions;

    _onDragObserver: Nullable<Observer<IPointerDragEvent>> = null;
    _onWheelObserver: Nullable<Observer<WheelEvent>> = null;
    _onTouchObserver: Nullable<Observer<AnyTouchGesture>> = null;

    public constructor(source: IInputSource, target: ITileNavigationApi, options?: InpustNavigationControllerOptions) {
        this._source = source;
        this._target = target;
        this._options = options ?? InpustNavigationControllerOptions.DEFAULT_OPTIONS;
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
                            const translateFactor = this._options.translateFactor ?? InpustNavigationControllerOptions?.DEFAULT_TRANSLATE_FACTOR;
                            // translate the center of the map according the drag displacement
                            // then we have to negate the drag displacement.
                            this._target.translateUnitsMap(-event.deltaX * translateFactor, -event.deltaY * translateFactor);
                        }
                        break;
                    }
                    case 2: {
                        if (event.deltaX) {
                            const rotateFactor = this._options.rotateFactor ?? InpustNavigationControllerOptions?.DEFAULT_ROTATE_FACTOR;
                            // rotate the map according the drag displacement
                            this._target.rotateMap(Math.hypot(event.deltaX, event.deltaY) * rotateFactor);
                        }
                        break;
                    }
                }
                break;
            }
        }
    };

    protected _onWheel = (event: WheelEvent): void => {
        const zoomFactor = this._options.zoomFactor ?? InpustNavigationControllerOptions?.DEFAULT_ZOOM_FACTOR;
        const delta = Math.sign(event.deltaY) * (this._options.zoomIncrement ?? Math.abs(event.deltaY)) * zoomFactor;
        this._target.zoomMap(this._options.invertZ ? delta : -delta);
    };

    protected _onTouch = (event: AnyTouchGesture): void => {
        switch (event.type) {
            case TouchGestureType.Drag: {
                const translateFactor = this._options.translateFactor ?? InpustNavigationControllerOptions?.DEFAULT_TRANSLATE_FACTOR;
                // translate the center of the map according the drag displacement
                // then we have to negate the drag displacement.
                this._target.translateUnitsMap(-event.deltaX * translateFactor, -event.deltaY * translateFactor);
                break;
            }
            case TouchGestureType.Pinch: {
                const zoomFactor = this._options.zoomFactor ?? InpustNavigationControllerOptions?.DEFAULT_ZOOM_FACTOR;
                const delta = Math.sign(event.scale) * (this._options.touchZoomIncrement ?? Math.abs(event.scale)) * zoomFactor;
                this._target.zoomMap(this._options.invertZ ? -delta : delta);
                break;
            }
            case TouchGestureType.Rotate: {
                const rotateFactor = this._options.rotateFactor ?? InpustNavigationControllerOptions?.DEFAULT_ROTATE_FACTOR;
                this._target.rotateMap(event.angle * rotateFactor);
                break;
            }
        }
    };
}
