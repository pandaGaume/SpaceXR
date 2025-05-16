/*import { Observable } from "../../../events";
import { Cartesian2 } from "../../../geometry";
import { IDisposable } from "../../../types";
import { IPointerSource } from "../map.inputs.interfaces";
import { ITapGesture, ISwipeGesture, IPinchGesture, TouchGestureType, AnyTouchGesture, ITouchGestureSource } from "../map.inputs.interfaces.touch";

interface PointerState extends Cartesian2 {
    id: number;
    startX: number;
    startY: number;
    startTime: number;
}

export class PointerToGestureController implements ITouchGestureSource, IDisposable {
    private _onTouchObservable?: Observable<AnyTouchGesture>;
    private _source: IPointerSource;
    private _pointers = new Map<number, PointerState>();

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
            this._attachSource(this._source);
        }
        return this._onTouchObservable;
    }

    public get source(): IPointerSource {
        return this._source;
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

    protected _onStart(e: PointerEvent): void {
        this._pointers.set(e.pointerId, {
            id: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            x: e.clientX,
            y: e.clientY,
            startTime: performance.now(),
        });

        if (this._pointers.size === 2) {
            const [a, b] = Array.from(this._pointers.values());
            this._pinchStartDistance = this._distance(a, b);
        }
    }

    protected _onMove(e: PointerEvent): void {
        const p = this._pointers.get(e.pointerId);
        if (p) {
            p.x = e.clientX;
            p.y = e.clientY;
        }

        if (this._pointers.size === 2) {
            const [a, b] = Array.from(this._pointers.values());
            const distance = this._distance(a, b);
            const scale = distance / this._pinchStartDistance;

            const gesture: IPinchGesture = {
                type: TouchGestureType.Pinch,
                timestamp: performance.now(),
                duration: 0,
                points: [
                    { x: a.x, y: a.y },
                    { x: b.x, y: b.y },
                ],
                center: {
                    x: (a.x + b.x) / 2,
                    y: (a.y + b.y) / 2,
                },
                scale,
            };

            this.onTouchObservable.notifyObservers(gesture);
        }
    }

    protected _onEnd(e: PointerEvent): void {
        const state = this._pointers.get(e.pointerId);
        if (!state) return;

        const duration = performance.now() - state.startTime;
        const dx = state.x - state.startX;
        const dy = state.y - state.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const fingers = [{ x: state.x, y: state.y }];
        const timestamp = performance.now();

        if (distance < 10 && duration < 300) {
            const gesture: ITapGesture = {
                type: TouchGestureType.Tap,
                timestamp,
                duration,
            };

            this.onTouchObservable.notifyObservers(gesture);

            this._lastTapTime = timestamp;
        }

        if (distance > 30 && duration < 600) {
            const gesture: ISwipeGesture = {
                type: TouchGestureType.Swipe,
                timestamp,
                duration,
                fingers,
                distance,
                direction: this._computeSwipeDirection(dx, dy),
            };

            this.onTouchObservable.notifyObservers(gesture);
        }

        this._pointers.delete(e.pointerId);
    }

    private _distance(a: PointerState, b: PointerState): number {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private _computeSwipeDirection(dx: number, dy: number): string {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx > ady) {
            return dx > 0 ? "right" : "left";
        } else {
            return dy > 0 ? "down" : "up";
        }
    }
}
*/
