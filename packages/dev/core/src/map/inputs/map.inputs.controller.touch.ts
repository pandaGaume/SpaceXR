import { Observable } from "../../events";
import { Cartesian2, ICartesian2 } from "../../geometry";
import { IDisposable } from "../../types";
import { IPointerSource } from "./map.inputs.interfaces";
import { AnyTouchGesture, IDragGesture, IPinchGesture, IRotateGesture, ITouchGestureSource, TouchGestureType } from "./map.inputs.interfaces.touch";

interface IPointerState extends ICartesian2 {
    id: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startTime: number;
    time: number;
}

interface GestureDetectionOptions {
    threshold: number;
    velocity?: number;
}

const GestureDetectionSettings: Record<TouchGestureType, GestureDetectionOptions> = {
    [TouchGestureType.Rotate]: { threshold: 0.5 }, // degrees
    [TouchGestureType.Pinch]: { threshold: 1 }, // pixels
    [TouchGestureType.Drag]: { threshold: 1 }, // pixels
    [TouchGestureType.Tap]: { threshold: 0 },
    [TouchGestureType.LongPress]: { threshold: 0 },
    [TouchGestureType.Swipe]: { threshold: 0 },
};

export class PointerToGestureController implements ITouchGestureSource, IDisposable {
    private _onTouchObservable?: Observable<AnyTouchGesture>;
    private _source: IPointerSource;
    private _pointers = new Map<number, IPointerState>();
    private _startDistance = 0;
    private _startAngle = 0;
    private _startCenter: ICartesian2 = Cartesian2.Zero();
    private _moveCount = 0;
    private _firstMoveCountThreshold = 5; // Number of moves to consider before fixing gesture type

    public constructor(source: IPointerSource) {
        this._source = source;
    }

    public dispose(): void {
        this._detachSource(this._source);
        this._clearObservable;
    }

    public get onTouchObservable(): Observable<AnyTouchGesture> {
        if (!this._onTouchObservable) {
            this._onTouchObservable = new Observable<AnyTouchGesture>();
            // lazzy attach
            this._attachSource(this._source);
        }
        return this._onTouchObservable;
    }

    public get source(): IPointerSource {
        return this._source;
    }
    protected _getClientX(e: PointerEvent): number {
        return e.clientX;
    }

    protected _getClientY(e: PointerEvent): number {
        return e.clientY;
    }
    protected _clearObservable(): void {
        this._onTouchObservable?.clear();
        this._onTouchObservable = undefined;
    }

    protected _attachSource(source: IPointerSource): void {
        if (source && this._onTouchObservable) {
            source.onPointerDownObservable.add(this._onStart);
            source.onPointerMoveObservable.add(this._onMove);
            source.onPointerUpObservable.add(this._onEnd);
            source.onPointerCancelObservable.add(this._onEnd);
        }
    }

    protected _detachSource(source: IPointerSource): void {
        if (source) {
            source.onPointerDownObservable.removeCallback(this._onStart);
            source.onPointerMoveObservable.removeCallback(this._onMove);
            source.onPointerUpObservable.removeCallback(this._onEnd);
            source.onPointerCancelObservable.removeCallback(this._onEnd);
        }
    }

    protected _onStart = (e: PointerEvent): void => {
        if (e.pointerType !== "touch") {
            return;
        }
        const x = this._getClientX(e);
        const y = this._getClientY(e);

        const state = {
            id: e.pointerId,
            startX: x,
            startY: y,
            lastX: x,
            lastY: y,
            x: x,
            y: y,
            startTime: performance.now(),
        } as IPointerState;
        this._pointers.set(e.pointerId, state);

        if (this._pointers.size === 2) {
            const [a, b] = Array.from(this._pointers.values());
            this._startDistance = this._distance(a, b);
            this._startAngle = this._angle(a, b);
            this._startCenter = this._midpoint(a, b);
            this._moveCount = 0;
        }
    };

    ///<summary>
    /// Handles pointer move events and generates touch gestures.
    /// It supports single touch drag and two-finger pinch/drag gestures.
    /// @param e The pointer event.
    ///</summary>
    protected _onMove = (e: PointerEvent): void => {
        if (e.pointerType !== "touch") {
            return;
        }
        const state = this._pointers.get(e.pointerId);
        if (state) {
            state.x = this._getClientX(e);
            state.y = this._getClientY(e);

            switch (this._pointers.size) {
                case 1: {
                    const gesture: IDragGesture = {
                        type: TouchGestureType.Drag,
                        timestamp: performance.now(),
                        duration: performance.now() - state.startTime,
                        points: [{ x: state.x, y: state.y }],
                        deltaX: state.x - state.lastX,
                        deltaY: state.y - state.lastY,
                    };
                    this.onTouchObservable.notifyObservers(gesture);
                    // reset start position to current position
                    // this allows to compute deltaX and deltaY as relative to the last position
                    state.lastX = state.x;
                    state.lastY = state.y;
                    break;
                }
                case 2: {
                    this._moveCount++;
                    if (this._moveCount < this._firstMoveCountThreshold) {
                        return; // Wait for enough moves to determine gesture type
                    }
                    const [a, b] = Array.from(this._pointers.values());
                    const center = this._midpoint(a, b);
                    const angle = this._angle(a, b);
                    const distance = this._distance(a, b);

                    const deltaAngle = angle - this._startAngle;
                    const deltaDistance = distance - this._startDistance;
                    const deltaCenter = this._distance(center, this._startCenter);

                    const types = this._detectActiveTypes(deltaAngle, deltaDistance, deltaCenter);

                    for (const type of types) {
                        switch (type) {
                            case TouchGestureType.Rotate: {
                                const gesture: IRotateGesture = {
                                    type: TouchGestureType.Rotate,
                                    timestamp: performance.now(),
                                    duration: 0,
                                    points: [
                                        { x: a.x, y: a.y },
                                        { x: b.x, y: b.y },
                                    ],
                                    center: center,
                                    angle: deltaAngle,
                                };
                                this._startAngle = angle;
                                this.onTouchObservable.notifyObservers(gesture);
                                break;
                            }
                            case TouchGestureType.Pinch: {
                                const gesture: IPinchGesture = {
                                    type: TouchGestureType.Pinch,
                                    timestamp: performance.now(),
                                    duration: 0,
                                    points: [
                                        { x: a.x, y: a.y },
                                        { x: b.x, y: b.y },
                                    ],
                                    center: center,
                                    scale: deltaDistance,
                                };
                                this._startDistance = distance;
                                this.onTouchObservable.notifyObservers(gesture);
                                break;
                            }
                            case TouchGestureType.Drag: {
                                const gesture: IDragGesture = {
                                    type: TouchGestureType.Drag,
                                    timestamp: performance.now(),
                                    duration: 0,
                                    points: [
                                        { x: a.x, y: a.y },
                                        { x: b.x, y: b.y },
                                    ],
                                    deltaX: center.x - this._startCenter.x,
                                    deltaY: center.y - this._startCenter.y,
                                    startPosition: this._startCenter,
                                };
                                this._startCenter = { x: center.x, y: center.y };
                                this.onTouchObservable.notifyObservers(gesture);
                                break;
                            }
                        }
                    }
                    break;
                }
            }
        }
    };

    protected _onEnd = (e: PointerEvent): void => {
        if (e.pointerType !== "touch") {
            return;
        }
        this._pointers.delete(e.pointerId);
    };

    private _distance(a: ICartesian2, b: ICartesian2): number {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private _angle(a: ICartesian2, b: ICartesian2): number {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return Math.atan2(dy, dx) * (180 / Math.PI); // Convert to degrees
    }

    private _midpoint(a: IPointerState, b: IPointerState): ICartesian2 {
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    private _detectActiveTypes(angleRad: number, distDelta: number, centerDelta: number): TouchGestureType[] {
        const result: TouchGestureType[] = [];
        const angleDeg = Math.abs(angleRad * 57.2958);
        const pinchScore = Math.abs(distDelta);
        const dragScore = Math.abs(centerDelta);

        if (angleDeg > GestureDetectionSettings[TouchGestureType.Rotate].threshold) {
            result.push(TouchGestureType.Rotate);
        }
        if (pinchScore > GestureDetectionSettings[TouchGestureType.Pinch].threshold) {
            result.push(TouchGestureType.Pinch);
        }
        if (dragScore > GestureDetectionSettings[TouchGestureType.Drag].threshold) {
            result.push(TouchGestureType.Drag);
        }
        return result;
    }
}
