import { Observable, Observer } from "../../events";
import { IDisposable, Nullable } from "../../types";
import { IDragSource, IPointerDragEvent, IPointerSource } from "./map.inputs.interfaces";

export class PointerToDragController implements IDragSource, IDisposable {
    private _onDragObservable?: Observable<IPointerDragEvent>;
    private _pointerState = new Map<number, { startX: number; startY: number; lastX: number; lastY: number; button: number }>();
    private _source: IPointerSource;
    private _observers: Array<Nullable<Observer<PointerEvent>>> = [];

    public constructor(source: IPointerSource) {
        this._source = source;
    }

    public dispose(): void {
        this._detachSource();
        this._clearObservable();
        this._pointerState.clear();
    }

    public get onDragObservable(): Observable<IPointerDragEvent> {
        if (!this._onDragObservable) {
            this._onDragObservable = new Observable<IPointerDragEvent>();
            this._attachSource(this._source);
        }
        return this._onDragObservable;
    }

    public get source(): IPointerSource {
        return this._source;
    }

    protected _clearObservable(): void {
        this._onDragObservable?.clear();
    }

    protected _attachSource(source: IPointerSource): void {
        if (source && this._onDragObservable) {
            this._observers.push(
                source.onPointerDownObservable.add(this._onStart),
                source.onPointerMoveObservable.add(this._onMove),
                source.onPointerUpObservable.add(this._onEnd),
                source.onPointerCancelObservable.add(this._onEnd)
            );
        }
    }

    protected _detachSource(): void {
        for (const observer of this._observers) {
            if (observer) {
                observer.disconnect();
            }
        }
        this._observers = [];
    }

    protected _getClientX(e: PointerEvent): number {
        return e.clientX;
    }

    protected _getClientY(e: PointerEvent): number {
        return e.clientY;
    }

    protected _onStart = (e: PointerEvent): void => {
        const x = this._getClientX(e);
        const y = this._getClientY(e);
        this._pointerState.set(e.pointerId, {
            startX: x,
            startY: y,
            lastX: x,
            lastY: y,
            button: e.button,
        });
    };

    protected _onMove = (e: PointerEvent): void => {
        const state = this._pointerState.get(e.pointerId);
        if (state) {
            const x = this._getClientX(e);
            const y = this._getClientY(e);

            const dx = x - state.lastX;
            const dy = y - state.lastY;
            const event: IPointerDragEvent = {
                type: "drag",
                pointerId: e.pointerId,
                button: state.button,
                startX: state.startX,
                startY: state.startY,
                x: x,
                y: y,
                deltaX: dx,
                deltaY: dy,
                timestamp: performance.now(),
                originalEvent: e,
            };
            this.onDragObservable.notifyObservers(event);
            state.lastX = x;
            state.lastY = y;
        }
    };

    protected _onEnd = (e: PointerEvent): void => {
        const state = this._pointerState.get(e.pointerId);
        if (state) {
            const x = this._getClientX(e);
            const y = this._getClientY(e);

            const dx = x - state.startX;
            const dy = y - state.startY;
            this.onDragObservable.notifyObservers({
                type: "end",
                pointerId: e.pointerId,
                button: state.button,
                startX: state.startX,
                startY: state.startY,
                x: x,
                y: y,
                deltaX: dx,
                deltaY: dy,
                timestamp: performance.now(),
                originalEvent: e,
            });
            this._pointerState.delete(e.pointerId);
        }
    };
}
