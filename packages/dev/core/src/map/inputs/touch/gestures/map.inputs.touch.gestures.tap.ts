import { TouchMapGesture } from "../map.inputs.touch.gestures";
import { ITouchGestureOptions, TouchMapEvent } from "../map.inputs.touch.interfaces";

export interface ITouchTapGestureOptions extends ITouchGestureOptions {
    /** Max duration (ms) between touchstart and touchend to consider it a tap */
    tapTime?: number;
    /** Max distance (px) moved between start and end to consider it a tap */
    tapDistance?: number;
}

export class TouchMapTapGesture extends TouchMapGesture {
    public static readonly DefaultTapTime = 400;
    public static readonly DefaultTapDistance = 25;

    private _startTime = 0;
    private _coordinateCache: [number, number];

    constructor(element: HTMLElement | SVGElement | string, options?: ITouchTapGestureOptions) {
        super(element, "tap", options);
        this._coordinateCache = [0, 0];
    }

    protected _doStart(evt: TouchEvent) {
        super._doStart(evt);

        if (evt.touches.length !== this._options.touchCount) return;

        this._startTime = Date.now();
        TouchMapGesture.GetCenterToRef(evt.touches, this._coordinateCache);
    }

    protected _doEnd(evt: TouchEvent) {
        super._doEnd(evt);

        const options = this._options as ITouchTapGestureOptions;
        const tapTime = options.tapTime ?? TouchMapTapGesture.DefaultTapTime;
        const tapDistance = options.tapDistance ?? TouchMapTapGesture.DefaultTapDistance;

        if (evt.changedTouches.length !== this._options.touchCount) return;

        const now = Date.now();
        const dt = now - this._startTime;
        if (dt > tapTime) return;

        const startX = this._coordinateCache[TouchMapGesture.X_coordinate];
        const startY = this._coordinateCache[TouchMapGesture.Y_coordinate];
        TouchMapGesture.GetCenterToRef(evt.touches, this._coordinateCache);

        const dx = this._coordinateCache[TouchMapGesture.X_coordinate] - startX;
        const dy = this._coordinateCache[TouchMapGesture.Y_coordinate] - startY;
        const dist = Math.hypot(dx, dy);

        if (dist <= tapDistance) {
            this._fireEvent(this._buildTapEvent(evt, this._gestureType, this._coordinateCache[0], this._coordinateCache[1]));
        }
    }

    protected _doMove(evt: TouchEvent) {
        super._doMove(evt);
        // You may choose to cancel the gesture here if moved too far
    }

    protected _buildTapEvent(evt: TouchEvent, gestureType: string, x: number, y: number): TouchMapEvent | undefined {
        return undefined;
    }
}
