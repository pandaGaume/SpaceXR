import { GestureStatus, ITouchGestureOptions, TouchMapEndEvent, TouchMapGestureType, TouchMapStartEvent, TouchMapUpdateEvent, TouchSpot } from "./map.inputs.touch.interfaces";

export class TouchMapGesture {
    static X_coordinate: number = 0;
    static Y_coordinate: number = 1;

    public static GetCenterToRef(spots: TouchList, center: Array<number>) {
        let count = spots.length;
        center[TouchMapGesture.X_coordinate] = spots[0].clientX;
        center[TouchMapGesture.Y_coordinate] = spots[0].clientY;

        for (let i = 1; i < count; i++) {
            center[TouchMapGesture.X_coordinate] += spots[i].clientX;
            center[TouchMapGesture.Y_coordinate] += spots[i].clientY;
        }

        center[TouchMapGesture.X_coordinate] /= count;
        center[TouchMapGesture.Y_coordinate] /= count;
    }

    private _element: HTMLElement | SVGElement | null;
    protected _options: ITouchGestureOptions;
    protected _gestureType: TouchMapGestureType;
    protected _touchesA: Array<TouchSpot>;
    protected _touchesB: Array<TouchSpot>;
    protected _status: GestureStatus;

    constructor(element: HTMLElement | SVGElement | string, gestureType: TouchMapGestureType, options?: ITouchGestureOptions) {
        this._element = typeof element == "string" ? document.getElementById(element) : element;

        if (this._element) {
            this._element.addEventListener("touchstart", this._start.bind(this), false);
            this._element.addEventListener("touchmove", this._move.bind(this), false);
            this._element.addEventListener("touchend", this._end.bind(this), false);
            this._element.addEventListener("touchcancel", this._cancel.bind(this), false);
        }
        this._gestureType = gestureType;
        this._options = options || { touchCount: 1 };
        this._touchesA = Array.from({ length: this._options.touchCount }, () => new TouchSpot());
        this._touchesB = Array.from({ length: this._options.touchCount }, () => new TouchSpot());
        this._status = GestureStatus.IDLE;
    }

    public get element(): HTMLElement | SVGElement | null {
        return this._element;
    }

    protected _start(e: Event): void {
        e.preventDefault();
        var evt = e as TouchEvent;
        if (!evt.touches || evt.touches.length != this._options.touchCount) {
            return;
        }
        this._doStart(evt);
    }

    protected _doStart(evt: TouchEvent) {
        this._update(evt);
        this._status = GestureStatus.STARTED;
        this._fireEvent(this._buildStartEvent(evt));
    }

    protected _move(e: Event) {
        e.preventDefault();
        var evt = e as TouchEvent;
        if (!evt.touches || evt.touches.length != this._options.touchCount) {
            return;
        }
        this._doMove(evt);
    }

    protected _doMove(evt: TouchEvent) {
        // swap A & B
        this._swap();
        this._update(evt);
        this._fireEvent(this._buildUpdateEvent(evt));
    }

    protected _end(e: Event) {
        e.preventDefault();
        var evt = e as TouchEvent;
        let l1 = evt.touches?.length ?? 0;
        let l2 = evt.changedTouches?.length ?? 0;
        var totalLength = l1 + l2;
        if (totalLength >= this._options.touchCount) {
            this._doEnd(evt);
        }
    }

    protected _doEnd(evt: TouchEvent) {
        this._clear();
        this._status = GestureStatus.IDLE;
        this._fireEvent(this._buildEndEvent(evt));
    }

    protected _cancel(e: Event) {
        e.preventDefault();
        this._clear();
        this._status = GestureStatus.IDLE;
    }

    protected _fireEvent(e?: Event): void {
        if (e) {
            this._element?.dispatchEvent(e);
        }
    }

    protected _update(evt: TouchEvent) {
        let now = Date.now();
        let count = evt.touches.length;
        for (let i = 0; i < count; i++) {
            let touch = evt.touches[i];
            let localTouch = this._touchesB[i];
            localTouch.id = touch.identifier;
            localTouch.x = touch.clientX;
            localTouch.y = touch.clientY;
            localTouch.timestamp = now;
        }
    }

    protected _clear() {}

    protected _swap() {
        var tmp = this._touchesB;
        this._touchesB = this._touchesA;
        this._touchesA = tmp;
    }

    protected _buildStartEvent(evt: TouchEvent): Event | undefined {
        return new TouchMapStartEvent(evt, this._gestureType);
    }

    protected _buildUpdateEvent(evt: TouchEvent): Event | undefined {
        return new TouchMapUpdateEvent(
            evt,
            this._gestureType,
            this._touchesA.map((v) => new TouchSpot(v)),
            this._touchesB.map((v) => new TouchSpot(v))
        );
    }

    protected _buildEndEvent(evt: TouchEvent): Event | undefined {
        return new TouchMapEndEvent(evt, this._gestureType);
    }
}
