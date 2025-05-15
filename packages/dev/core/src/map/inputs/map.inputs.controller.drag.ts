import { Observable } from "../../events";
import { IDisposable } from "../../types";
import { IDragSource, IPointerDragEvent, IPointerSource } from "./map.inputs.interfaces";

export class PointerToDragController implements IDragSource, IDisposable {
    private _onDragObservable?: Observable<IPointerDragEvent>;
    private _pointerState = new Map<number, { startX: number; startY: number; lastX: number; lastY: number; button: number }>();
    private _source: IPointerSource;

    public constructor(source: IPointerSource) {
        this._source = source;
    }

    public dispose(): void {
        this._detachSource(this._source);
        this._clearObservable();
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
        this._onDragObservable = undefined;
    }

    protected _attachSource(source: IPointerSource): void {
        if (source && this._onDragObservable) {
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
        this._pointerState.set(e.pointerId, {
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
            button: e.button,
        });
    }

    protected _onMove(e: PointerEvent): void {
        const state = this._pointerState.get(e.pointerId);
        if (state) {
            const dx = e.clientX - state.lastX;
            const dy = e.clientY - state.lastY;
            const event: IPointerDragEvent = {
                type: "drag",
                pointerId: e.pointerId,
                button: state.button,
                startX: state.startX,
                startY: state.startY,
                x: e.clientX,
                y: e.clientY,
                deltaX: dx,
                deltaY: dy,
                timestamp: performance.now(),
                originalEvent: e,
            };
            this.onDragObservable.notifyObservers(event);
            state.lastX = e.clientX;
            state.lastY = e.clientY;
        }
    }

    protected _onEnd(e: PointerEvent): void {
        const state = this._pointerState.get(e.pointerId);
        if (state) {
            const dx = e.clientX - state.startX;
            const dy = e.clientY - state.startY;
            this.onDragObservable.notifyObservers({
                type: "end",
                pointerId: e.pointerId,
                button: state.button,
                startX: state.startX,
                startY: state.startY,
                x: e.clientX,
                y: e.clientY,
                deltaX: dx,
                deltaY: dy,
                timestamp: performance.now(),
                originalEvent: e,
            });
            this._pointerState.delete(e.pointerId);
        }
    }
}
